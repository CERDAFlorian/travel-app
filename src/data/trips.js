// ⚠️ DONNÉE EN DUR — à remplacer en L2 par la liste venue de Supabase.
//
// Un seul voyage existe aujourd'hui, celui du seed. Ce module est le seul
// endroit qui le sait : la page de liste et la page de voyage passent toutes
// deux par ici. En L2, `TRIPS` devient le résultat d'une requête et `findTrip`
// une recherche dans le cache — les composants ne bougent pas.
export const TRIPS = [
  {
    slug: 'japon-2026',
    theme: 'japan',
    title: 'Japon',
    subtitle: 'Itinéraire interactif, jour par jour',
    period: '7 → 26 novembre 2026',
    facts: ['7 étapes', '19 nuits'],
  },
];

export function findTrip(slug) {
  return TRIPS.find((trip) => trip.slug === slug) ?? null;
}
