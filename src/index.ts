import {ByteStream} from './bytestream.js';

const REPLACEMENT = 0xfffd; // U+FFFD: REPLACEMENT CHARACTER
const BOM = 0xfeff; // U+FEFF: ZERO WIDTH NO-BREAK SPACE
const ERR_TEXT = 'The encoded data was not valid for encoding wtf-8';
const WTF8 = 'wtf-8';

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

function combine(...bytes: number[]): number {
  return bytes.reduce((tot, b) => (tot << 6) | b, 0);
}

/**
 * Decoder for WTF-8.
 */
export class Wtf8Decoder implements TextDecoderCommon {
  public readonly encoding = WTF8;
  public readonly fatal: boolean;
  public readonly ignoreBOM: boolean;
  #stream = new ByteStream();
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
    this.#stream.push(input);
    const res: string[] = [];
    // UTF-16 is always <= length to UTF8.  Don't alloc too much, for large
    // inputs, we'll work in chunks.
    const out = new Uint16Array(Math.min(0xffff, this.#stream.length + 1));
    let outOffset = 0;

    const checkContinue = (...continuingBytes: number[]): boolean => {
      for (const b of continuingBytes) {
        if ((b & 0xc0) !== 0x80) {
          this.#fatal();
          out[outOffset++] = REPLACEMENT;
          return false;
        }
      }
      return true;
    };

    while (true) {
      // We need two spots left in buf in case we're at a supplemental char
      if (this.#stream.empty || (outOffset >= (out.length - 1))) {
        res.push(String.fromCharCode.apply(
          null,
          out.subarray(0, outOffset) as unknown as number[]
        ));
        if (this.#stream.empty) {
          break;
        }
        outOffset = 0;
      }

      // Leave b1 in place in case we are streaming, doing have the follow-up
      // bytes, and we'll pick back up later.
      const b1 = this.#stream.peek() as number; // Not empty, from above.
      if ((b1 & 0x80) === 0) {
        out[outOffset++] = b1;
        this.#stream.shift();
      } else if ((b1 & 0xe0) === 0xc0) {
        // 2 bytes
        if (this.#stream.hasBytes(2)) {
          const [_b1, b2] = this.#stream.shift(2);
          if (checkContinue(b2)) {
            const cp = combine(b1 & 0x1f, b2 & 0x3f);
            if (cp < 0x80) {
              this.#fatal();
              out[outOffset++] = REPLACEMENT;
              this.#stream.unshift(b2);
            } else {
              out[outOffset++] = cp;
            }
          } else {
            // Try again with b2 as the start of a sequence.
            this.#stream.unshift(b2);
          }
        } else if (streaming) {
          break;
        } else {
          this.#fatal();
          out[outOffset++] = REPLACEMENT;
          this.#stream.shift();
        }
      } else if ((b1 & 0xf0) === 0xe0) {
        // 3 bytes
        if (this.#stream.hasBytes(3)) {
          const [_b1, b2, b3] = this.#stream.shift(3);
          if (checkContinue(b2, b3)) {
            const cp = combine(b1 & 0x0f, b2 & 0x3f, b3 & 0x3f);
            if (cp < 0x800) {
              this.#fatal();
              out[outOffset++] = REPLACEMENT;
              this.#stream.unshift(b2, b3);
            } else if (!this.#first || this.ignoreBOM || (cp !== BOM)) {
              out[outOffset++] = cp;
            }
          } else {
            this.#stream.unshift(b2, b3);
          }
        } else if (streaming) {
          break;
        } else {
          this.#fatal();
          out[outOffset++] = REPLACEMENT;
          this.#stream.shift();
        }
      } else if ((b1 & 0xf8) === 0xf0) {
        // 4 bytes.  Always two code units.
        if (this.#stream.hasBytes(4)) {
          const [_b1, b2, b3, b4] = this.#stream.shift(4);
          if (checkContinue(b2, b3, b4)) {
            let cp = combine(b1 & 0x0f, b2 & 0x3f, b3 & 0x3f, b4 & 0x3f);
            if (cp < 0x10000) {
              this.#fatal();
              out[outOffset++] = REPLACEMENT;
              this.#stream.unshift(b2, b3, b4);
            } else {
              cp -= 0x10000;
              out[outOffset++] = ((cp >>> 10) & 0x3ff) | 0xd800;
              out[outOffset++] = (cp & 0x3ff) | 0xdc00;
            }
          } else {
            this.#stream.unshift(b2, b3, b4);
          }
        } else if (streaming) {
          break;
        } else {
          this.#fatal();
          out[outOffset++] = REPLACEMENT;
          this.#stream.shift();
        }
      } else {
        this.#fatal();
        out[outOffset++] = REPLACEMENT;
        this.#stream.shift();
      }
      this.#first = false;
    }

    this.#first = !streaming;
    return res.join('');
  }

  #fatal(): void {
    if (this.fatal) {
      throw new DecodeError();
    }
  }
}

/**
 * Encoder for WTF-8.
 */
export class Wtf8Encoder {
  public readonly encoding = WTF8;
}
