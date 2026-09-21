// Géocodage via Nominatim (OpenStreetMap).
//
// Usage de PRÉPARATION uniquement : jamais appelé pendant le voyage. Pas de
// Google Geocoding — une clé à protéger imposerait un backend, disproportionné
// pour quelques dizaines d'adresses saisies une fois.
//
// Politique d'usage de Nominatim : un appel par seconde au maximum, et une
// identification de l'application. Le `User-Agent` demandé par leur
// documentation est un en-tête INTERDIT dans un navigateur — `fetch` refuse de
// le définir. C'est le `Referer`, envoyé automatiquement, qui identifie l'app.
// La contrainte qu'on peut réellement tenir est l'espacement, et on la tient.

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';

// La politique de Nominatim impose un appel par seconde. On vise 1100 ms pour
// garder 100 ms de marge : une horloge un peu généreuse ne doit pas nous faire
// passer sous la limite réelle.
export const RATE_LIMIT_MS = 1000;
export const MIN_INTERVAL_MS = 1100;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let queue = Promise.resolve();
let lastCall = 0;

// File d'attente sérielle. `queue` est maintenue toujours résolue : un appel
// qui échoue ne doit pas empoisonner la chaîne et faire échouer les suivants.
function enqueue(run) {
  const result = queue.then(async () => {
    // Boucle jusqu'à l'échéance plutôt qu'un `setTimeout` unique : un minuteur
    // a le droit de se déclencher une milliseconde en avance, et un seul
    // sommeil ne garantit donc pas l'espacement. La boucle, si.
    const deadline = lastCall + MIN_INTERVAL_MS;
    for (let now = Date.now(); now < deadline; now = Date.now()) {
      await sleep(deadline - now);
    }

    lastCall = Date.now();
    return run();
  });

  queue = result.then(
    () => {},
    () => {},
  );
  return result;
}

// Le contexte est construit depuis la donnée, pas codé en dur : « Kinkaku-ji,
// Kyoto, Japon ». Écrire « Japan » en dur casserait le jour où un voyage se
// passe ailleurs — et ce projet est destiné à devenir un créateur
// d'itinéraires. Nominatim accepte le nom de pays en français avec
// accept-language=fr.
export function buildQuery(title, stepName, tripTitle) {
  return [title, stepName, tripTitle].filter(Boolean).join(', ');
}

export async function geocode(title, stepName, tripTitle) {
  const params = new URLSearchParams({
    q: buildQuery(title, stepName, tripTitle),
    format: 'json',
    limit: '5',
    'accept-language': 'fr',
  });

  return enqueue(async () => {
    let response;
    try {
      response = await fetch(`${ENDPOINT}?${params}`);
    } catch (cause) {
      const error = new Error('Nominatim injoignable : pas de réseau.');
      error.kind = 'network';
      error.cause = cause;
      throw error;
    }

    if (!response.ok) {
      // 429 : on a dépassé la cadence malgré la file. 5xx : chez eux.
      const error = new Error(
        response.status === 429
          ? 'Nominatim refuse : trop de requêtes, réessaie dans une minute.'
          : `Nominatim a répondu ${response.status}.`,
      );
      error.kind = 'server';
      throw error;
    }

    const rows = await response.json();

    return rows.map((row) => ({
      lat: Number(row.lat),
      lng: Number(row.lon),
      label: row.display_name,
      // « amenity · place_of_worship » — ce qui permet de reconnaître qu'un
      // candidat est un arrêt de bus plutôt que le temple cherché.
      kind: [row.class, row.type].filter(Boolean).join(' · '),
    }));
  });
}

// Repli manuel : « 35.0394, 135.7292 », le format qu'on obtient d'un clic droit
// sur Google Maps. Entre 10 et 20 % des lieux passeront par là — un ryokan sans
// adresse OSM, un nom romanisé introuvable.
//
// La virgule décimale est acceptée : un clavier français la produit
// naturellement, et « 35,0394 135,7292 » est une saisie plausible.
export function parseCoordinates(text) {
  const cleaned = String(text).trim();
  const match = cleaned.match(
    /^(-?\d{1,3}(?:[.,]\d+)?)\s*[,;]?\s+?(-?\d{1,3}(?:[.,]\d+)?)$|^(-?\d{1,3}(?:[.,]\d+)?)\s*,\s*(-?\d{1,3}(?:[.,]\d+)?)$/,
  );
  if (!match) return null;

  const rawLat = match[1] ?? match[3];
  const rawLng = match[2] ?? match[4];
  const lat = Number(String(rawLat).replace(',', '.'));
  const lng = Number(String(rawLng).replace(',', '.'));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { lat, lng };
}
