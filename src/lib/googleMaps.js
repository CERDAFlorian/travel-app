// Chargement de Google Maps, sans dépendance.
//
// Pas de paquet npm (@googlemaps/js-api-loader) : le chargement tient en un
// script ajouté à la page, une seule fois, et c'est ce que fait le chargeur
// officiel. Le script n'est demandé qu'au moment où la carte devient visible :
// une visite qui ne fait pas défiler jusqu'à la carte ne coûte aucun affichage
// facturé.
//
// La clé part dans le bundle, c'est inévitable pour une carte affichée dans le
// navigateur. Sa protection est ailleurs : dans la console Google, elle n'est
// acceptée que depuis travel.floriancerda.fr et localhost, et pour deux API
// seulement (voir L10 dans travel-app-lots-et-prompts.md).

const KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;
export const MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID;

// Sans clé ni Map ID — en CI, dans les tests, sur un poste sans .env.local —
// la carte affiche un message au lieu de tenter un chargement voué à l'échec.
export function hasGoogleMaps() {
  return Boolean(KEY && MAP_ID);
}

let loading = null;
const authListeners = new Set();

// Google appelle cette fonction globale quand il refuse la clé : domaine non
// autorisé, API non activée, facturation absente. Sans elle, la carte
// s'afficherait grisée sans que l'app le sache.
if (typeof window !== 'undefined') {
  window.gm_authFailure = () => {
    for (const listener of authListeners) listener();
  };
}

export function onGoogleAuthFailure(listener) {
  authListeners.add(listener);
  return () => authListeners.delete(listener);
}

function failure(message, kind) {
  const error = new Error(message);
  error.kind = kind;
  return error;
}

export function loadGoogleMaps() {
  if (!hasGoogleMaps()) {
    return Promise.reject(failure('Carte indisponible : clé Google absente.', 'config'));
  }
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    const callback = '__travelAppGoogleMapsReady';
    window[callback] = () => {
      delete window[callback];
      resolve();
    };

    const params = new URLSearchParams({
      key: KEY,
      v: 'weekly',
      language: 'fr',
      loading: 'async',
      callback,
    });
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = () => {
      // Réseau coupé : on autorise une nouvelle tentative au retour du réseau.
      loading = null;
      script.remove();
      reject(failure('Google Maps injoignable : pas de réseau.', 'network'));
    };
    document.head.append(script);
  }).then(async () => {
    const { maps } = window.google;
    const [core, markers] = await Promise.all([maps.importLibrary('maps'), maps.importLibrary('marker')]);
    return {
      Map: core.Map,
      Polyline: core.Polyline,
      OverlayView: core.OverlayView,
      AdvancedMarkerElement: markers.AdvancedMarkerElement,
      LatLng: maps.LatLng,
      LatLngBounds: maps.LatLngBounds,
      ColorScheme: maps.ColorScheme,
      event: maps.event,
    };
  });

  return loading;
}
