/**
 * Error decoding WTF-8.
 * Made to look more compatible with the errors that Node's TextDecoder
 * throws by having a code field.
 */
export class DecodeError extends TypeError {
  public code = 'ERR_ENCODING_INVALID_ENCODED_DATA';
  public constructor() {
    super('The encoded data was not valid for encoding wtf-8');
  }
}

/**
 * Passed in an encoding other than "wtf-8" or something close to that.
 * Made to look more compatible with the errors that Node's TextDecoder
 * throws by having a code field.
 */
export class InvalidEncodingError extends RangeError {
  public code = 'ERR_ENCODING_NOT_SUPPORTED';
  public constructor(label: string) {
    super(`Invalid encoding: "${label}"`);
  }
}
