import {DecodeError, Wtf8Decoder} from '../lib/index.js';
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
  ['efbfbf', '\uffff'],
  ['f09f92a9', '\u{1F4A9}'],
  ['efbbbff09f92a9efbbbf', '\u{1F4A9}\uFEFF'], // BOM-poop-BOM
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
