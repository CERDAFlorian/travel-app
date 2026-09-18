import { useEffect, useState } from 'react';

// État réseau du navigateur.
//
// `navigator.onLine` ment volontiers : il dit `true` dès qu'une interface
// réseau existe, y compris sur un wifi d'hôtel qui capte mais ne route rien.
// Il sert donc à éviter des requêtes manifestement vouées à l'échec, pas à
// affirmer qu'on est en ligne. La vérité vient de l'échec d'un vrai fetch —
// c'est pourquoi useCached combine les deux pour décider de `isOffline`.
export function useOnline() {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
