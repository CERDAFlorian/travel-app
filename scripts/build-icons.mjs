#!/usr/bin/env node
// Génère les icônes de l'app (PWA + écran d'accueil iOS).
//
// POURQUOI UN ENCODEUR MAISON. La machine n'a ni rastériseur SVG ni Pillow, et
// une dépendance de rendu d'image pour quatre fichiers générés une fois serait
// disproportionnée. Node fournit `zlib` ; il ne manquait qu'un encodeur PNG,
// et un PNG sans compression fine tient en quelques dizaines de lignes.
//
// La sortie est commitée : `npm run build` n'a pas besoin de ce script.
//
//   node scripts/build-icons.mjs

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// L'icône porte l'APPLICATION, pas un voyage. Un mont Fuji marquerait tout
// l'outil comme japonais, alors que la charte pays ne vaut qu'à l'intérieur
// d'un voyage — et que le projet doit devenir un créateur d'itinéraires.
// D'où un signe générique : trois étapes reliées par un trajet.
const INK = [0x2f, 0x5d, 0x8c]; // accent du thème « neutral »
const MARK = [0xf6, 0xf7, 0xf8]; // fond du thème « neutral »

// ---------------------------------------------------------------------------
// Encodage PNG
// ---------------------------------------------------------------------------

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
  // Une ligne de pixels est préfixée d'un octet de filtre. 0 = aucun filtre :
  // on laisse zlib faire le travail, l'image est trop simple pour que les
  // filtres prédictifs changent quoi que ce soit.
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Dessin
//
// Champ de distance plutôt que rastérisation de primitives : pour chaque
// pixel on calcule sa distance au trait le plus proche, ce qui donne un
// anticrénelage propre sans supposer de bibliothèque graphique.
// ---------------------------------------------------------------------------

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// `inset` réserve la zone de sécurité des icônes maskables : Android peut
// rogner jusqu'à 20 % de chaque bord, le signe doit tenir à l'intérieur.
function draw(size, inset) {
  const rgba = Buffer.alloc(size * size * 4);
  const s = size / 100; // échelle : on raisonne en centièmes de l'icône
  const scale = 1 - inset;
  const center = 50;
  const at = (x, y) => [(center + (x - center) * scale) * s, (center + (y - center) * scale) * s];

  // Trois étapes en zigzag : c'est un itinéraire, pas une destination.
  const nodes = [at(26, 68), at(50, 34), at(74, 62)];
  const nodeRadius = 9 * s * scale;
  const strokeRadius = 4 * s * scale;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;

      let distance = Infinity;
      for (let i = 0; i < nodes.length - 1; i++) {
        distance = Math.min(
          distance,
          distanceToSegment(px, py, nodes[i][0], nodes[i][1], nodes[i + 1][0], nodes[i + 1][1]) - strokeRadius,
        );
      }
      for (const [nx, ny] of nodes) {
        distance = Math.min(distance, Math.hypot(px - nx, py - ny) - nodeRadius);
      }

      // Transition sur un pixel : en deçà on est dans le signe, au-delà dans
      // le fond, entre les deux on mélange.
      const coverage = Math.max(0, Math.min(1, 0.5 - distance));
      const offset = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) {
        rgba[offset + c] = Math.round(INK[c] + (MARK[c] - INK[c]) * coverage);
      }
      rgba[offset + 3] = 255; // opaque : iOS compose un fond noir sous la transparence
    }
  }

  return encodePng(size, size, rgba);
}

const targets = [
  ['public/icon-192.png', 192, 0.12],
  ['public/icon-512.png', 512, 0.12],
  // Maskable : Android rogne les coins, le signe est rentré davantage.
  ['public/icon-maskable-512.png', 512, 0.26],
  // iOS ignore les icônes du manifest pour l'écran d'accueil et lit ce fichier.
  ['public/apple-touch-icon.png', 180, 0.12],
];

for (const [rel, size, inset] of targets) {
  const png = draw(size, inset);
  writeFileSync(resolve(ROOT, rel), png);
  process.stdout.write(`${rel.padEnd(32)} ${size}×${size}  ${(png.length / 1024).toFixed(1)} Ko\n`);
}
