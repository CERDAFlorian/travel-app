// La règle des 30 jours, côté app (L10, F3).
//
// Les conditions de Google Maps Platform (§ 14) autorisent à garder les
// coordonnées d'un lieu Google 30 jours au plus. Le place_id, lui, se garde
// indéfiniment : c'est avec lui qu'on redemande les coordonnées.
//
// Trois mécanismes, dont deux ici, sans Google ni Supabase — testables :
//
//   · `hideExpired` : une coordonnée Google de plus de 30 jours ne s'affiche
//     jamais, qu'elle vienne du réseau ou du cache hors ligne (IndexedDB) ;
//   · `placesToRefresh` : ce qu'il faut redemander à Google, à l'ouverture d'un
//     voyage (au-delà de 25 jours : cinq jours de marge avant l'effacement) ou
//     en préparant le départ (tout ce qui a plus d'un jour).
//
// Le troisième est la purge nocturne en base (0011_purge_google.sql), pour les
// voyages que personne n'ouvre.

const DAY_MS = 24 * 60 * 60 * 1000;
export const GOOGLE_MAX_AGE_DAYS = 30;
export const REFRESH_AFTER_DAYS = 25;

const ageInDays = (syncedAt, now) => (now - new Date(syncedAt).getTime()) / DAY_MS;

// Une coordonnée Google expirée : reliée, datée, et datée de plus de 30 jours.
// Une coordonnée à nous (seed, saisie à la main, Nominatim) n'expire jamais.
export function isExpired(point, now) {
  return Boolean(point.place_id && point.place_synced_at && ageInDays(point.place_synced_at, now) > GOOGLE_MAX_AGE_DAYS);
}

function withoutExpired(point, now) {
  return isExpired(point, now) ? { ...point, lat: null, lng: null } : point;
}

// Le voyage tel qu'on a le droit de l'afficher. Rend le même objet quand rien
// n'a expiré : un voyage recréé à chaque rendu relancerait tous les effets qui
// en dépendent.
export function hideExpired(trip, now) {
  if (!trip?.steps) return trip;
  let changed = false;

  const steps = trip.steps.map((step) => {
    const items = (step.items ?? []).map((item) => {
      const next = withoutExpired(item, now);
      if (next !== item) changed = true;
      return next;
    });
    const base = withoutExpired(step, now);
    if (base !== step) changed = true;
    return base === step && items.every((item, i) => item === step.items[i]) ? step : { ...base, items };
  });

  return changed ? { ...trip, steps } : trip;
}

// Les lieux Google à redemander : reliés, et sans coordonnées, sans date, ou
// datés de plus de `olderThanDays` jours. Les étapes d'abord : ce sont elles
// qui ancrent la carte.
export function placesToRefresh(trip, now, { olderThanDays = REFRESH_AFTER_DAYS } = {}) {
  const stale = (point) =>
    Boolean(point.place_id) &&
    (point.lat == null || !point.place_synced_at || ageInDays(point.place_synced_at, now) > olderThanDays);

  const steps = (trip?.steps ?? []).filter(stale).map((step) => ({ kind: 'step', id: step.id, placeId: step.place_id }));
  const items = (trip?.steps ?? [])
    .flatMap((step) => step.items ?? [])
    .filter(stale)
    .map((item) => ({ kind: 'item', id: item.id, placeId: item.place_id }));

  return [...steps, ...items];
}
