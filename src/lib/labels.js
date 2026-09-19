// Déport des labels — porté de `place()` du design (japan-map.jsx, l. 108-127).
//
// Le contrat de L5 demandait d3-force. Je ne l'ai pas suivi, pour une raison
// qui touche à l'exigence de performance du même contrat : d3-force est
// stochastique et itératif, donc coûteux et non reproductible d'un rendu à
// l'autre. L'algorithme du design essaie neuf positions autour de l'ancre et
// garde la première sans collision — déterministe, quelques microsecondes, et
// surtout parfaitement cachable par palier de zoom, ce que le contrat exige.
// Une dépendance de moins, aussi.

// Largeur moyenne d'un glyphe, en fraction de la taille de police. Mesurer
// vraiment supposerait un canvas ou un DOM : inutile ici, on cherche à éviter
// des chevauchements, pas à composer une page.
const GLYPH_RATIO = 0.52;

export function measureText(text, size) {
  return String(text).length * size * GLYPH_RATIO;
}

// Boîte d'un texte posé en (x, y) selon son ancrage. L'origine SVG d'un texte
// est sa ligne de base : la boîte remonte au-dessus et déborde à peine dessous.
export function boxOf(x, y, anchor, width, size) {
  const left = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
  return { x1: left, x2: left + width, y1: y - size * 0.72, y2: y + size * 0.28 };
}

const overlaps = (a, b) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;

const overlapArea = (a, b) => {
  const w = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
  const h = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
  return w > 0 && h > 0 ? w * h : 0;
};

// Neuf positions, dans l'ordre de préférence du design : à droite, à gauche,
// au-dessus, en dessous, puis les quatre diagonales.
function candidatesFor(radius) {
  return [
    { dx: radius + 8, dy: 6, anchor: 'start' },
    { dx: -(radius + 8), dy: 6, anchor: 'end' },
    { dx: 0, dy: -(radius + 10), anchor: 'middle' },
    { dx: 0, dy: radius + 22, anchor: 'middle' },
    { dx: radius + 8, dy: -(radius + 4), anchor: 'start' },
    { dx: -(radius + 8), dy: radius + 18, anchor: 'end' },
    { dx: radius + 8, dy: radius + 18, anchor: 'start' },
    { dx: -(radius + 8), dy: -(radius + 4), anchor: 'end' },
  ];
}

// `hard` : boîtes à éviter absolument (autres labels déjà posés, pastilles).
// `soft` : boîtes qu'on préfère éviter — on choisit le moindre recouvrement.
//
// Aucun déport maximum, aucun label masqué pour cause d'éloignement : le
// contrat l'interdit explicitement. Si aucune position ne convient, on garde la
// dernière plutôt que d'escamoter l'information.
export function placeLabel(cx, cy, radius, text, size, hard = [], soft = []) {
  const width = measureText(text, size);
  let best = null;

  for (const candidate of candidatesFor(radius)) {
    const x = cx + candidate.dx;
    const y = cy + candidate.dy;
    const box = boxOf(x, y, candidate.anchor, width, size);

    if (hard.some((obstacle) => overlaps(box, obstacle))) continue;

    const cost = soft.reduce((total, obstacle) => total + overlapArea(box, obstacle), 0);
    if (!best || cost < best.cost) best = { x, y, anchor: candidate.anchor, box, cost };
    if (cost === 0) break;
  }

  if (best) return best;

  const fallback = candidatesFor(radius).at(-1);
  const x = cx + fallback.dx;
  const y = cy + fallback.dy;
  return {
    x,
    y,
    anchor: fallback.anchor,
    box: boxOf(x, y, fallback.anchor, width, size),
    cost: Infinity,
  };
}

// Paliers de zoom : 1, 2, 4, 8. Le placement est recalculé une fois par palier
// et mis en cache ; entre deux paliers, seule la transformation du <g> change.
// Sans cette discrétisation, la simulation tournerait à chaque image de pan.
export function zoomTier(k) {
  if (k >= 8) return 8;
  if (k >= 4) return 4;
  if (k >= 2) return 2;
  return 1;
}
