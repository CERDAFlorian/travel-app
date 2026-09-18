import { useCallback, useEffect, useRef, useState } from 'react';
import { useOnline } from './useOnline.js';

// « Cache d'abord, réseau ensuite » — la mécanique commune à useTrip et
// useTrips.
//
// L'ordre n'est pas négociable : on lit IndexedDB, on rend CE QU'ON A, et
// seulement ensuite on interroge le réseau. Attendre la réponse réseau pour
// afficher quoi que ce soit ferait de l'app une page blanche dès que la 4G
// faiblit — soit exactement la situation pour laquelle elle est écrite.
//
// Et rien ici ne dépend de l'authentification. La session conditionne le fetch,
// jamais l'affichage : le jeton expire en une heure et son renouvellement passe
// par le réseau, donc hors ligne on rend le cache sans se demander qui est
// connecté.
//
// `resource` doit être une constante de module — pas un objet recréé à chaque
// rendu — sinon l'effet se relance en boucle.
export function useCached(key, resource) {
  const online = useOnline();
  const [state, setState] = useState({ data: null, savedAt: null, loading: true });
  const [syncFailed, setSyncFailed] = useState(false);

  // Garde contre deux courses : le composant démonté, et le slug qui change
  // pendant qu'une requête est en vol. Sans ça, la réponse d'un voyage qu'on
  // vient de quitter viendrait écraser celui qu'on regarde.
  const aliveRef = useRef(true);
  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const sync = useCallback(async () => {
    const forKey = key;
    try {
      const fresh = await resource.fetch(forKey);
      const savedAt = Date.now();
      await resource.write(forKey, fresh, savedAt);

      if (aliveRef.current && keyRef.current === forKey) {
        setState({ data: fresh, savedAt, loading: false });
        setSyncFailed(false);
      }
      return true;
    } catch {
      // Un fetch qui échoue n'efface jamais le cache : on garde à l'écran la
      // donnée qu'on a, et on signale seulement qu'elle n'est plus fraîche.
      if (aliveRef.current && keyRef.current === forKey) setSyncFailed(true);
      return false;
    }
  }, [key, resource]);

  useEffect(() => {
    let cancelled = false;
    setState((previous) => ({ ...previous, loading: true }));

    (async () => {
      const cached = await resource.read(key);
      if (cancelled) return;

      setState({
        data: cached?.data ?? null,
        savedAt: cached?.savedAt ?? null,
        loading: false,
      });

      if (navigator.onLine) await sync();
    })();

    return () => {
      cancelled = true;
    };
  }, [key, resource, sync]);

  return {
    data: state.data,
    loading: state.loading,
    lastSync: state.savedAt,
    // Deux causes, une seule conséquence pour l'UI : ce qui est affiché peut
    // être périmé. Pas de réseau déclaré, ou un fetch qui a échoué malgré un
    // réseau déclaré présent.
    isOffline: !online || syncFailed,
    refresh: sync,
  };
}
