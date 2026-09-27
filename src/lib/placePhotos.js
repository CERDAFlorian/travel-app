// Quelles photos Wikimedia chercher (L10) — sans réseau, testable.
//
// Pour l'instant : les lieux touristiques, les hôtels et les villes (décidé le
// 27 septembre 2026). Une photo se cherche UNE fois, pour un lieu situé : la
// recherche se fait autour de sa position. `photo_checked_at` renseignée, même
// sans résultat, veut dire « déjà cherché » ; elle repasse à NULL quand le
// lieu change (mutations.js), et la photo est alors cherchée de nouveau.

export const PHOTO_CATEGORIES = new Set(['lieu', 'hotel']);

const pending = (point) => point.lat != null && point.lng != null && !point.photo_checked_at;

// Les villes d'abord : ce sont elles qui se voient en tête de chaque étape.
export function photosToFind(trip) {
  const steps = (trip?.steps ?? [])
    .filter(pending)
    .map((step) => ({ kind: 'step', id: step.id, title: step.name, lat: step.lat, lng: step.lng, photoKind: 'city' }));
  const items = (trip?.steps ?? [])
    .flatMap((step) => step.items ?? [])
    .filter((item) => PHOTO_CATEGORIES.has(item.category) && pending(item))
    .map((item) => ({
      kind: 'item',
      id: item.id,
      title: item.title,
      lat: item.lat,
      lng: item.lng,
      photoKind: item.category === 'hotel' ? 'hotel' : 'place',
    }));
  return [...steps, ...items];
}
