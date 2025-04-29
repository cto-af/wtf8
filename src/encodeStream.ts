import {MAX_HIGH_SURROGATE, MIN_HIGH_SURROGATE} from './const.js';
import {Wtf8Encoder} from './encode.js';

function isHighSurrogate(n: number): boolean {
  return (MIN_HIGH_SURROGATE <= n) && (n <= MAX_HIGH_SURROGATE);
}

/**
 * Encode a stream of strings to Uint8Array chunks, taking care that
 * surrogate pairs that are split between input streams are matched up
 * as needed.
 */
export class Wtf8EncoderStream {
  #pendingHighSurrogate: string | null = null;
  #handle: Wtf8Encoder;
  #transform: TransformStream<string, Uint8Array>;

  public constructor() {
    this.#handle = new Wtf8Encoder();
    this.#transform = new TransformStream({
      transform: (chunk, controller): void => {
        chunk = String(chunk);
        if (this.#pendingHighSurrogate != null) {
          chunk = this.#pendingHighSurrogate + chunk;
          this.#pendingHighSurrogate = null;
        }
        if (isHighSurrogate(chunk.charCodeAt(chunk.length - 1))) {
          this.#pendingHighSurrogate = chunk[chunk.length - 1];
          chunk = chunk.slice(0, -1);
        }
        if (chunk) {
          const value = this.#handle.encode(chunk);
          if (value.length) {
            controller.enqueue(value);
          }
        }
      },
      flush: (controller): void => {
        // https://encoding.spec.whatwg.org/#encode-and-flush
        if (this.#pendingHighSurrogate !== null) {
          controller.enqueue(this.#handle.encode(this.#pendingHighSurrogate));
          this.#pendingHighSurrogate = null;
        }
      },
    });
  }

  public get encoding(): string {
    return this.#handle.encoding;
  }

  public get readable(): ReadableStream<Uint8Array> {
    return this.#transform.readable;
  }

  public get writable(): WritableStream<string> {
    return this.#transform.writable;
  }
}
