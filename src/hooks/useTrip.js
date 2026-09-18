import { fetchTrip } from '@/lib/api.js';
import { readTrip, writeTrip } from '@/lib/db.js';
import { useCached } from './useCached.js';

// Constante de module : l'identité de l'objet doit être stable d'un rendu à
// l'autre, sinon l'effet de useCached se relance sans fin.
const TRIP = {
  read: (slug) => readTrip(slug),
  write: (slug, data, savedAt) => writeTrip(slug, data, savedAt),
  fetch: (slug) => fetchTrip(slug),
};

// Un voyage complet — étapes, items, vols, liaisons, expériences.
// Le slug vient de la route (`/voyage/:slug`), décidé en L1.5.
export function useTrip(slug) {
  const { data, ...rest } = useCached(slug, TRIP);
  return { trip: data, ...rest };
}
