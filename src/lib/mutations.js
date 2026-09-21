import { supabase } from '@/lib/supabase.js';
import { fail } from '@/lib/errors.js';
import {
  addDays,
  datesToUpdate,
  tripEndDate,
  tripStartFromFlights,
} from '@/lib/itinerary.js';

// Écritures.
//
// Aucune ne renvoie la ligne : `.insert(row)` sans `.select()`. Ce n'est pas
// une économie, c'est une contrainte du modèle RLS — voir 0002_rls.sql. Et
// puisque le rendu vient du cache, une ligne renvoyée ne servirait à rien : on
// resynchronise après coup, ce qui garantit que l'écran montre ce que la base
// contient réellement plutôt qu'une supposition locale.
//
// Toutes les écritures sont bloquées en amont quand `readOnly` est vrai : pas
// de réseau, ou pas de session. RLS refuserait de toute façon, mais mieux vaut
// une UI qui n'invite pas au geste qu'un message d'erreur après coup.

export async function addItem({ stepId, category, title, price, position }) {
  const { error } = await supabase.from('items').insert({
    step_id: stepId,
    category,
    title: title.trim(),
    price: price ?? null,
    position,
  });
  if (error) fail(error, "Ajout de l'item");
}

export async function updateItem(id, { title, price, notes }) {
  const patch = {};
  if (title !== undefined) patch.title = title.trim();
  if (price !== undefined) patch.price = price;
  // Une note vidée redevient NULL : une chaîne vide en base se comporte
  // différemment d'une absence à la lecture, et on ne veut pas les deux.
  if (notes !== undefined) patch.notes = notes?.trim() || null;

  const { error } = await supabase.from('items').update(patch).eq('id', id);
  if (error) fail(error, "Modification de l'item");
}

export async function deleteItem(id) {
  const { error } = await supabase.from('items').delete().eq('id', id);
  if (error) fail(error, "Suppression de l'item");
}

export async function setFavorite(id, favorite) {
  const { error } = await supabase.from('items').update({ favorite }).eq('id', id);
  if (error) fail(error, 'Mise à jour du favori');
}

