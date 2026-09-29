#!/usr/bin/env node
// Génère les icônes de l'app (PWA + écran d'accueil iOS) et le favicon SVG.
//
// POURQUOI UN ENCODEUR MAISON. La machine n'a ni rastériseur SVG ni Pillow, et
// une dépendance de rendu d'image pour cinq fichiers générés une fois serait
// disproportionnée. Node fournit `zlib` ; il ne manquait qu'un encodeur PNG,
// et un PNG sans compression fine tient en quelques dizaines de lignes.
//
// UNE SEULE SCÈNE, DEUX SORTIES. Les formes sont décrites une fois (SCENE) :
// le rendu PNG les dessine pixel par pixel, le favicon SVG les recopie telles
// quelles. Les deux ne peuvent pas diverger.
//
// La sortie est commitée : `npm run build` n'a pas besoin de ce script.
//
//   node scripts/build-icons.mjs            → public/
//   node scripts/build-icons.mjs <dossier>  → un autre dossier (essais)

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, process.argv[2] ?? 'public');

// ---------------------------------------------------------------------------
// La scène — en centièmes de l'icône
// ---------------------------------------------------------------------------
//
// L'icône porte l'APPLICATION, pas un voyage. Un mont Fuji marquerait tout
// l'outil comme japonais, alors que la charte pays ne vaut qu'à l'intérieur
// d'un voyage — et que le projet doit devenir un créateur d'itinéraires.
//
// D'où un signe de voyage générique (29 septembre 2026) : un avion en papier
// qui s'envole d'une épingle en laissant un trajet en pointillés — le départ,
// la route, l'élan. Le ciel reprend le bleu du thème « neutral » ; l'épingle,
// une note chaude pour que l'icône se repère dans une rangée d'apps.

const SKY_TOP = '#3c74aa';
const SKY_BOTTOM = '#234869'; // $blue-dark du thème « neutral »
const PAPER = '#ffffff';
const PAPER_SHADE = '#cfdceb';
const PIN = '#f2994a';
const TRAIL = 'rgba(255,255,255,0.75)';

// L'avion : le pliage classique, deux facettes de part et d'autre du pli —
// l'aile claire au-dessus, le dessous dans l'ombre.
const NOSE = [84, 16];
const WING = [48, 32];
const FOLD = [64, 40];
const TAIL = [71, 58];

// L'épingle : une goutte, pointe en bas, et son œil.
const PIN_CENTER = [28, 62];
const PIN_RADIUS = 13;
const PIN_TIP = [28, 89];
const PIN_EYE = 5;

// Le trajet : un arc qui part de l'épingle et rejoint l'arrière de l'avion,
// dans le sens de son vol.
const TRAIL_PATH = { from: [44, 60], controls: [[58, 66], [56, 50], [61, 45]] };
const TRAIL_WIDTH = 3.6;
const TRAIL_DASH = [5, 5];

