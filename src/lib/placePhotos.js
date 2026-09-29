// Quelles photos Wikimedia chercher (L10) — sans réseau, testable.
//
// Pour l'instant : les lieux touristiques, les hôtels et les villes (décidé le
// 27 septembre 2026). Une photo se cherche UNE fois, pour un lieu situé : la
// recherche se fait autour de sa position. `photo_checked_at` renseignée, même
// sans résultat, veut dire « déjà cherché » ; elle repasse à NULL quand le
// lieu change (mutations.js), et la photo est alors cherchée de nouveau.

export const PHOTO_CATEGORIES = new Set(['lieu', 'hotel']);

// Où l'utilisateur peut coller sa propre photo : les lieux touristiques, les
// activités et les logements, là où une image aide à choisir (décidé les 27 et
// 29 septembre 2026). Aucune plateforme ne fournit de photos de logements
// (Booking, Expedia, Airbnb fermés ; voir L10) : on colle celle de l'annonce.
// Pas les villes, restaurants ni boutiques.
export const PASTE_CATEGORIES = new Set(['lieu', 'activite', 'hotel']);

export const canPastePhoto = (item) => PASTE_CATEGORIES.has(item?.category);

// L'auteur et la licence des photos Wikimedia, affichés ou non. Masqués pour le
// moment (29 septembre 2026) : ils chargeaient le bandeau. On les garde en base,
// et chaque photo reste un lien vers sa page Commons, qui les porte — la forme
// légère d'attribution qu'admettent les licences Creative Commons 4.0.
export const SHOW_PHOTO_CREDITS = false;

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
