import {Buffer} from 'node:buffer';
import {Wtf8EncoderStream} from '../lib/encodeStream.js';
import assert from 'node:assert';
import test from 'node:test';

async function streamChunks(chunks, expected) {
  const ds = new Wtf8EncoderStream();

  const res = [];
  const ws = new WritableStream({
    write(s) {
      res.push(s);
    },
  });

  ds.readable.pipeTo(ws);
  const w = ds.writable.getWriter();
  for (const c of chunks) {
    await w.write(c);
  }
  await w.close();
  assert.equal(Buffer.concat(res).toString('hex'), expected);
}

test('Web streams', async () => {
  await streamChunks(['\u{1F4A9}'], 'f09f92a9');
  await streamChunks(['\ud83d', '\udca9', '\ud800'], 'f09f92a9eda080');

  const ds = new Wtf8EncoderStream();
  assert.equal(ds.encoding, 'wtf-8');
});