// `geocoded_at` distingue les deux origines, comme le prévoit le schéma :
// renseigné quand Nominatim a répondu, NULL quand les coordonnées ont été
// collées à la main. Utile le jour où l'on voudra re-géocoder en masse sans
// écraser ce qui a été corrigé manuellement.
export async function setCoordinates(id, { lat, lng }, { geocoded }) {
  const { error } = await supabase
    .from('items')
    .update({ lat, lng, geocoded_at: geocoded ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) fail(error, 'Enregistrement des coordonnées');
}

export async function clearCoordinates(id) {
  const { error } = await supabase
    .from('items')
    .update({ lat: null, lng: null, geocoded_at: null })
    .eq('id', id);
  if (error) fail(error, 'Effacement des coordonnées');
}

// Lien de partage.
//
// Un UUID tiré par le navigateur : 122 bits, on ne tombe pas dessus par
// hasard. Le régénérer révoque le lien précédent — c'est le seul moyen de
// reprendre la main sur une URL déjà envoyée.
export async function createShareToken(tripId) {
  const token = crypto.randomUUID();
  const { error } = await supabase.from('trips').update({ share_token: token }).eq('id', tripId);
  if (error) fail(error, 'Création du lien de partage');
  return token;
}

export async function revokeShareToken(tripId) {
  const { error } = await supabase.from('trips').update({ share_token: null }).eq('id', tripId);
  if (error) fail(error, 'Révocation du lien de partage');
}

// Réaligne positions et dates sur l'ordre voulu.
//
// Appelée après toute modification de structure : ajout, retrait, changement
// du nombre de nuits. C'est elle qui garantit qu'un itinéraire reste un
// enchaînement — sans elle, retirer une étape laissait un trou de deux jours
// et les numéros sautaient de 2 à 4.
//
// On n'écrit que ce qui a changé. Sur sept étapes, ajouter une nuit au milieu
// en déplace quatre, pas sept.
async function persistItinerary(trip, orderedSteps, startIso = trip.startDate) {
  for (const [index, step] of orderedSteps.entries()) {
    const position = index + 1;
    if (step.position === position) continue;
    const { error } = await supabase.from('steps').update({ position }).eq('id', step.id);
    if (error) fail(error, 'Renumérotation des étapes');
  }

  for (const dates of datesToUpdate(startIso, orderedSteps)) {
    const { error } = await supabase
      .from('steps')
      .update({ date_start: dates.date_start, date_end: dates.date_end })
      .eq('id', dates.id);
    if (error) fail(error, 'Recalcul des dates');
  }

  // Début et fin sont écrits ENSEMBLE. Le schéma exige `end_date >= start_date` :
  // avancer le départ avant la fin, en deux requêtes, violerait la contrainte
  // entre les deux.
  const end = tripEndDate(startIso, orderedSteps);
  if (startIso !== trip.startDate || end !== trip.endDate) {
    const { error } = await supabase
      .from('trips')
      .update({ start_date: startIso, end_date: end })
      .eq('id', trip.id);
    if (error) fail(error, 'Mise à jour des dates du voyage');
  }
}

// Recale le début du voyage sur l'arrivée du vol aller, et décale tout
// l'itinéraire avec. Appelée après chaque écriture sur les vols.
async function realignTripStart(trip, flights) {
  const start = tripStartFromFlights(flights, trip.startDate);
  if (start === trip.startDate) return;
  await persistItinerary(trip, trip.steps, start);
}

// Ajoute une étape à la fin de l'itinéraire.
//
// Ses dates sont déterministes : elle commence là où le voyage s'arrêtait.
// Les coordonnées restent NULL — la ville n'apparaîtra sur la carte qu'une
// fois localisée, et le bouton du rail sert à ça.
export async function addStep(trip, { name, nights }) {
  const start = tripEndDate(trip.startDate, trip.steps);

  const { error } = await supabase.from('steps').insert({
    trip_id: trip.id,
    position: trip.steps.length + 1,
    name: name.trim(),
    nights,
    date_start: start,
    date_end: addDays(start, nights),
  });
  if (error) fail(error, "Ajout de l'étape");

  const { error: endError } = await supabase
    .from('trips')
    .update({ end_date: addDays(start, nights) })
    .eq('id', trip.id);
  if (endError) fail(endError, 'Mise à jour de la fin du voyage');
}

// Change le nombre de nuits d'une étape, et décale tout ce qui suit.
export async function setStepNights(trip, stepId, nights) {
  if (nights < 0) return;

  const { error } = await supabase.from('steps').update({ nights }).eq('id', stepId);
  if (error) fail(error, 'Modification des nuits');

  await persistItinerary(
    trip,
    trip.steps.map((step) => (step.id === stepId ? { ...step, nights } : step)),
  );
}

// Coordonnées d'une étape, posées depuis le géocodage.
export async function setStepCoordinates(stepId, { lat, lng }) {
  const { error } = await supabase.from('steps').update({ lat, lng }).eq('id', stepId);
  if (error) fail(error, 'Enregistrement des coordonnées');
}

// Retire une étape de l'itinéraire.
//
// La suppression emporte en cascade les items de l'étape et les liaisons qui
// la touchent — c'est le schéma qui s'en charge (`on delete cascade`), pas ce
// code. Conséquence à connaître : retirer une étape du milieu supprime les
// DEUX liaisons qui l'encadraient, sans en créer une entre ses voisines. On ne
// peut pas deviner la durée d'un trajet qui n'a jamais été fait.
//
// Les dates, elles, sont recalculées : `persistItinerary` recolle la chaîne
// pour qu'aucun trou n'apparaisse entre les étapes voisines.
export async function removeStep(trip, stepId) {
  const { error } = await supabase.from('steps').delete().eq('id', stepId);
  if (error) fail(error, "Suppression de l'étape");

  await persistItinerary(
    trip,
    trip.steps.filter((step) => step.id !== stepId),
  );
}

// --- Vols -------------------------------------------------------------------
//
// Un voyage en compte souvent plus de deux : aller, sauts intérieurs, retour.
// La direction « interieur » a été ouverte en base par 0004_vols.sql.

export async function addFlight(trip, {
  direction,
  fromCode,
  toCode,
  stops,
  date,
  dep,
  arr,
  arrivalOffsetDays,
  airline,
  flightNo,
  price,
}) {
  const { error } = await supabase.from('flights').insert({
    trip_id: trip.id,
    direction,
    // Les codes IATA sont contraints à trois majuscules par le schéma : on
    // normalise ici plutôt que de laisser l'insertion échouer sur une saisie
    // en minuscules, qui est le cas courant.
    from_code: fromCode ? fromCode.trim().toUpperCase() : null,
    to_code: toCode ? toCode.trim().toUpperCase() : null,
    // Une liste vide vaut NULL : en base, « pas d'escale » et « tableau vide »
    // doivent se lire pareil, sinon deux vols directs diffèrent sans raison.
    stops: stops && stops.length > 0 ? stops : null,
    date: date || null,
    dep: dep || null,
    arr: arr || null,
    arrival_offset_days: arrivalOffsetDays ?? 0,
    airline: airline || null,
    flight_no: flightNo || null,
    price: price ?? null,
  });
  if (error) fail(error, 'Ajout du vol');

  await realignTripStart(trip, [
    ...trip.flights,
    { direction, date: date || null, arrival_offset_days: arrivalOffsetDays ?? 0 },
  ]);
}

export async function updateFlight(trip, id, patch) {
  const { error } = await supabase.from('flights').update(patch).eq('id', id);
  if (error) fail(error, 'Modification du vol');

  await realignTripStart(
    trip,
    trip.flights.map((flight) => (flight.id === id ? { ...flight, ...patch } : flight)),
  );
}

export async function deleteFlight(trip, id) {
  const { error } = await supabase.from('flights').delete().eq('id', id);
  if (error) fail(error, 'Suppression du vol');

  // Supprimer le vol aller rend la main : le début du voyage retombe sur la
  // date saisie, faute de mieux.
  await realignTripStart(
    trip,
    trip.flights.filter((flight) => flight.id !== id),
  );
}
