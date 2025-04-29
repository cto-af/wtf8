import {Wtf8Decoder} from './decode.js';

/**
 * Transform input bytes into strings.  Care is taken that if partial
 * WTF-8 sequences are read, they are reconstructed when the next portion
 * of the sequence is received.
 */
export class Wtf8DecoderStream {
  #handle: Wtf8Decoder;
  #transform: TransformStream<AllowSharedBufferSource, string>;

  public constructor(
    encoding = 'wtf-8',
    options: TextDecoderOptions | undefined = undefined
  ) {
    const dec = new Wtf8Decoder(encoding, options);
    this.#handle = dec;
    this.#transform = new TransformStream({
      transform(chunk, controller): void {
        const value = dec.decode(chunk, {stream: true});
        if (value) {
          controller.enqueue(value);
        }
      },
      flush(controller): void {
        const value = dec.decode();
        if (value) {
          controller.enqueue(value);
        }
        controller.terminate();
      },
    });
  }

  public get encoding(): string {
    return this.#handle.encoding;
  }

  public get fatal(): boolean {
    return this.#handle.fatal;
  }

  public get ignoreBOM(): boolean {
    return this.#handle.ignoreBOM;
  }

  public get readable(): ReadableStream<string> {
    return this.#transform.readable;
  }

  public get writable(): WritableStream<AllowSharedBufferSource> {
    return this.#transform.writable;
  }
}
