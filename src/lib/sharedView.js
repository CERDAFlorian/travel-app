// Ce que la vue partagée ne montre pas (Florian, 26 octobre 2026) : aucun
// prix, aucun budget, aucune « expérience à vivre ». Un lien de partage
// circule — chez des amis, chez un assistant IA — et ce qu'on a payé ne
// regarde que les voyageurs.
//
// Retiré ici, dans la donnée, plutôt que masqué composant par composant :
// chaque écran n'affiche un prix que s'il existe, et un prix ajouté demain
// dans un nouvel écran ne pourra pas fuiter par oubli. La fonction de
// partage ne les rend plus depuis 0017 ; ce filtre couvre aussi un cache
// écrit avant elle.

const PRICE_FIELDS = ['price', 'currency'];

function stripPrice(row) {
  const copy = { ...row };
  for (const field of PRICE_FIELDS) delete copy[field];
  return copy;
}

export function forSharing(trip) {
  if (!trip) return trip;
  return {
    ...trip,
    steps: (trip.steps ?? []).map((step) => ({ ...step, items: (step.items ?? []).map(stripPrice) })),
    flights: (trip.flights ?? []).map(stripPrice),
    legs: (trip.legs ?? []).map(stripPrice),
    experiences: [],
  };
}
