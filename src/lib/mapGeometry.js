// Géométrie de la carte du voyage, sans Google.
//
// Tout ce qui se calcule sans carte vit ici, testé : les épingles groupées, la
// couronne des lieux non localisés, les arcs entre villes, la sélection au clic
// et le choix des noms à afficher. Le composant ne fait que poser le résultat
// sur la carte Google.

import { categoryOf } from './categories.js';
import { measureText } from './labels.js';

// Couronne des items sans coordonnées, autour de leur ville, en PIXELS : elle
// garde la même taille à tous les niveaux de zoom. Valeurs du design, reprises
// de la carte SVG : on démarre en haut à gauche et on avance de 43° par item,
// le rayon alternant sur trois crans pour que deux voisins ne se touchent pas.
const RING_START_DEG = -104;
const RING_STEP_DEG = 43;
const RING_RADII = [19, 26, 33];

export function ringOffset(index) {
  const angle = ((RING_START_DEG + index * RING_STEP_DEG) * Math.PI) / 180;
  const radius = RING_RADII[index % RING_RADII.length];
  return { dx: radius * Math.cos(angle), dy: radius * Math.sin(angle) };
}

const located = (point) =>
  point.lat != null && point.lng != null && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng));

// Deux étapes à la même ville partagent une épingle — Tokyo est l'étape 1 ET
// l'étape 9. Deux épingles superposées donneraient un numéro illisible et une
// cible de clic ambiguë. « Même ville » = mêmes coordonnées à 5 décimales, soit
// un mètre : une ville saisie deux fois tombe exactement au même endroit.
export function groupSteps(steps) {
  const groups = new Map();

  for (const step of steps) {
    if (!located(step)) continue;
    const lat = Number(step.lat);
    const lng = Number(step.lng);
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    const group = groups.get(key);
    if (group) group.steps.push(step);
    else groups.set(key, { key, lat, lng, steps: [step] });
  }

  return [...groups.values()];
}

// Où poser chaque item d'une catégorie géographique.
//
// Un item localisé est à sa place (`geo`). Sans coordonnées, il prend place sur
// la couronne de sa ville (`ring`) : on voit l'étape se remplir avant même
// d'avoir tout localisé. Le compteur de couronne est tenu PAR VILLE : Tokyo 1 et
// Tokyo 9 partagent une épingle, deux compteurs repartant de zéro les
// superposeraient exactement.
export function placeItems(steps, groups) {
  const groupOfStep = new Map();
  for (const group of groups) for (const step of group.steps) groupOfStep.set(step.id, group);

  const ringCount = new Map();
  const placed = [];

  for (const step of steps) {
    const group = groupOfStep.get(step.id) ?? null;

    for (const item of step.items ?? []) {
      if (!categoryOf(item.category)?.onMap) continue;
      const common = { id: item.id, title: item.title, category: item.category, stepId: step.id, group };

      if (located(item)) {
        placed.push({ ...common, kind: 'geo', lat: Number(item.lat), lng: Number(item.lng) });
        continue;
      }
      if (!group) continue;

      const index = ringCount.get(group.key) ?? 0;
      ringCount.set(group.key, index + 1);
      placed.push({ ...common, kind: 'ring', ...ringOffset(index) });
    }
  }

  return placed;
}

// Un trajet saisi, en arc d'une ville à l'autre. Le creux alterne de part et
// d'autre pour que deux trajets successifs ne se superposent pas — même
// formule que la carte SVG, transposée en latitude / longitude (l'axe vertical
// de l'écran est la latitude inversée).
export function legArc(from, to, index, samples = 32) {
  const bow = (index % 2 ? -1 : 1) * (0.1 + (index % 3) * 0.03);
  const mid = { lat: (from.lat + to.lat) / 2, lng: (from.lng + to.lng) / 2 };
  const dLat = to.lat - from.lat;
  const dLng = to.lng - from.lng;
  const control = { lat: mid.lat - dLng * bow, lng: mid.lng + dLat * bow };

  return Array.from({ length: samples + 1 }, (_, i) => {
    const t = i / samples;
    const u = 1 - t;
    return {
      lat: u * u * from.lat + 2 * u * t * control.lat + t * t * to.lat,
      lng: u * u * from.lng + 2 * u * t * control.lng + t * t * to.lng,
    };
  });
}

// Les arcs des trajets saisis, et d'eux seuls : un voyage sans trajet saisi n'a
// pas d'arc, comme sur la carte SVG (décidé le 26 septembre 2026).
export function legArcs(legs, groups) {
  const groupOfStep = new Map();
  for (const group of groups) for (const step of group.steps) groupOfStep.set(step.id, group);

  const arcs = [];
  for (const leg of legs ?? []) {
    const from = groupOfStep.get(leg.from_step);
    const to = groupOfStep.get(leg.to_step);
    if (!from || !to || from === to) continue;
    arcs.push({ id: leg.id, path: legArc(from, to, arcs.length) });
  }
  return arcs;
}

// Clic sur une épingle. Sur une épingle groupée — Tokyo, étapes 1 et 9 — les
// clics successifs passent d'une étape à l'autre, puis désélectionnent.
export function nextSelection(group, selectedStepId) {
  const index = group.steps.findIndex((step) => step.id === selectedStepId);
  const next = group.steps[index + 1] ?? (index === -1 ? group.steps[0] : null);
  return next?.id ?? null;
}

// Où poser chaque nom, en pixels écran — ou le masquer.
//
// Un nom se pose à droite de son point ; si la place est prise, à gauche,
// comme la carte SVG essayait plusieurs positions avant de renoncer. Pris des
// deux côtés, il est masqué : l'épingle numérotée reste toujours visible, et le
// nom revient en zoomant (décidé le 26 septembre 2026). Les candidats arrivent
// par ordre de priorité ; le premier qui tient garde sa place. Un nom ne se
// heurte jamais à sa propre épingle.
//
// `candidates` : { id, x, y, text, size, gap, owner, against } — le nom s'écarte
// de `gap` pixels du point (x, y), centré verticalement. `against` vaut 'pin'
// pour un nom d'étape, qui n'évite que les épingles, et 'all' (défaut) pour un
// nom de lieu, qui évite aussi les pastilles.
// `obstacles` : { x1, x2, y1, y2, owner, kind } — kind 'pin' ou 'dot'.
//
// Rend une Map id → 'right' | 'left'. Un nom absent est masqué.
export function placeLabels(candidates, obstacles) {
  const overlaps = (a, b) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
  const taken = [];
  const placed = new Map();

  for (const label of candidates) {
    const width = measureText(label.text, label.size) + 8;
    const y1 = label.y - label.size * 0.7;
    const y2 = label.y + label.size * 0.7;
    const sides = {
      right: { x1: label.x + label.gap, x2: label.x + label.gap + width, y1, y2 },
      left: { x1: label.x - label.gap - width, x2: label.x - label.gap, y1, y2 },
    };

    const free = (box) =>
      !taken.some((other) => overlaps(box, other)) &&
      !obstacles.some(
        (obstacle) =>
          obstacle.owner !== label.owner &&
          (label.against !== 'pin' || obstacle.kind === 'pin') &&
          overlaps(box, obstacle),
      );

    const side = ['right', 'left'].find((candidate) => free(sides[candidate]));
    if (!side) continue;
    taken.push(sides[side]);
    placed.set(label.id, side);
  }

  return placed;
}
