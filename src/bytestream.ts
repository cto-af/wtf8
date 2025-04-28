function isArrayBufferView(
  input: AllowSharedBufferSource
): input is ArrayBufferView {
  return (
    input &&
    !(input instanceof ArrayBuffer) &&
    input.buffer instanceof ArrayBuffer
  );
}

function getUint8(input: AllowSharedBufferSource): Uint8Array {
  if (input instanceof Uint8Array) {
    return input;
  }
  // Uint16Array, for instance
  if (isArrayBufferView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  return new Uint8Array(input);
}

const EMPTY = new Uint8Array(0);
Object.freeze(EMPTY); // Just to be sure.

export class ByteStream {
  #firstIndex = 0;
  #length = 0;
  #q: Uint8Array[] = [];

  public constructor(input?: AllowSharedBufferSource) {
    this.push(input);
  }

  public get empty(): boolean {
    return this.#length === 0;
  }

  public get length(): number {
    return this.#length;
  }

  public push(input?: AllowSharedBufferSource): void {
    if (input) {
      const buf = getUint8(input);
      if (buf.length > 0) {
        this.#q.push(buf);
        this.#length += buf.length;
      }
    }
  }

  public shift(len = 1): Uint8Array {
    if (len < 1) {
      throw new RangeError(`Invalid length: ${len}`);
    }
    if (!this.hasBytes(len)) {
      return EMPTY;
    }
    const ret = new Uint8Array(len);
    let [first] = this.#q;
    for (let offset = 0; offset < len; offset++) {
      ret[offset] = first[this.#firstIndex++];
      if (this.#firstIndex === first.length) {
        this.#q.shift();
        [first] = this.#q; // Always ok.
        this.#firstIndex = 0;
      }
      this.#length--;
    }
    return ret;
  }

  public unshift(...bytes: number[]): void {
    this.#q.unshift(new Uint8Array(bytes));
    this.#length += bytes.length;
  }

  public peek(): number | undefined {
    if (this.empty) {
      return undefined;
    }
    const [first] = this.#q;
    return first[this.#firstIndex];
  }

  public hasBytes(len: number): boolean {
    return this.#length >= len;
  }
}
