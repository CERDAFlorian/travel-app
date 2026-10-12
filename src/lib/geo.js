// Calculs géographiques, sans dépendance.

const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

// Distance à vol d'oiseau entre deux points {lat, lng}, en kilomètres.
//
// Haversine plutôt que Vincenty : l'écart tient au fait que la Terre est un
// ellipsoïde, il est de l'ordre de 0,5 % — sans portée quand on compare une
// distance de marche à un seuil de 50 km.
export function haversine(a, b) {
  if (!a || !b) return null;
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;

  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

// Seuil de cohérence de la localisation. Un item à plus de 50 km du centre de
// son étape est presque certainement mal placé : les noms romanisés japonais
// sont ambigus, et une recherche rend volontiers un homonyme à l'autre bout du
// pays — ou c'est le centre de l'étape qui est faux.
export const MAX_DISTANCE_FROM_STEP_KM = 50;

export function formatDistance(km) {
  if (km == null) return null;
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

// Saisie manuelle : « 35.0394, 135.7292 », le format qu'on obtient d'un clic
// droit sur Google Maps. Le repli quand la recherche ne trouve pas le lieu ;
// des coordonnées collées rompent le lien avec Google.
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
