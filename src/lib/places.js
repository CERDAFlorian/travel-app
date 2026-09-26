// Recherche de lieux avec Google Places (L10, F2).
//
// Deux appels, et c'est tout ce que l'app demande à Google pour un lieu :
//
//   1. des SUGGESTIONS pendant qu'on tape (Autocomplete) ;
//   2. la POSITION du lieu choisi (Place Details, champ `location` seul).
//
// Les deux passent par un même JETON DE SESSION. Google ne facture alors pas
// les suggestions, seulement la fiche du lieu choisi (palier Essentials, 5 $ les
// 1 000 au-delà de 10 000 gratuites par mois). Sans jeton, chaque lettre tapée
// serait facturée : c'est le piège noté dans L10.
//
// Ce qu'on garde, conformément aux conditions de Google (§ 14) : le place_id,
// indéfiniment, et les coordonnées, 30 jours. Le nom et l'adresse de Google
// s'affichent dans les suggestions mais ne s'enregistrent jamais : le titre
// reste celui de l'utilisateur.

import { loadGoogleMaps } from './googleMaps.js';

// Rayon du biais géographique autour d'une étape : le même que le contrôle de
// cohérence de 50 km. C'est un BIAIS, pas un filtre — un lieu plus loin reste
// proposable, il est seulement signalé.
export const BIAS_RADIUS_M = 50_000;

let library = null;
async function places() {
  await loadGoogleMaps();
  library ??= await window.google.maps.importLibrary('places');
  return library;
}

// Une session couvre une recherche : de la première lettre au lieu choisi.
export async function newSession() {
  const { AutocompleteSessionToken } = await places();
  return new AutocompleteSessionToken();
}

// La requête de suggestions, sans Google : testable.
//
// `near` : le centre de l'étape, pour biaiser et mesurer la distance.
// `cities` : pour situer une étape, on ne veut que des villes.
export function suggestionRequest(input, { session, near = null, cities = false } = {}) {
  const request = { input, sessionToken: session, language: 'fr' };
  if (near) {
    const center = { lat: Number(near.lat), lng: Number(near.lng) };
    request.locationBias = { center, radius: BIAS_RADIUS_M };
    request.origin = center;
  }
  if (cities) request.includedPrimaryTypes = ['(cities)'];
  return request;
}

// Une suggestion de Google, réduite à ce que l'app affiche.
export function toSuggestion(prediction) {
  return {
    placeId: prediction.placeId,
    main: prediction.mainText?.text ?? prediction.text?.text ?? '',
    secondary: prediction.secondaryText?.text ?? '',
    km: prediction.distanceMeters != null ? prediction.distanceMeters / 1000 : null,
    prediction,
  };
}

export async function suggest(input, options) {
  const { AutocompleteSuggestion } = await places();
  const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(
    suggestionRequest(input, options),
  );
  return suggestions.map((s) => s.placePrediction).filter(Boolean).map(toSuggestion);
}

// La position du lieu choisi. Ferme la session : c'est cet appel, et lui seul,
// que Google facture. On ne demande QUE `location` : ajouter le nom ou la note
// ferait passer la fiche au palier Pro, plus de trois fois plus cher.
export async function resolve(suggestion) {
  const place = suggestion.prediction.toPlace();
  await place.fetchFields({ fields: ['location'] });
  return { placeId: place.id, lat: place.location.lat(), lng: place.location.lng() };
}

// Le lien « Maps ↗ » d'un item. Relié à Google, il ouvre la fiche exacte du
// lieu ; sinon, ses coordonnées. Les liens Google Maps sont gratuits, et des
// données Google n'ont pas à ouvrir Apple Plans (conditions, § 14).
export function mapsUrl(item) {
  if (item.place_id) {
    const params = new URLSearchParams({ api: '1', query: item.title, query_place_id: item.place_id });
    return `https://www.google.com/maps/search/?${params}`;
  }
  if (item.lat == null || item.lng == null) return null;
  return `https://www.google.com/maps/search/?api=1&query=${Number(item.lat)},${Number(item.lng)}`;
}
