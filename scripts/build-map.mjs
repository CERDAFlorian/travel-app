#!/usr/bin/env node
// Génère le fond de carte du Japon, embarqué dans le bundle.
//
// POURQUOI CE SCRIPT EXISTE. Le design télécharge world-atlas depuis un CDN au
// montage du composant. Hors ligne au Japon, la carte ne s'affiche pas — soit
// exactement la situation pour laquelle cette app est écrite. La géométrie doit
// donc vivre dans le bundle.
//
// Il ne tourne QUE quand on veut régénérer la carte, jamais au build : sa
// sortie est commitée. `npm run build` n'a pas besoin de réseau.
//
// Aucune dépendance : le décodage TopoJSON et la projection de Mercator sont
// écrits ici. Ajouter d3-geo et topojson-client pour trente lignes de calcul
// utilisées une fois n'en vaut pas le prix.
//
//   node scripts/build-map.mjs [110m|50m]

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Cadre visible, repris du design (japan-map.jsx) : il coupe Hokkaidō au nord
// et Okinawa au sud, qui ne sont pas sur l'itinéraire.
const BBOX = [
  [130.0, 32.0],
  [142.6, 38.8],
];
const WIDTH = 620;
const HEIGHT = 420;
const PADDING = 14;
const JAPAN_ID = '392'; // code ISO 3166-1 numérique
const MARGIN = 60; // tolérance de découpe, en unités du viewBox

// ---------------------------------------------------------------------------
// TopoJSON : les arcs sont quantifiés et delta-encodés. On les ramène en
// coordonnées géographiques absolues.
// ---------------------------------------------------------------------------
function decodeArcs(topology) {
  const { scale, translate } = topology.transform;

  return topology.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
    });
  });
}

// Un index négatif désigne l'arc ~i parcouru à l'envers. Les arcs consécutifs
// partagent leur point de jonction : on retire le doublon en concaténant.
function ringOf(arcIndexes, arcs) {
  const points = [];

  for (const index of arcIndexes) {
    const reversed = index < 0;
    const arc = arcs[reversed ? ~index : index];
    const segment = reversed ? [...arc].reverse() : arc;
    points.push(...(points.length ? segment.slice(1) : segment));
  }
  return points;
}

// ---------------------------------------------------------------------------
// Mercator, ajusté au cadre — équivalent de geoMercator().fitExtent().
// ---------------------------------------------------------------------------
const rawX = (lng) => (lng * Math.PI) / 180;
const rawY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

function fitProjection() {
  const xs = BBOX.map(([lng]) => rawX(lng));
  // L'axe écran descend quand la latitude monte : on inverse tout de suite.
  const ys = BBOX.map(([, lat]) => -rawY(lat));

  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);

  const frameW = WIDTH - PADDING * 2;
  const frameH = HEIGHT - PADDING * 2;

  // Le plus petit des deux facteurs : le cadre contient la zone entière plutôt
  // que de la rogner, et le rapport d'aspect est préservé.
  const scale = Math.min(frameW / (x1 - x0), frameH / (y1 - y0));

  return {
    scale,
    translateX: PADDING + (frameW - scale * (x1 - x0)) / 2 - scale * x0,
    translateY: PADDING + (frameH - scale * (y1 - y0)) / 2 - scale * y0,
  };
}

const project = ({ scale, translateX, translateY }, [lng, lat]) => [
  scale * rawX(lng) + translateX,
  scale * -rawY(lat) + translateY,
];

// ---------------------------------------------------------------------------

async function main() {
  const resolution = process.argv[2] ?? '110m';
  const url = `https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-${resolution}.json`;

  process.stdout.write(`Téléchargement de ${url}\n`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`world-atlas a répondu ${response.status}`);
  const topology = await response.json();

  const arcs = decodeArcs(topology);
  const japan = topology.objects.countries.geometries.find((g) => g.id === JAPAN_ID);
  if (!japan) throw new Error(`Pays ${JAPAN_ID} absent de countries-${resolution}`);

  const projection = fitProjection();
  const polygons = japan.type === 'MultiPolygon' ? japan.arcs : [japan.arcs];

  let rings = 0;
  let points = 0;
  let skipped = 0;
  const parts = [];

  for (const polygon of polygons) {
    for (const ringArcs of polygon) {
      const ring = ringOf(ringArcs, arcs).map((coord) => project(projection, coord));

      // Une décimale : au-delà, on stocke du bruit sous le pixel.
      const rounded = ring.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`);

      // On écarte les îlots réduits à un point ou deux après projection : ils
      // n'apparaissent pas et alourdissent le chemin.
      if (rounded.length < 3) continue;

      // Et ceux qui tombent entièrement hors du cadre — Hokkaidō, Okinawa, les
      // îles Ogasawara. Le zoom ne descend jamais sous 1, donc rien au-delà du
      // viewBox n'est atteignable. La marge couvre les traits de côte qui
      // affleurent le bord.
      const xsOf = ring.map(([x]) => x);
      const ysOf = ring.map(([, y]) => y);
      const outside =
        Math.max(...xsOf) < -MARGIN ||
        Math.min(...xsOf) > WIDTH + MARGIN ||
        Math.max(...ysOf) < -MARGIN ||
        Math.min(...ysOf) > HEIGHT + MARGIN;
      if (outside) {
        skipped += 1;
        continue;
      }

      rings += 1;
      points += rounded.length;
      parts.push(`M${rounded.join('L')}Z`);
    }
  }

  const path = parts.join('');

  const output = `// GÉNÉRÉ par scripts/build-map.mjs — ne pas modifier à la main.
// Source : world-atlas ${resolution} (Natural Earth, domaine public).
// Relancer avec : node scripts/build-map.mjs ${resolution}
//
// La géométrie est embarquée plutôt que téléchargée : hors ligne au Japon, un
// fetch vers un CDN ne répond pas, et la carte est précisément ce qu'on veut
// pouvoir consulter là-bas.

export const MAP_WIDTH = ${WIDTH};
export const MAP_HEIGHT = ${HEIGHT};

// Paramètres de la projection ayant servi à tracer le chemin ci-dessous.
// projectPoint() dans src/lib/projection.js les réutilise pour placer les
// ancres : sans cela les points ne tomberaient pas sur les côtes.
export const PROJECTION = {
  scale: ${projection.scale},
  translateX: ${projection.translateX},
  translateY: ${projection.translateY},
};

export const JAPAN_PATH =
  '${path}';
`;

  const target = resolve(ROOT, 'src/data/japan-geometry.js');
  writeFileSync(target, output, 'utf8');

  const kb = (Buffer.byteLength(output, 'utf8') / 1024).toFixed(1);
  process.stdout.write(
    `\n${rings} anneaux gardés, ${skipped} hors cadre écartés, ${points} points` +
      ` → src/data/japan-geometry.js (${kb} Ko)\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`\n${error.message}\n`);
  process.exit(1);
});
