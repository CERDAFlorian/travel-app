import { useEffect, useRef } from 'react';
import { placesToRefresh } from '@/lib/placeFreshness.js';
import { refreshPlaces } from '@/lib/placeRefresh.js';

// À l'ouverture d'un voyage, redemander à Google les coordonnées de plus de
// 25 jours — cinq jours avant qu'elles n'expirent (L10, F3). Seulement pour qui
// peut écrire le voyage, et en ligne.
//
// UNE FOIS par voyage et par visite : un lieu dont Google ne rend plus la
// position ne doit pas relancer la requête à chaque rendu, chaque fois payée.
export function useRefreshPlaces(trip, { enabled, onChanged }) {
  const attempted = useRef(new Set());

  useEffect(() => {
    if (!enabled || !trip?.id || attempted.current.has(trip.id)) return;
    if (placesToRefresh(trip, Date.now()).length === 0) return;
    attempted.current.add(trip.id);

    refreshPlaces(trip).then((refreshed) => {
      if (refreshed > 0) onChanged?.();
    });
  }, [trip, enabled, onChanged]);
}
