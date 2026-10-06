/* Draws the app icons as PNG files with no dependencies. */
const zlib = require('zlib'), fs = require('fs'), path = require('path');
function crc(buf) { let c, n, k, t = crc.t || (crc.t = (() => { const a = []; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; a[n] = c >>> 0; } return a; })()); c = 0xffffffff; for (n = 0; n < buf.length; n++) c = t[(c ^ buf[n]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); }
// Island outline in a 512 box (same path as the SVG, flattened).
const island = [[112, 300], [160, 286], [205, 262], [252, 248], [290, 244], [320, 224], [368, 192], [412, 152], [400, 222], [372, 240], [345, 274], [310, 292], [250, 312], [180, 326], [112, 300]];
function inPoly(x, y, p) { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; } return c; }
function draw(size, pad, round) {
  const raw = Buffer.alloc((size * 4 + 1) * size), ss = 3;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const px = (x + (sx + 0.5) / ss) / size * 512, py = (y + (sy + 0.5) / ss) / size * 512;
        // content is scaled into the safe area for maskable icons
        const u = (px - 256) / (1 - pad) + 256, v = (py - 256) / (1 - pad) + 256;
        let col = [15, 42, 61], al = 1;
        if (round) { const rx = Math.max(0, Math.abs(px - 256) - (256 - 112)), ry = Math.max(0, Math.abs(py - 256) - (256 - 112)); if (rx * rx + ry * ry > 112 * 112) al = 0; }
        if (u >= 96 && u < 416 && v >= 96 && v < 416) { const cx = Math.floor((u - 96) / 80), cy = Math.floor((v - 96) / 80); if ((cx + cy) % 2 === 0) col = [181, 101, 43]; }
        if (inPoly(u, v, island)) col = [255, 255, 255];
        r += col[0] * al; g += col[1] * al; b += col[2] * al; a += al;
      }
      const n = ss * ss, o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = a ? r / a : 0; raw[o + 1] = a ? g / a : 0; raw[o + 2] = a ? b / a : 0; raw[o + 3] = a / n * 255;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const out = path.join(__dirname, '..', 'icons');
[['icon-192.png', 192, 0, true], ['icon-512.png', 512, 0, true], ['maskable-512.png', 512, 0.22, false], ['icon-180.png', 180, 0.08, false]].forEach(([n, s, p, r]) => { fs.writeFileSync(path.join(out, n), draw(s, p, r)); console.log(n, fs.statSync(path.join(out, n)).size); });
