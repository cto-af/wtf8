import {DecodeError, Wtf8Decoder, Wtf8Encoder} from '../lib/index.js';
import {Buffer} from 'node:buffer';
import assert from 'node:assert';
import test from 'node:test';

const BIG = 65536 * 2;
const bigA = new Uint8Array(BIG);
bigA.fill(0x61);

const good = [
  ['', ''],
  ['61', 'a'],
  [bigA, ''.padEnd(BIG, 'a')],
  ['c280', '\x80'],
  ['dfbf', '\u07ff'],
  ['e0a080', '\u0800'],
  ['eda080', '\ud800'],
  ['edb080', '\udc00'],
  ['efbfbf', '\uffff'],
  ['f09f92a9', '\u{1F4A9}'],
  ['efbbbff09f92a9efbbbf', '\u{1F4A9}\uFEFF', true], // BOM-poop-BOM
];

const bad = [
  ['c0', '\ufffd'], // Truncated
  ['cf00', '\ufffd\x00'], // Not continuing
  ['e0a000', '\ufffd\ufffd\x00'], // Not continuing
  ['e0a0', '\ufffd\ufffd'], // Truncated
  ['c081', '\ufffd\ufffd'], // < 80
  ['e08081', '\ufffd\ufffd\ufffd'], // < 0x800
  ['f0808081', '\ufffd\ufffd\ufffd\ufffd'], // < 0x10000
  ['f08080', '\ufffd\ufffd\ufffd'], // Truncated
  ['f0000000', '\ufffd\x00\x00\x00'], // Not continuing
  ['ff', '\ufffd'], // All the bytes
  ['f880', '\ufffd\ufffd'],
  ['fc80', '\ufffd\ufffd'],
  ['fe80', '\ufffd\ufffd'],
];

const BOM = [
  ['efbbbff09f92a9efbbbf', '\uFEFF\u{1F4A9}\uFEFF'], // BOM-poop-BOM
];

const streams = [
  [['c2', '80'], '\x80'],
  [['c2', '', '80'], '\x80'],
  [['e0a080'], '\u0800'],
  [['e0', 'a080'], '\u0800'],
  [['e0a0', '80'], '\u0800'],
  [['f0', '9f92a9'], '\u{1F4A9}'],
  [['f09f', '92a9'], '\u{1F4A9}'],
  [['f09f92', 'a9'], '\u{1F4A9}'],
  [['c0', ''], '\ufffd'], // Truncated
];

function fromHex(h) {
  const buf = Buffer.from(h, 'hex');
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

test('decoder', () => {
  assert.throws(() => new Wtf8Decoder('foo'), RangeError);

  const wtf = new Wtf8Decoder();
  assert(wtf);
  assert.equal(wtf.fatal, false);
  assert.equal(wtf.ignoreBOM, false);
  assert.equal(wtf.encoding, 'wtf-8');

  for (const [hex, str] of good) {
    assert.equal(wtf.decode(Buffer.from(hex, 'hex')), str, hex);
  }

  // Avoid endian problems
  assert.equal(wtf.decode(new Uint16Array([0])), '\x00\x00');
  assert.equal(wtf.decode(), '');
  assert.equal(wtf.decode(new ArrayBuffer(0)), '');

  const wtff = new Wtf8Decoder('wtf8', {fatal: true});
  for (const [hex, str] of bad) {
    const buf = Buffer.from(hex, 'hex');
    assert.equal(wtf.decode(buf), str, hex);
    assert.throws(() => wtff.decode(buf), DecodeError, hex);
  }
});

test('decoder BOM', () => {
  const wtf = new Wtf8Decoder('wtf8', {ignoreBOM: true});
  for (const [hex, str] of BOM) {
    assert.equal(wtf.decode(Buffer.from(hex, 'hex')), str, hex);
  }
});

test('decoder streaming', () => {
  const wtf = new Wtf8Decoder();

  for (const [chunks, str] of streams) {
    let res = '';
    for (let i = 0; i < chunks.length; i++) {
      const chunk = Buffer.from(chunks[i], 'hex');
      const stream = (i !== (chunks.length - 1));
      res += wtf.decode(chunk, {stream});
    }
    assert.equal(res, str);
  }
});

test('encoder', () => {
  const enc = new Wtf8Encoder();
  const short = new Uint8Array(0);
  for (const [hex, str, bom] of good) {
    if (!bom) {
      assert.deepEqual(enc.encode(str), fromHex(hex), hex);
      assert.deepEqual(enc.encodeInto(str, short), {
        read: 0,
        written: 0,
      }, hex);
    }
  }
});

test('all chars', () => {
  const enc = new Wtf8Encoder();
  const dec = new Wtf8Decoder(undefined, {ignoreBOM: true, fatal: true});
  const te = new TextEncoder();
  for (let i = 0; i <= 0x10ffff; i++) {
    const s = String.fromCodePoint(i);
    const b = enc.encode(s);
    if (i < 0xd800 || i > 0xdfff) {
      assert.deepEqual(b, te.encode(s));
    }
    const d = dec.decode(b);
    assert.equal(d, s);
  }
});
