import { useEffect, useRef } from 'react';
import { photosToFind } from '@/lib/placePhotos.js';
import { findPhoto } from '@/lib/wikimedia.js';
import { setItemPhoto, setStepPhoto } from '@/lib/mutations.js';

// Chercher les photos Wikimedia qui manquent, à l'ouverture d'un voyage (L10).
// Seulement pour qui peut écrire le voyage, et en ligne : la photo trouvée
// s'enregistre, et tout le monde la voit ensuite — vue partagée comprise.
//
// Un lieu qu'on vient de localiser arrive ici au rechargement qui suit : sa
// photo apparaît quelques secondes après. Une recherche en échec n'est pas
// retentée pendant la visite : chaque lieu n'est tenté qu'une fois par position.
export function usePhotoFill(trip, { enabled, onChanged }) {
  const attempted = useRef(new Set());
  const running = useRef(false);

  useEffect(() => {
    if (!enabled || running.current) return;
    const targets = photosToFind(trip).filter((t) => !attempted.current.has(`${t.id}:${t.lat},${t.lng}`));
    if (targets.length === 0) return;

    running.current = true;
    (async () => {
      let saved = 0;
      for (const target of targets) {
        attempted.current.add(`${target.id}:${target.lat},${target.lng}`);
        try {
          const photo = await findPhoto({ title: target.title, lat: target.lat, lng: target.lng, kind: target.photoKind });
          if (target.kind === 'step') await setStepPhoto(target.id, photo);
          else await setItemPhoto(target.id, photo);
          saved += 1;
        } catch {
          // Wikimedia injoignable, ou voyage en lecture seule : on réessaiera à
          // la prochaine visite.
        }
      }
      running.current = false;
      if (saved > 0) onChanged?.();
    })();
  }, [trip, enabled, onChanged]);
}
