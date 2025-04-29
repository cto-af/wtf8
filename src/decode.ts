import {
  BOM,
  EMPTY,
  MIN_HIGH_SURROGATE,
  MIN_LOW_SURROGATE,
  REPLACEMENT,
  WTF8,
} from './const.js';
import {DecodeError, InvalidEncodingError} from './errors.js';

/**
 * Type assertion for typed arrays.
 *
 * @param input Potential typed array.
 * @returns True if a typed array.
 */
function isArrayBufferView(
  input: AllowSharedBufferSource
): input is ArrayBufferView {
  return (
    input &&
    !(input instanceof ArrayBuffer) &&
    input.buffer instanceof ArrayBuffer
  );
}

/**
 * Convert unknown input to Uint8Array.
 *
 * @param input Typed Array, ArrayBuffer, or Buffer.
 * @returns Uint8Array.
 */
function getUint8(input?: AllowSharedBufferSource): Uint8Array {
  if (!input) {
    return EMPTY;
  }
  if (input instanceof Uint8Array) {
    return input;
  }
  // Uint16Array, for instance
  if (isArrayBufferView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  return new Uint8Array(input);
}

/**
 * How many bytes are left over after consuming this start byte?
 * -1 for error.
 */
const REMAINDER = [
  0, // 0b0000
  0, // 0b0001
  0, // 0b0010
  0, // 0b0011
  0, // 0b0100
  0, // 0b0101
  0, // 0b0110
  0, // 0b0111
  -1, // 0b1000
  -1, // 0b1001
  -1, // 0b1010
  -1, // 0b1011
  1, // 0b1100
  1, // 0b1101
  2, // 0b1110
  3, // 0b1111
];

/**
 * Decoder for WTF-8.
 */
export class Wtf8Decoder implements TextDecoderCommon {
  public readonly encoding = WTF8;
  public readonly fatal: boolean;
  public readonly ignoreBOM: boolean;
  #left = 0;
  #cur = 0;
  #pending = 0;
  #first = true;

  public constructor(
    label = 'wtf8',
    options: TextDecoderOptions | undefined = undefined
  ) {
    if (label.toLowerCase().replace('-', '') !== 'wtf8') {
      throw new InvalidEncodingError(label);
    }
    this.fatal = Boolean(options?.fatal);
    this.ignoreBOM = Boolean(options?.ignoreBOM);
  }

  /**
   * Returns the result of running encoding's decoder. The method can be
   * invoked zero or more times with options's stream set to true, and then
   * once without options's stream (or set to false), to process a fragmented
   * input. If the invocation without options's stream (or set to false) has
   * no input, it's clearest to omit both arguments.
   *
   * If the error mode is "fatal" and encoding's decoder returns error, throws
   * a TypeError.
   *
   * @param input TypedArray to read from.
   * @param options Could allow streaming.
   * @returns Decoded string.
   * @throws {TypeError} On invalidly-encoded inputs.
   */
  public decode(
    input?: AllowSharedBufferSource,
    options?: TextDecodeOptions
  ): string {
    const streaming = Boolean(options?.stream);
    const bytes = getUint8(input);

    const res: string[] = [];
    const out = new Uint16Array(Math.min(
      0xffff,
      bytes.length + this.#pending + 1
    ));
    let pos = 0;
    const fatal = (): void => {
      this.#cur = 0;
      this.#left = 0;
      this.#pending = 0;
      if (this.fatal) {
        throw new DecodeError();
      }
      out[pos++] = REPLACEMENT;
    };

    const fatals = (): void => {
      const p = this.#pending;
      for (let i = 0; i < p; i++) {
        fatal();
      }
    };

    // eslint-disable-next-line @typescript-eslint/consistent-return
    const oneByte = (b: number): void => {
      if (this.#left === 0) {
        //
        // assert.equal(this.#cur, 0);
        const n = REMAINDER[b >> 4];
        switch (n) {
          case -1:
            fatal(); // Continuation byte where start was expected
            break;
          case 0:
            out[pos++] = b;
            break;
          case 1:
            this.#cur = b & 0x1f;
            if ((this.#cur & 0x1e) === 0) {
              fatal(); // Over-long encoding of 2 bytes
            } else {
              this.#left = 1;
              this.#pending = 1;
            }
            break;
          case 2:
            this.#cur = b & 0x0f;
            this.#left = 2;
            this.#pending = 1;
            break;
          case 3:
            if (b & 0x08) {
              fatal(); // 5+ bytes
            } else {
              this.#cur = b & 0x07;
              this.#left = 3;
              this.#pending = 1;
            }
            break;
        }
      } else {
        if ((b & 0xc0) !== 0x80) {
          fatals(); // Not continuation, cancel pending
          return oneByte(b); // Try again
        }
        if (
          (this.#pending === 1) && // Second byte of 3, not 3rd of 4.
          (this.#left === 2) &&
          (this.#cur === 0) &&
          ((b & 0x20) === 0)
        ) {
          fatals(); // Over-long encoding as 3 bytes.
          return oneByte(b);
        }
        if ((this.#left === 3) && (this.#cur === 0) && ((b & 0x30) === 0)) {
          fatals(); // Over-long encoding as 4 bytes.
          return oneByte(b);
        }
        this.#cur = (this.#cur << 6) | (b & 0x3f);
        this.#pending++;
        if (--this.#left === 0) {
          if (this.ignoreBOM || !this.#first || (this.#cur !== BOM)) {
            if (this.#cur < 0x10000) {
              out[pos++] = this.#cur;
            } else {
              const cp = this.#cur - 0x10000;
              out[pos++] = ((cp >>> 10) & 0x3ff) | MIN_HIGH_SURROGATE;
              out[pos++] = (cp & 0x3ff) | MIN_LOW_SURROGATE;
            }
          }
          this.#cur = 0;
          this.#pending = 0;
          this.#first = false;
        }
      }
    };

    for (const b of bytes) {
      if (pos >= out.length - 1) {
        res.push(String.fromCharCode.apply(
          null,
          out.subarray(0, pos) as unknown as number[]
        ));
        pos = 0;
      }
      oneByte(b);
    }

    if (!streaming) {
      this.#first = true;
      if (this.#cur || this.#left) {
        fatals();
      }
    }

    if (pos > 0) {
      res.push(String.fromCharCode.apply(
        null,
        out.subarray(0, pos) as unknown as number[]
      ));
    }
    return res.join('');
  }
}
