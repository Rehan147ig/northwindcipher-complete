// Renders every Office-cast character (portrait bust + full-body front/back sprite) to PNG files.
// The characters are drawn procedurally in src/renderer/src/scene/office/portraitArt.ts (original art, no third-party
// licence), so this needs no browser: the drawing code is loaded directly and its pixel buffers are written as PNGs.
//   npm run avatars:extract            -> docs/community/avatars/
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const loadTs = require(join(root, 'test', 'load-ts.cjs'));

// --- minimal PNG encoder (RGBA, 8-bit) ---
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
// Nearest-neighbour upscale keeps the pixel art sharp.
function upscale(w, h, rgba, k) {
  const out = new Uint8ClampedArray(w * k * h * k * 4);
  for (let y = 0; y < h * k; y++) for (let x = 0; x < w * k; x++) {
    const s = ((Math.floor(y / k) * w) + Math.floor(x / k)) * 4, d = (y * w * k + x) * 4;
    out[d] = rgba[s]; out[d + 1] = rgba[s + 1]; out[d + 2] = rgba[s + 2]; out[d + 3] = rgba[s + 3];
  }
  return out;
}

// --- load the drawing code. paintPortrait wants a canvas, so give it a tiny stand-in that captures the pixels. ---
let captured = null;
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({
  createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  putImageData: (img) => { captured = new Uint8ClampedArray(img.data); },
}) }) };
const art = loadTs(join(root, 'src/renderer/src/scene/office/portraitArt.ts'));
const { PORTRAIT_W: PW, PORTRAIT_H: PH, SCENE_W: SW, SCENE_H: SH } = art;
const fakeCtx = { imageSmoothingEnabled: false, clearRect() {}, drawImage() {} };

// Cast metadata comes straight from cast.ts (it imports Pixi, so it is read as text instead of executed).
const castSrc = readFileSync(join(root, 'src/renderer/src/scene/office/cast.ts'), 'utf8');
const cast = [...castSrc.matchAll(/\{\s*name:\s*'(\w+)',\s*displayName:\s*'([^']+)',\s*shirt:\s*'(#[0-9a-fA-F]{6})',\s*blurb:\s*(?:"([^"]*)"|'([^']*)')\s*\}/g)]
  .map((m) => ({ name: m[1], displayName: m[2], shirt: m[3], blurb: m[4] ?? m[5] }));
if (!cast.length) throw new Error('Could not read the cast list from cast.ts');

const outDir = join(root, 'docs', 'community', 'avatars');
mkdirSync(outDir, { recursive: true });
const manifest = [];
const SCALE = 8;

for (const c of cast) {
  captured = null;
  art.paintPortrait(fakeCtx, c.name, 1);
  const portrait = captured;
  const frames = art.sceneFrameBufs(c.name);
  const files = {};
  const save = (label, w, h, px) => {
    writeFileSync(join(outDir, `${c.name}-${label}.png`), encodePng(w, h, px));
    writeFileSync(join(outDir, `${c.name}-${label}@${SCALE}x.png`), encodePng(w * SCALE, h * SCALE, upscale(w, h, px, SCALE)));
    files[label] = [`${c.name}-${label}.png`, `${c.name}-${label}@${SCALE}x.png`];
  };
  save('portrait', PW, PH, portrait);
  save('full-front', SW, SH, frames.front[0]);
  save('full-back', SW, SH, frames.back[0]);
  manifest.push({ ...c, size: { portrait: [PW, PH], full: [SW, SH] }, files });
  c.portrait = portrait;
}

// Contact sheet: every portrait at 6x on a cream background, in a 5-column grid.
const K = 6, cols = 5, pad = 14, cellW = PW * K + pad, cellH = PH * K + pad;
const rows = Math.ceil(cast.length / cols), sw = cols * cellW + pad, sh = rows * cellH + pad;
const sheet = new Uint8ClampedArray(sw * sh * 4);
for (let i = 0; i < sheet.length; i += 4) { sheet[i] = 250; sheet[i + 1] = 248; sheet[i + 2] = 241; sheet[i + 3] = 255; }
cast.forEach((c, n) => {
  const ox = pad + (n % cols) * cellW, oy = pad + Math.floor(n / cols) * cellH;
  for (let y = 0; y < PH * K; y++) for (let x = 0; x < PW * K; x++) {
    const s = ((Math.floor(y / K) * PW) + Math.floor(x / K)) * 4;
    const a = c.portrait[s + 3] / 255;
    if (!a) continue;
    const d = ((oy + y) * sw + ox + x) * 4;
    for (let ch = 0; ch < 3; ch++) sheet[d + ch] = Math.round(c.portrait[s + ch] * a + sheet[d + ch] * (1 - a));
  }
});
writeFileSync(join(outDir, 'avatars-sheet.png'), encodePng(sw, sh, sheet));
writeFileSync(join(outDir, 'avatars.json'), JSON.stringify({ generatedBy: 'scripts/extract-avatars.mjs', source: 'src/renderer/src/scene/office/portraitArt.ts', characters: manifest }, null, 2) + '\n');
console.log(`Wrote ${cast.length} characters (portrait, full-front, full-back at 1x and ${SCALE}x), avatars-sheet.png and avatars.json to ${outDir}`);
