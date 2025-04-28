import {ByteStream} from '../lib/bytestream.js';
import assert from 'node:assert';
import test from 'node:test';

test('create', () => {
  let bs = new ByteStream();
  assert(bs);
  assert(bs.empty);
  bs = new ByteStream(new Uint8Array(0));
  assert(bs.empty);
  bs = new ByteStream(new Uint8Array(10));
  assert(!bs.empty);
  bs = new ByteStream(new Uint16Array(10));
  assert(!bs.empty);
  bs = new ByteStream(new ArrayBuffer(10));
  assert(!bs.empty);
});

test('push', () => {
  const bs = new ByteStream();
  assert(bs.empty);
  bs.push(new Uint8Array(0));
  assert(bs.empty);
  bs.push(new Uint8Array(10));
  assert(!bs.empty);
});

test('shift', () => {
  const bs = new ByteStream();

  assert.throws(() => bs.shift(0), RangeError);
  assert.equal(bs.shift().length, 0);
  bs.push(new Uint8Array([1, 2, 3]));
  assert.deepEqual(bs.shift(), new Uint8Array([1]));
  assert.equal(bs.shift(3).length, 0);
  assert.deepEqual(bs.shift(2), new Uint8Array([2, 3]));
  bs.push(new Uint8Array([1, 2, 3]));
  bs.push(new Uint8Array([4, 5, 6]));
  assert.deepEqual(bs.shift(5), new Uint8Array([1, 2, 3, 4, 5]));
  assert.deepEqual(bs.shift(1), new Uint8Array([6]));
});

test('peek', () => {
  const bs = new ByteStream();
  assert.equal(bs.peek(), undefined);
  bs.push(new Uint8Array([1, 2]));
  bs.push(new Uint8Array([3]));
  assert.equal(bs.peek(), 1);
  bs.shift();
  assert.equal(bs.peek(), 2);
  bs.shift();
  assert.equal(bs.peek(), 3);
  bs.shift();
  assert.equal(bs.peek(), undefined);
});

test('unshift', () => {
  const bs = new ByteStream();
  bs.unshift(1, 2);
  assert.equal(bs.length, 2);
});
