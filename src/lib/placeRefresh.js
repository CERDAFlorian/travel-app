// Redemander à Google les coordonnées qui vont expirer (L10, F3).
//
// Ce que la règle des 30 jours décide est dans placeFreshness.js, testé ; ici,
// seulement l'exécution : une fiche Google par lieu, puis l'écriture en base
// avec une date neuve. Un lieu qui échoue — réseau, place_id devenu obsolète
// chez Google, droits en lecture seule — n'arrête pas les autres : il sera
// retenté à la prochaine ouverture.

import { hasGoogleMaps } from './googleMaps.js';
import { setCoordinates, setStepCoordinates } from './mutations.js';
import { locationOf } from './places.js';
import { placesToRefresh } from './placeFreshness.js';

export async function refreshPlaces(trip, { now = Date.now(), olderThanDays } = {}) {
  if (!hasGoogleMaps()) return 0;
  const targets = placesToRefresh(trip, now, olderThanDays == null ? {} : { olderThanDays });
  let refreshed = 0;

  for (const target of targets) {
    try {
      const point = await locationOf(target.placeId);
      if (target.kind === 'step') await setStepCoordinates(target.id, point);
      else await setCoordinates(target.id, point);
      refreshed += 1;
    } catch {
      // Retenté à la prochaine ouverture du voyage.
    }
  }

  return refreshed;
}