// La goutte de l'épingle : le cercle, et les deux tangentes qui descendent
// vers la pointe.
function teardrop([cx, cy], r, [tx, ty], steps = 48) {
  const d = Math.hypot(tx - cx, ty - cy);
  const toTip = Math.atan2(ty - cy, tx - cx);
  const half = Math.acos(r / d); // angle entre l'axe et chaque point de tangence
  const points = [[tx, ty]];
  // L'arc parcouru va d'une tangence à l'autre en passant par le haut.
  const start = toTip + half;
  const end = toTip - half + Math.PI * 2;
  for (let i = 0; i <= steps; i++) {
    const a = start + ((end - start) * i) / steps;
    points.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return points;
}

// Le centre du dessin, ramené au centre de l'icône, et son agrandissement par
// cible (voir `targets`).
const SCENE_CENTER = [51, 52.5];

const SCENE = [
  { kind: 'dashed', ...TRAIL_PATH, width: TRAIL_WIDTH, dash: TRAIL_DASH, color: TRAIL },
  { kind: 'polygon', points: teardrop(PIN_CENTER, PIN_RADIUS, PIN_TIP), color: PIN },
  { kind: 'circle', center: PIN_CENTER, radius: PIN_EYE, color: PAPER },
  { kind: 'polygon', points: [NOSE, WING, FOLD], color: PAPER },
  { kind: 'polygon', points: [NOSE, FOLD, TAIL], color: PAPER_SHADE },
];

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
// Géométrie
//
// Champ de distance plutôt que rastérisation de primitives : pour chaque
// pixel on calcule sa distance signée à chaque forme (négative dedans), ce qui
// donne un anticrénelage propre sans bibliothèque graphique.
// ---------------------------------------------------------------------------

function distanceToSegment(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Distance signée à un polygone : la plus courte distance à un bord, négative
// si le point est à l'intérieur (règle pair-impair).
function distanceToPolygon(px, py, points) {
  let distance = Infinity;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    distance = Math.min(distance, distanceToSegment(px, py, points[i], points[j]));
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside ? -distance : distance;
}

// Les traits d'une courbe en pointillés, découpés comme le ferait
// `stroke-dasharray` : la même longueur de trait et d'espace, depuis le début.
// Courbe de Bézier cubique : `controls` = [premier contrôle, second, arrivée].
function dashSegments({ from, controls: [c1, c2, to], dash: [on, off] }, steps = 320) {
  const at = (t) => {
    const u = 1 - t;
    return [0, 1].map((k) => u ** 3 * from[k] + 3 * u * u * t * c1[k] + 3 * u * t * t * c2[k] + t ** 3 * to[k]);
  };
  const samples = Array.from({ length: steps + 1 }, (_, i) => at(i / steps));
  const segments = [];
  let travelled = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    const middle = travelled + Math.hypot(b[0] - a[0], b[1] - a[1]) / 2;
    if (middle % (on + off) < on) segments.push([a, b]);
    travelled += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return segments;
}

function parseColor(color) {
  if (color.startsWith('#')) {
    const n = Number.parseInt(color.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const [r, g, b, a = 1] = color.match(/[\d.]+/g).map(Number);
  return [r, g, b, a];
}

// ---------------------------------------------------------------------------
// Rendu PNG
// ---------------------------------------------------------------------------

// `zoom` agrandit ou resserre le dessin autour de son centre : resserré pour
// une icône maskable, qu'Android peut rogner jusqu'à un cercle de 80 %.
function drawPng(size, zoom) {
  const rgba = Buffer.alloc(size * size * 4);
  const unit = size / 100;
  const scale = zoom;
  // Des centièmes de l'icône aux pixels.
  const toPx = ([x, y]) => [(50 + (x - SCENE_CENTER[0]) * scale) * unit, (50 + (y - SCENE_CENTER[1]) * scale) * unit];

  const shapes = SCENE.map((shape) => {
    const color = parseColor(shape.color);
    if (shape.kind === 'polygon') {
      const points = shape.points.map(toPx);
      return { color, distance: (px, py) => distanceToPolygon(px, py, points) };
    }
    if (shape.kind === 'circle') {
      const [cx, cy] = toPx(shape.center);
      const radius = shape.radius * scale * unit;
      return { color, distance: (px, py) => Math.hypot(px - cx, py - cy) - radius };
    }
    const segments = dashSegments(shape).map(([a, b]) => [toPx(a), toPx(b)]);
    const half = (shape.width / 2) * scale * unit;
    return {
      color,
      distance: (px, py) => Math.min(...segments.map(([a, b]) => distanceToSegment(px, py, a, b))) - half,
    };
  });

  const top = parseColor(SKY_TOP);
  const bottom = parseColor(SKY_BOTTOM);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      // Le ciel : un dégradé en diagonale, clair en haut à gauche.
      const t = (px + py) / (2 * size);
      const pixel = [0, 1, 2].map((c) => top[c] + (bottom[c] - top[c]) * t);

      for (const { color, distance } of shapes) {
        // Transition sur un pixel : en deçà on est dans la forme, au-delà
        // dehors, entre les deux on mélange.
        const coverage = Math.max(0, Math.min(1, 0.5 - distance(px, py))) * color[3];
        if (coverage === 0) continue;
        for (let c = 0; c < 3; c++) pixel[c] += (color[c] - pixel[c]) * coverage;
      }

      const offset = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) rgba[offset + c] = Math.round(pixel[c]);
      rgba[offset + 3] = 255; // opaque : iOS compose un fond noir sous la transparence
    }
  }

  return encodePng(size, size, rgba);
}

// ---------------------------------------------------------------------------
// Favicon SVG — net à toutes les tailles d'onglet, coins arrondis
// ---------------------------------------------------------------------------

const round = (n) => Math.round(n * 100) / 100;
const pointsAttr = (points) => points.map(([x, y]) => `${round(x)},${round(y)}`).join(' ');

// Agrandi : dans un onglet, à 16 px, chaque pixel compte.
const SVG_ZOOM = 1.12;

function drawSvg() {
  const body = SCENE.map((shape) => {
    if (shape.kind === 'polygon') return `<polygon points="${pointsAttr(shape.points)}" fill="${shape.color}"/>`;
    if (shape.kind === 'circle') {
      return `<circle cx="${shape.center[0]}" cy="${shape.center[1]}" r="${shape.radius}" fill="${shape.color}"/>`;
    }
    const { from, controls } = shape;
    return (
      `<path d="M${from} C${controls.join(' ')}" fill="none" stroke="${shape.color}" ` +
      `stroke-width="${shape.width}" stroke-linecap="round" stroke-dasharray="${shape.dash.join(' ')}"/>`
    );
  });
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
    `<defs><linearGradient id="ciel" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0" stop-color="${SKY_TOP}"/><stop offset="1" stop-color="${SKY_BOTTOM}"/></linearGradient></defs>`,
    '<rect width="100" height="100" rx="22" fill="url(#ciel)"/>',
    `<g transform="translate(50 50) scale(${SVG_ZOOM}) translate(${-SCENE_CENTER[0]} ${-SCENE_CENTER[1]})">`,
    ...body,
    '</g>',
    '</svg>',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------

const targets = [
  ['icon-192.png', 192, 1.08],
  ['icon-512.png', 512, 1.08],
  // Maskable : Android peut rogner en cercle, le signe tient dans ses 80 %.
  ['icon-maskable-512.png', 512, 0.8],
  // iOS ignore les icônes du manifest pour l'écran d'accueil et lit ce fichier.
  ['apple-touch-icon.png', 180, 1.08],
];

mkdirSync(OUT, { recursive: true });
for (const [name, size, zoom] of targets) {
  const png = drawPng(size, zoom);
  writeFileSync(resolve(OUT, name), png);
  process.stdout.write(`${name.padEnd(24)} ${size}×${size}  ${(png.length / 1024).toFixed(1)} Ko\n`);
}
const svg = drawSvg();
writeFileSync(resolve(OUT, 'favicon.svg'), svg);
process.stdout.write(`${'favicon.svg'.padEnd(24)} ${(svg.length / 1024).toFixed(1)} Ko\n`);
