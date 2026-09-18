// Les 6 catégories — invariantes, identiques pour tous les voyages.
//
// C'est le fil conducteur visuel de l'app : leurs couleurs vivent dans
// base/_invariants.scss (--cat-*) et restent les mêmes au Japon comme ailleurs.
// Un seul endroit les déclare, ici, pour que l'ordre d'affichage et les
// libellés ne divergent pas d'un écran à l'autre.
//
// `onMap` reprend le drapeau `map` du design : il dit si la catégorie a une
// existence géographique. Les notes perso n'en ont pas — elles ne portent pas
// de lieu, donc ni épingle sur la carte (L5), ni photo dans un bandeau.
export const CATEGORIES = [
  { key: 'hotel', label: 'Hôtel', onMap: true },
  { key: 'activite', label: 'Activités', onMap: true },
  { key: 'restaurant', label: 'Restaurants', onMap: true },
  { key: 'shopping', label: 'Shopping', onMap: true },
  { key: 'lieu', label: 'Lieux touristiques', onMap: true },
  { key: 'note', label: 'Notes perso', onMap: false },
];

const BY_KEY = new Map(CATEGORIES.map((category) => [category.key, category]));

export function categoryOf(key) {
  return BY_KEY.get(key) ?? null;
}
