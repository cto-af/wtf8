import {EMPTY, WTF8} from './const.js';

/**
 * How many bytes with this string take up in UTF-8 encoding?
 * @param str String to measure.
 * @returns Expected byte count.
 */
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
