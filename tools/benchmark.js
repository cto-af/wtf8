/* eslint-disable no-console */
import {Wtf8Decoder, Wtf8Encoder} from '../lib/index.js';
import fs from 'node:fs';
import nodemark from 'nodemark';

const buf = fs.readFileSync(new URL('./wtf.txt', import.meta.url));

const uAll = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);

const result = nodemark(() => {
  const dec = new Wtf8Decoder();
  const enc = new Wtf8Encoder();
  const str = dec.decode(uAll);
  enc.encode(str);
}, undefined, 10000);
console.log(result);
