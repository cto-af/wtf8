import {Wtf8Encoder} from '../lib/index.js';
import fs from 'node:fs';
import {randomInt} from 'node:crypto';

const out = fs.createWriteStream(new URL('./wtf.txt', import.meta.url));
const enc = new Wtf8Encoder();

const size = 0x100000;
let num = 0;

for (let i = 0; i < size; i++) {
  switch (i % 4) {
    case 0:
      num = randomInt(0x7f);
      break;
    case 1:
      num = randomInt(0x77f) + 0x80;
      break;
    case 2:
      num = randomInt(0xf7ff) + 0x800;
      break;
    case 3:
      num = randomInt(0xfffff) + 0x10000;
      break;
    default:
      throw new Error('no');
  }
  const buf = enc.encode(String.fromCodePoint(num));
  out.write(buf);
}
out.close();
