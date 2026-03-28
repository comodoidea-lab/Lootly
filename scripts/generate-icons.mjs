/**
 * PNG icon generator using only Node.js built-ins.
 * Run: node scripts/generate-icons.mjs
 * Requires: Node.js 18+
 */
import { writeFileSync } from 'node:fs';
import zlib from 'node:zlib';

function createPNG(size) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeBuffer = Buffer.from(type);
    const crc = crc32(Buffer.concat([typeBuffer, data]));
    const crcBuffer = Buffer.alloc(4);
    crcBuffer.writeUInt32BE(crc >>> 0);
    return Buffer.concat([len, typeBuffer, data, crcBuffer]);
  }

  function crc32(buf) {
    let crc = 0xffffffff;
    const table = makeCRCTable();
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ 0xffffffff);
  }

  function makeCRCTable() {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c;
    }
    return table;
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Draw pixels
  const bg = [17, 17, 17]; // #111111
  const orange = [249, 115, 22]; // #f97316
  const radius = size * 0.195; // rounded corner radius

  const pixels = [];
  for (let y = 0; y < size; y++) {
    const row = [0]; // filter byte
    for (let x = 0; x < size; x++) {
      const cx = x - size / 2;
      const cy = y - size / 2;
      const hw = size / 2;

      // Rounded rect check
      const rx = hw - radius;
      const ry = hw - radius;
      const dx = Math.max(0, Math.abs(cx) - rx);
      const dy = Math.max(0, Math.abs(cy) - ry);
      const inRect = (dx * dx + dy * dy) <= radius * radius;

      if (!inRect) {
        row.push(0, 0, 0); // transparent -> black outside
        continue;
      }

      // "L" shape
      const lx1 = size * 0.302;
      const lx2 = size * 0.445;
      const lx3 = size * 0.723;
      const ly1 = size * 0.195;
      const ly2 = size * 0.781;
      const ly3 = size * 0.645;

      const inL =
        (x >= lx1 && x <= lx2 && y >= ly1 && y <= ly2) || // vertical bar
        (x >= lx1 && x <= lx3 && y >= ly3 && y <= ly2); // horizontal bar

      if (inL) {
        row.push(...orange);
      } else {
        row.push(...bg);
      }
    }
    pixels.push(Buffer.from(row));
  }

  const raw = Buffer.concat(pixels);
  const compressed = zlib.deflateSync(raw);
  const idat = chunk('IDAT', compressed);
  const iend = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, chunk('IHDR', ihdr), idat, iend]);
}

writeFileSync('public/icon-192.png', createPNG(192));
writeFileSync('public/icon-512.png', createPNG(512));
console.log('Icons generated: public/icon-192.png, public/icon-512.png');
