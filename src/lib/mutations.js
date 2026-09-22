import { supabase } from '@/lib/supabase.js';
import { fail } from '@/lib/errors.js';
import { durationBetween } from '@/lib/transport.js';
import { hotelsOf } from '@/lib/lodging.js';
import { positionsToUpdate, releasedBy, reorderInDay } from '@/lib/days.js';
import {
  addDays,
  datesToUpdate,
  tripEndDate,
  reorderSteps,
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

// Renvoie l'identifiant créé, pour que l'appelant puisse enchaîner — ici,
// ouvrir la recherche d'adresse sur la ligne qui vient d'apparaître.
//
// `.select()` est possible ici, contrairement à `trips` : la policy de lecture
// d'un item remonte à son étape puis au voyage, dont on est déjà membre au
// moment de l'insertion. Sur `trips`, c'est le trigger AFTER qui crée
// l'appartenance, donc trop tard pour un RETURNING — voir 0002_rls.sql.
export async function addItem({ stepId, category, title, price, position, currency }) {
  const { data, error } = await supabase
    .from('items')
    .insert({
      step_id: stepId,
      category,
      title: title.trim(),
      price: price ?? null,
      // Le schéma met JPY par défaut ; on l'écrase quand la saisie se fait
      // dans une autre devise.
      ...(currency ? { currency } : {}),
      position,
    })
    .select('id')
    .single();
  if (error) fail(error, "Ajout de l'item");
  return data.id;
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

// --- Le logement d'une étape ------------------------------------------------
//
// Voir lib/lodging.js pour le modèle : plusieurs hôtels sont des candidats,
// `favorite` désigne le retenu, `booked` scelle le choix.

// L'étoile d'un hôtel est EXCLUSIVE dans son étape : en retenir un écarte
// l'autre. Une étape a un lit, pas deux.
//
// Elle ne se DÉCOCHE pas, contrairement à celle d'un lieu : il y a toujours un
// logement retenu — à défaut de choix, le premier saisi (voir lodging.js). Ne
// plus retenir celui-ci n'a donc pas de sens, on en retient un autre.
export async function setChosenHotel(step, id) {
  for (const hotel of hotelsOf(step)) {
    if (hotel.id === id || !hotel.favorite) continue;
    const { error } = await supabase.from('items').update({ favorite: false }).eq('id', hotel.id);
    if (error) fail(error, 'Mise à jour du logement retenu');
  }

  const { error } = await supabase.from('items').update({ favorite: true }).eq('id', id);
  if (error) fail(error, 'Mise à jour du logement retenu');
}

// Scelle le choix : l'hôtel devient réservé, les candidats écartés sont
// supprimés.
//
// L'ORDRE COMPTE. On scelle d'abord, on supprime ensuite. Si la suppression
// échoue, il reste une étape avec un hôtel réservé et des candidats en trop —
// visible, rattrapable à la main. Dans l'autre sens, un échec après la
// suppression aurait détruit les candidats sans rien sceller : on aurait perdu
// de la saisie pour rien.
export async function sealHotel(step, id) {
  const doomed = hotelsOf(step)
    .filter((hotel) => hotel.id !== id)
    .map((hotel) => hotel.id);

  const { error } = await supabase
    .from('items')
    .update({ booked: true, favorite: true })
    .eq('id', id);
  if (error) fail(error, 'Réservation du logement');

  if (doomed.length === 0) return;

  const { error: sweep } = await supabase.from('items').delete().in('id', doomed);
  if (sweep) fail(sweep, 'Suppression des hôtels non retenus');
}

// Défait le scellement. Les candidats supprimés ne reviennent pas — c'est
// pourquoi le geste était confirmé —, mais une réservation annulée ne doit pas
// laisser l'étape dans un état qu'on ne peut plus corriger.
export async function unsealHotel(id) {
  const { error } = await supabase.from('items').update({ booked: false }).eq('id', id);
  if (error) fail(error, 'Annulation de la réservation');
}

// --- Le programme jour par jour ---------------------------------------------
//
// Voir lib/days.js pour le modèle : un jour est une position dans l'étape, pas
// une ligne en base. Seul le rattachement est stocké.

// Pose un item sur un jour, en fin de journée.
//
// En fin et pas en tête : on ajoute ce qu'on vient de décider à la suite de ce
// qui est déjà prévu. Le rang se calcule sur le jour visé, pas sur l'étape —
// deux jours ont chacun leur numérotation.
export async function placeItem(step, id, dayOffset) {
  const last = (step.items ?? [])
    .filter((item) => item.day_offset === dayOffset)
    .reduce((max, item) => Math.max(max, item.day_position ?? 0), 0);

  const { error } = await supabase
    .from('items')
    .update({ day_offset: dayOffset, day_position: last + 1 })
    .eq('id', id);
  if (error) fail(error, "Placement de l'item");
}

// Renvoie un item en réserve. Il reste dans sa catégorie, avec son prix et ses
// coordonnées : on retire une date, pas une envie.
export async function unplaceItem(id) {
  const { error } = await supabase
    .from('items')
    .update({ day_offset: null, day_slot: null, day_position: 0 })
    .eq('id', id);
  if (error) fail(error, "Retrait de l'item du programme");
}

// Déplace un item d'un cran dans sa journée. `items` est la liste du jour,
// déjà ordonnée par `scheduleOf`.
export async function moveItemInDay(items, itemId, delta) {
  const reordered = reorderInDay(items, itemId, delta);
  // Même contrat que moveStep : le tableau d'origine veut dire « rien à
  // écrire ».
  if (reordered === items) return;

  for (const patch of positionsToUpdate(reordered)) {
    const { error } = await supabase
      .from('items')
      .update({ day_position: patch.day_position })
      .eq('id', patch.id);
    if (error) fail(error, 'Réordonnancement de la journée');
  }
}

// « Refaire un autre jour » : une copie de l'item, posée sur le jour choisi.
//
// C'est la contrepartie du modèle — un item, un placement (voir l'arbitrage 1
// de L9). Manger deux fois à Dōtonbori fait deux lignes, et c'est défendable :
// ce sont deux sorties, deux budgets. Encore faut-il que la deuxième ne se
// resaisisse pas à la main, d'où cette copie complète.
export async function duplicateItemOnDay(step, item, dayOffset) {
  const position =
    (step.items ?? []).reduce((max, current) => Math.max(max, current.position ?? 0), 0) + 1;
  const last = (step.items ?? [])
    .filter((other) => other.day_offset === dayOffset)
    .reduce((max, other) => Math.max(max, other.day_position ?? 0), 0);

  const { data, error } = await supabase
    .from('items')
    .insert({
      step_id: step.id,
      category: item.category,
      title: item.title,
      url: item.url,
      address: item.address,
      price: item.price,
      currency: item.currency,
      notes: item.notes,
      // Les coordonnées suivent, `geocoded_at` compris : c'est le même lieu,
      // et le redemander à Nominatim pour une adresse déjà résolue serait une
      // requête pour rien.
      lat: item.lat,
      lng: item.lng,
      geocoded_at: item.geocoded_at,
      position,
      day_offset: dayOffset,
      day_position: last + 1,
      // Ni l'étoile ni la réservation ne se copient : la mise en avant vaut
      // pour un lieu, pas pour chacun de ses passages, et une table réservée
      // le lundi ne l'est pas le jeudi.
    })
    .select('id')
    .single();
  if (error) fail(error, "Duplication de l'item");
  return data.id;
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

  const { data, error } = await supabase
    .from('steps')
    .insert({
      trip_id: trip.id,
      position: trip.steps.length + 1,
      name: name.trim(),
      nights,
      date_start: start,
      date_end: addDays(start, nights),
    })
    .select('id')
    .single();
  if (error) fail(error, "Ajout de l'étape");

  const { error: endError } = await supabase
    .from('trips')
    .update({ end_date: addDays(start, nights) })
    .eq('id', trip.id);
  if (endError) fail(endError, 'Mise à jour de la fin du voyage');

  return data.id;
}

// Change le nombre de nuits d'une étape, et décale tout ce qui suit.
//
// Une étape a au moins une nuit : c'est un changement de ville ET de logement,
// une excursion est une activité. Le schéma le garantit depuis 0007, on
// s'arrête avant de le lui faire refuser.
export async function setStepNights(trip, stepId, nights) {
  if (nights < 1) return;

  const step = trip.steps.find((candidate) => candidate.id === stepId);
  const isLast = trip.steps.at(-1)?.id === stepId;

  // LIBÉRER AVANT DE RACCOURCIR. Raccourcir un séjour fait perdre des jours,
  // pas des envies : les items qui y étaient posés repassent en réserve. Dans
  // l'autre ordre, un échec laisserait des items accrochés à des jours qui
  // n'existent plus.
  const released = step ? releasedBy(step, nights, { isLast }) : [];
  if (released.length > 0) {
    const { error } = await supabase
      .from('items')
      .update({ day_offset: null, day_slot: null, day_position: 0 })
      .in('id', released);
    if (error) fail(error, 'Libération des items des jours supprimés');
  }

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

// Déplace une étape d'un cran.
//
// Les dates suivent : une étape de quatre nuits qui passe devant une d'une
// nuit décale tout ce qui vient après. C'est `persistItinerary` qui s'en
// charge, comme pour un ajout ou un retrait.
//
// Les trajets ne sont PAS touchés. Un trajet relie deux villes, et le fait que
// l'ordre change ne l'annule pas : Kyoto → Hiroshima reste un trajet réel même
// si les deux ne se suivent plus. Il cesse simplement d'apparaître entre les
// deux cartes, et reste listé dans les temps de trajet. Le supprimer
// d'autorité détruirait une saisie que personne n'a demandé d'effacer.
export async function moveStep(trip, stepId, delta) {
  const reordered = reorderSteps(trip.steps, stepId, delta);
  // `reorderSteps` rend le tableau d'origine quand le mouvement est
  // impossible : rien à écrire.
  if (reordered === trip.steps) return;

  await persistItinerary(trip, reordered);
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

// --- Trajets entre étapes ---------------------------------------------------
//
// `duration_min` est CALCULÉE depuis les horaires plutôt que saisie : on
// connaît le train de 9h12 qui arrive à 11h52, rarement « 160 minutes ». Elle
// reste stockée parce que c'est elle qu'affichent le pied d'étape et le
// panneau des temps de trajet, et parce qu'un trajet peut n'avoir qu'une durée
// connue, sans horaire.

export async function saveLeg({ id, tripId, fromStep, toStep, mode, dep, arr }) {
  const row = {
    trip_id: tripId,
    from_step: fromStep,
    to_step: toStep,
    mode,
    dep: dep || null,
    arr: arr || null,
    duration_min: durationBetween(dep, arr),
  };

  // Un trajet existe déjà entre ces deux étapes : on le remplace plutôt que
  // d'échouer sur la contrainte unique (from_step, to_step).
  const query = id
    ? supabase.from('legs').update(row).eq('id', id)
    : supabase.from('legs').insert(row);

  const { error } = await query;
  if (error) fail(error, 'Enregistrement du trajet');
}

export async function deleteLeg(id) {
  const { error } = await supabase.from('legs').delete().eq('id', id);
  if (error) fail(error, 'Suppression du trajet');
}
