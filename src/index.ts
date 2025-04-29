/* eslint-disable @typescript-eslint/class-methods-use-this */

// U+FFFD: REPLACEMENT CHARACTER
const REPLACEMENT = String.fromCharCode(0xfffd);
const BOM = 0xfeff; // U+FEFF: ZERO WIDTH NO-BREAK SPACE
const ERR_TEXT = 'The encoded data was not valid for encoding wtf-8';
const WTF8 = 'wtf-8';
const EMPTY = new Uint8Array(0);

export class DecodeError extends TypeError {
  public code = 'ERR_ENCODING_INVALID_ENCODED_DATA';
  public constructor() {
    super(ERR_TEXT);
  }
}

export class InvalidEncodingError extends RangeError {
  public code = 'ERR_ENCODING_NOT_SUPPORTED';
  public constructor(label: string) {
    super(`Invalid encoding: "${label}"`);
  }
}

function isArrayBufferView(
  input: AllowSharedBufferSource
): input is ArrayBufferView {
  return (
    input &&
    !(input instanceof ArrayBuffer) &&
    input.buffer instanceof ArrayBuffer
  );
}

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

    let res = '';
    const fatal = (): void => {
      this.#cur = 0;
      this.#left = 0;
      this.#pending = 0;
      if (this.fatal) {
        throw new DecodeError();
      }
      res += REPLACEMENT;
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
            fatal();
            break;
          case 0:
            res += String.fromCharCode(b);
            break;
          case 1:
            this.#cur = b & 0x1f;
            if (this.#cur < 2) {
              fatal();
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
              fatal();
            } else {
              this.#cur = b & 0x07;
              this.#left = 3;
              this.#pending = 1;
            }
            break;
        }
      } else {
        if ((b & 0xc0) !== 0x80) {
          fatals();
          return oneByte(b);
        }
        if (
          (this.#pending === 1) && // Second byte of 3, not 3rd of 4.
          (this.#left === 2) &&
          (this.#cur === 0) &&
          ((b & 0x20) === 0)
        ) {
          fatals();
          return oneByte(b);
        }
        if ((this.#left === 3) && (this.#cur === 0) && ((b & 0x30) === 0)) {
          fatals();
          return oneByte(b);
        }
        this.#cur = (this.#cur << 6) | (b & 0x3f);
        this.#pending++;
        if (--this.#left === 0) {
          if (!this.#first || this.ignoreBOM || (this.#cur !== BOM)) {
            res += String.fromCodePoint(this.#cur);
          }
          this.#cur = 0;
          this.#pending = 0;
          this.#first = false;
        }
      }
    };

    for (const b of bytes) {
      oneByte(b);
    }
    if (!streaming) {
      this.#first = true;
      if (this.#cur || this.#left) {
        fatals();
      }
    }
    return res;
  }
}

function utf8length(str: string): number {
  let len = 0;
  for (const s of str) {
    const cp = s.codePointAt(0) as number;
    if (cp < 0x80) {
      len++;
    } else if (cp < 0x800) {
      len += 2;
    } else if (cp < 0x10000) {
      len += 3;
    } else {
      len += 4;
    }
  }
  return len;
}

/**
 * Encoder for WTF-8.
 */
export class Wtf8Encoder implements TextEncoderCommon {
  public readonly encoding = WTF8;

  /**
   * Returns the result of running UTF-8's encoder.
   *
   * @param input String to encode.
   * @returns Encoded buffer.
   */
  public encode(input?: string): Uint8Array {
    if (!input) {
      return EMPTY;
    }
    const buf = new Uint8Array(utf8length(String(input)));
    this.encodeInto(input, buf);
    return buf;
  }

  /**
   * Runs the UTF-8 encoder on source, stores the result of that operation
   * into destination, and returns the progress made as an object wherein read
   * is the number of converted code units of source and written is the number
   * of bytes modified in destination.
   *
   * @param source String to encode.
   * @param destination Array to overwrite.
   * @returns Progress.
   */
  public encodeInto(
    source: string,
    destination: Uint8Array
  ): TextEncoderEncodeIntoResult {
    const str = String(source);
    const len = str.length;
    const outLen = destination.length;
    let written = 0;
    let read = 0;

    // `read` is in 16-bit code units, not codepoints.
    for (read = 0; read < len; read++) {
      const c = str.codePointAt(read) as number;
      if (c < 0x80) {
        if (written >= outLen) {
          break;
        }
        destination[written++] = c;
      } else if (c < 0x800) {
        if (written >= outLen - 1) {
          break;
        }
        destination[written++] = 0xc0 | (c >> 6);
        destination[written++] = 0x80 | (c & 0x3f);
      } else if (c < 0x10000) {
        if (written >= outLen - 2) {
          break;
        }
        destination[written++] = 0xe0 | (c >> 12);
        destination[written++] = 0x80 | ((c >> 6) & 0x3f);
        destination[written++] = 0x80 | (c & 0x3f);
      } else {
        if (written >= outLen - 3) {
          break;
        }
        destination[written++] = 0xf0 | (c >> 18);
        destination[written++] = 0x80 | ((c >> 12) & 0x3f);
        destination[written++] = 0x80 | ((c >> 6) & 0x3f);
        destination[written++] = 0x80 | (c & 0x3f);
        read++; // Two code units
      }
    }
    return {
      read,
      written,
    };
  }
}
