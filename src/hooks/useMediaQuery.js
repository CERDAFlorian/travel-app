import { useEffect, useState } from 'react';

// Vrai quand la requête média correspond.
//
// Utilisé pour les comportements qui ne se font pas en CSS : replier un
// panneau au montage, par exemple. Tout ce qui peut rester en CSS y reste —
// un point de rupture dupliqué en JS et en SCSS finit toujours par diverger.
//
// La valeur initiale est lue tout de suite, pas après le premier rendu :
// sinon un panneau apparaîtrait déplié puis se refermerait sous les yeux.
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (!window.matchMedia) return undefined;

    const list = window.matchMedia(query);
    const update = (event) => setMatches(event.matches);
    setMatches(list.matches);

    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);

  return matches;
}

// Le seuil au-delà duquel la grille passe à deux colonnes, repris de
// `minmax(min(100%, 430px), 1fr)` : en dessous, l'app est en colonne unique et
// chaque bloc doit se battre pour sa place verticale.
export const MOBILE_QUERY = '(max-width: 767px)';
