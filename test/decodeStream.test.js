import {Buffer} from 'node:buffer';
import {Wtf8DecoderStream} from '../lib/decodeStream.js';
import assert from 'node:assert';
import test from 'node:test';

async function streamChunks(chunks, expected) {
  const ds = new Wtf8DecoderStream();

  let res = '';
  const ws = new WritableStream({
    write(s) {
      res += s;
    },
  });

  ds.readable.pipeTo(ws);
  const w = ds.writable.getWriter();
  for (const c of chunks) {
    await w.write(Buffer.from(c, 'hex'));
  }
  await w.close();
  assert.equal(res, expected);
}

test('Web streams', async() => {
  await streamChunks(['f0', '9f92a9'], '\u{1F4A9}');
  await streamChunks(['f0', '9f92'], '\ufffd\ufffd\ufffd');

  const ds = new Wtf8DecoderStream();
  assert.equal(ds.encoding, 'wtf-8');
  assert.equal(ds.fatal, false);
  assert.equal(ds.ignoreBOM, false);
});
