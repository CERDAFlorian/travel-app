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

// Temps de marche estimé, en minutes.
//
// 4,5 km/h est une marche soutenue de touriste. Le facteur 1,3 corrige le vol
// d'oiseau : en ville on contourne des pâtés de maisons, on attend aux feux, on
// prend des passages. Sans lui, toutes les estimations sont optimistes d'un
// bon tiers — et on rate un train.
export function walkMinutes(km) {
  if (km == null) return null;
  return Math.round(((km * 1.3) / 4.5) * 60);
}

// Seuil de cohérence du géocodage. Un item à plus de 50 km du centre de son
// étape est presque certainement mal géocodé : les noms romanisés japonais sont
// ambigus, et Nominatim rend volontiers un homonyme à l'autre bout du pays.
export const MAX_DISTANCE_FROM_STEP_KM = 50;

export function formatDistance(km) {
  if (km == null) return null;
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`;
}
