// Les jours d'une étape.
//
// LE MODÈLE. Un jour n'est pas une ligne en base : c'est une position dans une
// étape. `itinerary.js` sait déjà quand chaque étape commence — tout découle de
// l'arrivée du vol aller et des nuits —, donc les jours se déduisent, et seul
// le rattachement d'un item est stocké (`items.day_offset`). Ajouter une nuit à
// Kyoto insère un jour vide au bon endroit sans toucher à un seul item.
//
// UNE ÉTAPE POSSÈDE EXACTEMENT `nights` JOURS. Le jour où l'on change de ville
// appartient à celle où l'on dort ce soir-là : `date_end` d'une étape étant
// déjà `date_start` de la suivante, il n'y a ni chevauchement ni arbitrage.
// Seule la dernière étape du voyage a un jour de plus — celui du vol retour,
// où l'on ne dort nulle part mais où l'on fait encore quelque chose.

import { addDays } from './itinerary.js';
import { categoryOf } from './categories.js';

// Les moments d'une journée.
//
// DES MOMENTS, PAS UNE GRILLE HORAIRE. Personne ne tient un créneau de 14h15 à
// Arashiyama : une journée se pense en « le matin Fushimi, le soir un kaiseki ».
// Quatre moments se remplissent en trois clics là où un emploi du temps à
// l'heure resterait vide, et se lisent d'un coup d'œil sur place.
//
// `journee` n'est pas un moment mais un mode : Kōyasan, c'est 2h30 de trajet,
// ça mange la journée. Il se pose donc en tête et se lit comme un bandeau —
// on doit voir que rien d'autre ne tiendra ce jour-là.
export const SLOTS = [
  { key: 'journee', label: 'Journée entière', full: true },
  { key: 'matin', label: 'Matin' },
  { key: 'midi', label: 'Midi' },
  { key: 'apres-midi', label: 'Après-midi' },
  { key: 'soir', label: 'Soir' },
];

// Un item posé avant que les moments n'existent, ou placé sans en choisir un.
// Il ne disparaît pas dans un moment arbitraire : il reste visible en pied de
// journée, à caler. Se vide tout seul à mesure qu'on range.
export const UNSLOTTED = { key: null, label: 'À caler' };

const SLOT_RANK = new Map(SLOTS.map((slot, index) => [slot.key, index]));
const rankOf = (item) => SLOT_RANK.get(item.day_slot) ?? SLOTS.length;

export function slotLabel(key) {
  return (SLOTS.find((slot) => slot.key === key) ?? UNSLOTTED).label;
}

// Les jours d'une étape, dans l'ordre.
export function daysOf(step, { isLast = false } = {}) {
  const nights = step.nights ?? 0;
  const count = nights + (isLast ? 1 : 0);

  return Array.from({ length: count }, (_, offset) => ({
    offset,
    date: step.date_start ? addDays(step.date_start, offset) : null,
    // Le dernier jour de la dernière étape n'est pas une nuit : c'est le jour
    // du départ. Il porte le check-out et le trajet vers l'aéroport, pas un
    // programme de visite, et l'affichage doit pouvoir le dire.
    departure: isLast && offset === nights,
  }));
}

// Combien de jours une étape aurait avec ce nombre de nuits. Sert à savoir ce
// qu'une réduction ferait perdre, avant de l'écrire.
function dayCount(nights, isLast) {
  return Math.max(0, nights) + (isLast ? 1 : 0);
}

// Le programme de l'étape : chaque jour, ses moments, et leurs items.
//
// L'ORDRE VIENT DU MOMENT, PUIS DE `day_position`. Surtout pas de
// `start_time` : une heure saisie sur une ligne ne doit pas réarranger la
// journée sous les doigts. On lit l'heure, on ne s'y soumet pas — et l'ordre
// reste celui qu'on a posé soi-même.
//
// `position` départage en dernier ressort, pour que deux items jamais
// réordonnés — qui valent 0 tous les deux — ne s'échangent pas d'un rendu à
// l'autre au gré de la réponse du serveur.
export function scheduleOf(step, { isLast = false } = {}) {
  const days = daysOf(step, { isLast });
  const byDay = new Map(days.map((day) => [day.offset, []]));

  for (const item of step.items ?? []) {
    if (item.day_offset == null) continue;
    byDay.get(item.day_offset)?.push(item);
  }

  return days.map((day) => {
    const items = (byDay.get(day.offset) ?? []).sort(
      (a, b) =>
        rankOf(a) - rankOf(b) ||
        (a.day_position ?? 0) - (b.day_position ?? 0) ||
        (a.position ?? 0) - (b.position ?? 0),
    );

    // Tous les moments sont rendus, vides compris : un trou dans une journée
    // est une information, et c'est là qu'on pose la suite. C'est la vue qui
    // décide de masquer `journee` et `à caler` quand ils n'ont rien — eux ne
    // sont pas des moments de la journée, ils n'ont pas à occuper une ligne
    // pour dire qu'ils sont vides.
    const groups = [...SLOTS, UNSLOTTED].map((slot) => ({
      ...slot,
      items: items.filter((item) => (item.day_slot ?? null) === slot.key),
    }));

    return { ...day, items, groups };
  });
}

