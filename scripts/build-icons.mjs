#!/usr/bin/env node
// Décline l'icône de l'app aux tailles PWA, iOS et favicon.
//
// La source est `design/icone-source.png` (512×512, fond transparent autour du
// cercle) : un avion qui survole le globe, choisie par Florian le 29 septembre
// 2026, qui en a confirmé les droits. Changer d'icône = remplacer ce fichier et
// relancer le script.
//
// POURQUOI UN DÉCODEUR MAISON. La machine n'a ni Pillow ni ImageMagick, et une
// dépendance de traitement d'image pour cinq fichiers générés une fois serait
// disproportionnée. Node fournit `zlib` : lire et écrire un PNG RGBA tient en
// quelques dizaines de lignes, la réduction aussi.
//
// La sortie est commitée : `npm run build` n'a pas besoin de ce script.
//
//   node scripts/build-icons.mjs            → public/
//   node scripts/build-icons.mjs <dossier>  → un autre dossier (essais)

import { deflateSync, inflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(ROOT, 'design/icone-source.png');
const OUT = resolve(ROOT, process.argv[2] ?? 'public');

// Le corail du cercle de l'icône. Sous une icône qui doit être opaque (iOS,
// Android maskable), il prolonge le cercle jusqu'aux bords : le globe reste
// seul sur un fond uni, sans anneau d'une autre couleur.
const BACKGROUND = [0xff, 0x75, 0x7c];

// ---------------------------------------------------------------------------
// PNG : lecture et écriture
// ---------------------------------------------------------------------------

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Seulement ce que produisent les éditeurs pour une icône : RGBA 8 bits, non
// entrelacé. Autre chose serait refusé plutôt que mal lu.
function decodePng(buffer) {
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('Pas un PNG');
  let offset = 8;
  let header = null;
  const data = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const body = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') header = body;
    if (type === 'IDAT') data.push(body);
    offset += 12 + length;
  }
  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  const [depth, colorType, , , interlace] = header.subarray(8);
  if (depth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error(
      `PNG attendu en RGBA 8 bits non entrelacé (reçu : ${depth} bits, type ${colorType}, entrelacement ${interlace})`,
    );
  }

  // Chaque ligne est précédée de son filtre ; on le défait avec la ligne du
  // dessus et le pixel de gauche.
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * 4;
  const rgba = Buffer.alloc(height * stride);
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const current = rgba.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const left = x >= 4 ? current[x - 4] : 0;
      const up = previous[x];
      const upLeft = x >= 4 ? previous[x - 4] : 0;
      let value = line[x];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        value += pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      current[x] = value & 255;
    }
    previous = current;
  }
  return { width, height, rgba };
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // 8 bits par canal
  header[9] = 6; // RGBA
  // Filtre 0 sur chaque ligne : zlib suffit pour des icônes de cette taille.
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Réduction et composition
// ---------------------------------------------------------------------------

// Réduction par moyenne des surfaces : chaque pixel d'arrivée reçoit la part
// exacte des pixels source qu'il recouvre. En alpha prémultiplié, pour que le
// bord du cercle ne se teinte pas du blanc invisible qui l'entoure.
function resize({ width, rgba }, size) {
  const out = new Float64Array(size * size * 4);
  const ratio = width / size;
  for (let y = 0; y < size; y++) {
    const y0 = y * ratio;
    const y1 = (y + 1) * ratio;
    for (let x = 0; x < size; x++) {
      const x0 = x * ratio;
      const x1 = (x + 1) * ratio;
      const sum = [0, 0, 0, 0];
      for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy++) {
        const wy = Math.min(y1, sy + 1) - Math.max(y0, sy);
        for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx++) {
          const weight = wy * (Math.min(x1, sx + 1) - Math.max(x0, sx));
          const i = (sy * width + sx) * 4;
          const alpha = rgba[i + 3] / 255;
          sum[0] += rgba[i] * alpha * weight;
          sum[1] += rgba[i + 1] * alpha * weight;
          sum[2] += rgba[i + 2] * alpha * weight;
          sum[3] += alpha * weight;
        }
      }
      const o = (y * size + x) * 4;
      out[o + 3] = sum[3] / (ratio * ratio);
      for (let c = 0; c < 3; c++) out[o + c] = sum[3] > 0 ? sum[c] / sum[3] : 0;
    }
  }
  return out;
}

// L'icône à `size` pixels : l'image réduite à `scale` de la taille, centrée,
// sur fond transparent ou sur `background`.
function render(image, size, { scale = 1, background = null } = {}) {
  const inner = Math.round(size * scale);
  const small = resize(image, inner);
  const shift = Math.round((size - inner) / 2);
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const o = (y * size + x) * 4;
      const sx = x - shift;
      const sy = y - shift;
      const inside = sx >= 0 && sy >= 0 && sx < inner && sy < inner;
      const i = (sy * inner + sx) * 4;
      const alpha = inside ? small[i + 3] : 0;
      if (background) {
        for (let c = 0; c < 3; c++) {
          const top = inside ? small[i + c] : 0;
          rgba[o + c] = Math.round(background[c] + (top - background[c]) * alpha);
        }
        rgba[o + 3] = 255;
      } else {
        for (let c = 0; c < 3; c++) rgba[o + c] = Math.round(inside ? small[i + c] : 0);
        rgba[o + 3] = Math.round(alpha * 255);
      }
    }
  }
  return encodePng(size, size, rgba);
}

// ---------------------------------------------------------------------------

const targets = [
  // Onglet du navigateur : le cercle seul, sur fond transparent.
  ['favicon-32.png', 32, {}],
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  // Maskable : Android peut rogner en cercle ; le dessin tient dans ses 80 %,
  // et le corail remplit le reste.
  ['icon-maskable-512.png', 512, { scale: 0.8, background: BACKGROUND }],
  // iOS pose un fond noir sous la transparence et arrondit lui-même les coins :
  // l'icône est opaque, le corail prolonge le cercle.
  ['apple-touch-icon.png', 180, { background: BACKGROUND }],
];

const source = decodePng(readFileSync(SOURCE));
mkdirSync(OUT, { recursive: true });
for (const [name, size, options] of targets) {
  const png = render(source, size, options);
  writeFileSync(resolve(OUT, name), png);
  process.stdout.write(`${name.padEnd(24)} ${size}×${size}  ${(png.length / 1024).toFixed(1)} Ko\n`);
}
