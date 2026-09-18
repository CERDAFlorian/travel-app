import { fetchTrips } from '@/lib/api.js';
import { readTripList, writeTripList } from '@/lib/db.js';
import { useCached } from './useCached.js';

const TRIPS = {
  read: () => readTripList(),
  write: (_key, data, savedAt) => writeTripList(data, savedAt),
  fetch: () => fetchTrips(),
};

// La liste n'a qu'une seule forme : une clé fixe suffit, là où un voyage est
// mis en cache par slug.
const LIST_KEY = 'all';

export function useTrips() {
  const { data, ...rest } = useCached(LIST_KEY, TRIPS);
  return { trips: data, ...rest };
}