// La réserve : ce qu'on veut faire dans cette ville sans avoir dit quand.
//
// Elle ramasse aussi les items posés sur un jour QUI N'EXISTE PLUS. En temps
// normal `releasedBy` les a déjà libérés, mais si cette écriture a échoué —
// réseau coupé au mauvais moment — l'item doit réapparaître ici plutôt que de
// disparaître de l'écran en restant en base.
export function unplacedOf(step, { isLast = false } = {}) {
  const count = dayCount(step.nights ?? 0, isLast);

  return (step.items ?? []).filter(
    (item) =>
      categoryOf(item.category)?.planifiable &&
      (item.day_offset == null || item.day_offset >= count),
  );
}

// Les items à renvoyer en réserve si l'étape passait à ce nombre de nuits.
//
// Réduire un séjour ne doit rien détruire : on perd des jours, pas des envies.
// Les écraser sur le dernier jour restant serait pire — on se retrouverait
// avec six activités le même après-midi sans avoir rien demandé.
export function releasedBy(step, nights, { isLast = false } = {}) {
  const count = dayCount(nights, isLast);

  return (step.items ?? [])
    .filter((item) => item.day_offset != null && item.day_offset >= count)
    .map((item) => item.id);
}

// Déplace un item d'un cran dans son jour.
//
// Rend un NOUVEAU tableau, ou celui d'origine si le mouvement est impossible —
// premier vers le haut, dernier vers le bas. L'appelant compare donc les
// références pour savoir s'il y a quelque chose à écrire. Même contrat que
// `reorderSteps` dans itinerary.js.
export function reorderInDay(items, itemId, delta) {
  const index = items.findIndex((item) => item.id === itemId);
  const target = index + delta;

  if (index < 0 || target < 0 || target >= items.length) return items;

  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

// Les seules lignes à écrire après un déplacement : celles dont le rang a
// bougé. Sur un jour de six items, en descendre un d'un cran en déplace deux.
export function positionsToUpdate(items) {
  return items
    .map((item, index) => ({ id: item.id, day_position: index + 1 }))
    .filter((next, index) => (items[index].day_position ?? 0) !== next.day_position);
}

// LE VOYAGE ENTIER, JOUR PAR JOUR.
//
// C'est la lecture qui sert SUR PLACE : on n'est pas dans « Kyoto », on est le
// 13 novembre. Les étapes s'effacent derrière la suite des jours, et les vols
// comme les trajets se rangent à leur date, au milieu du programme.
//
// Les étapes doivent arriver AVEC LEURS DATES RÉSOLUES (resolveItinerary) : ce
// sont elles qui font foi, pas les colonnes date_start stockées.
export function tripSchedule(trip) {
  const steps = trip.steps ?? [];

  // Un trajet est identifié par le COUPLE d'étapes : une liaison qui subsiste
  // entre deux villes devenues non adjacentes ne doit pas s'inviter dans une
  // journée qu'elle ne concerne plus.
  const legs = new Map((trip.legs ?? []).map((leg) => [`${leg.from_step}>${leg.to_step}`, leg]));

  const flights = new Map();
  for (const flight of trip.flights ?? []) {
    if (!flight.date) continue;
    flights.set(flight.date, [...(flights.get(flight.date) ?? []), flight]);
  }

  return steps.flatMap((step, index) => {
    const previous = index > 0 ? steps[index - 1] : null;

    return scheduleOf(step, { isLast: index === steps.length - 1 }).map((day) => ({
      ...day,
      step,
      // LE JOUR DE TRANSFERT EST UN JOUR DE PROGRAMME. Kyoto → Hiroshima,
      // c'est 1h45 de Shinkansen plus les gares : la demi-journée est prise,
      // et un programme qui ne le dirait pas laisserait croire à une matinée
      // libre. Le transfert se lit donc AVANT les moments, au premier jour de
      // l'étape d'arrivée.
      //
      // `from` existe même sans liaison saisie : arriver d'ailleurs est déjà
      // une information, la durée n'en est que le détail.
      from: day.offset === 0 ? previous : null,
      leg:
        day.offset === 0 && previous
          ? (legs.get(`${previous.id}>${step.id}`) ?? null)
          : null,
      flights: flights.get(day.date) ?? [],
    }));
  });
}
