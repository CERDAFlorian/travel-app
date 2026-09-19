import { MAP_HEIGHT, MAP_WIDTH, PROJECTION } from '@/data/japan-geometry.js';

// Projection de Mercator, dans le repère du fond de carte.
//
// Elle DOIT être la même que celle utilisée par scripts/build-map.mjs pour
// tracer les côtes : les paramètres viennent du fichier généré, ils ne sont pas
// recopiés. Si les deux divergeaient, les épingles tomberaient à côté du trait
// de côte sans que rien ne le signale.
//
// Le contrat de L5 prévoyait un calibrage manuel par ville dans
// `src/data/city-bounds.js`, avec une transformation linéaire par cadre. C'était
// la bonne approche pour un SVG dessiné à la main — il n'y en a pas. Avec une
// vraie projection, lat/lng suffisent et le calibrage devient inutile.

export { MAP_WIDTH, MAP_HEIGHT };

export function projectPoint(lat, lng) {
  if (lat == null || lng == null) return null;

  const x = PROJECTION.scale * ((lng * Math.PI) / 180) + PROJECTION.translateX;
  const y =
    PROJECTION.scale * -Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) +
    PROJECTION.translateY;

  return { x, y };
}

// Un point projeté peut tomber hors du cadre — un item mal géocodé à Hokkaidō,
// par exemple. On le sait plutôt que de dessiner dans le vide.
export function isInsideMap({ x, y }, margin = 0) {
  return x >= -margin && x <= MAP_WIDTH + margin && y >= -margin && y <= MAP_HEIGHT + margin;
}
