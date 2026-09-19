import { fetchSharedTrip } from '@/lib/api.js';
import { readTrip, writeTrip } from '@/lib/db.js';
import { useCached } from './useCached.js';

// Même mécanique que useTrip — cache d'abord, réseau ensuite — mais la clé de
// cache est préfixée. Un ami qui consulte un lien partagé ne doit pas écraser
// le cache du propriétaire s'il se connecte ensuite sur le même navigateur.
const SHARED = {
  read: (key) => readTrip(key),
  write: (key, data, savedAt) => writeTrip(key, data, savedAt),
  fetch: (key) => fetchSharedTrip(key.replace('share:', '')),
};

export function useSharedTrip(token) {
  const { data, ...rest } = useCached(`share:${token}`, SHARED);
  return { trip: data, ...rest };
}
