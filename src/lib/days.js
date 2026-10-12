// Les jours d'une étape.
//
// LE MODÈLE. Un jour n'est pas une ligne en base : c'est une position dans une
// étape. `itinerary.js` sait déjà quand chaque étape commence — tout découle de
// l'arrivée du vol aller et des nuits —, donc les jours se déduisent, et seul
// le rattachement d'un item est stocké (`items.day_offset`). Ajouter une nuit à
// Kyoto insère un jour vide au bon endroit sans toucher à un seul item.
//
// UNE ÉTAPE POSSÈDE `nights + 1` JOURS (L11, F2). Le dernier est le jour du
// DÉPART : on y fait encore quelque chose — un marché le matin, un musée avant
// le train — puis on part. Il est PARTAGÉ avec la ville suivante, dont c'est le
// premier jour : `date_end` d'une étape est `date_start` de la suivante, et le
// programme lit ce jour en trois temps — la ville qu'on quitte, le trajet, la
// ville où l'on arrive. Pour la dernière étape, ce jour est celui du vol
// retour : c'était déjà la règle, elle vaut désormais pour toutes les villes.
//
// Avant F2, le jour du trajet n'appartenait qu'à la ville d'arrivée : le matin
// à Tokyo avant le train vers Matsumoto ne se notait nulle part, sinon dans
// Matsumoto.
//
// AJOUTER UNE NUIT NE DÉPLACE RIEN. Ce qui était posé le jour du départ reste
// à sa date, devenue un jour ordinaire ; le nouveau jour du départ arrive vide.
// Un item qui changerait de date sans qu'on le demande se découvrirait sur
// place. Retirer une nuit, à l'inverse, renvoie en réserve ce qui tombait sur
// un jour disparu (`releasedBy`).

import { addDays } from './itinerary.js';
import { categoryOf } from './categories.js';
import { cityLegs } from './transport.js';

// Les moments d'une journée vivent dans slots.js : containers.js en a besoin
// aussi, et ce fichier a besoin de containers.js. Réexportés ici pour ne rien
// changer aux imports existants.
import { SLOTS, UNSLOTTED } from './slots.js';
import { containerPlan, isContained, isStop, stopsOf } from './containers.js';

export { SLOTS, UNSLOTTED };

const SLOT_RANK = new Map(SLOTS.map((slot, index) => [slot.key, index]));

// Les items DE LA VILLE : ni ses arrêts en chemin, ni ce qu'un lieu contient
// (L11, F5). Eux vivent sur la route ou dans leur lieu, avec leur propre
// programme (containers.js) — ils n'ont rien à faire dans les jours ni dans la
// réserve de la ville.
const ofCity = (item) => !isStop(item) && !isContained(item);
const rankOf = (item) => SLOT_RANK.get(item.day_slot) ?? SLOTS.length;

// Les jours d'une étape, dans l'ordre : ses nuits, puis le jour du départ.
export function daysOf(step) {
  const nights = step.nights ?? 0;

  return Array.from({ length: dayCount(nights) }, (_, offset) => ({
    offset,
    date: step.date_start ? addDays(step.date_start, offset) : null,
    // Le dernier jour n'est pas une nuit ici : c'est le jour où l'on part. On
    // y fait encore quelque chose, mais pas une journée de visites — et
    // l'affichage doit pouvoir le dire.
    departure: offset === nights,
  }));
}

// Combien de jours une étape aurait avec ce nombre de nuits. Sert à savoir ce
// qu'une réduction ferait perdre, avant de l'écrire.
function dayCount(nights) {
  return Math.max(0, nights) + 1;
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
export function scheduleOf(step) {
  const days = daysOf(step);
  const byDay = new Map(days.map((day) => [day.offset, []]));

  for (const item of step.items ?? []) {
    if (item.day_offset == null || !ofCity(item)) continue;
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
export function unplacedOf(step) {
  const count = dayCount(step.nights ?? 0);

  return (step.items ?? []).filter(
    (item) =>
      ofCity(item) &&
      categoryOf(item.category)?.planifiable &&
      (item.day_offset == null || item.day_offset >= count),
  );
}

// Les items à renvoyer en réserve si l'étape passait à ce nombre de nuits.
//
// Réduire un séjour ne doit rien détruire : on perd des jours, pas des envies.
// Les écraser sur le dernier jour restant serait pire — on se retrouverait
// avec six activités le même après-midi sans avoir rien demandé.
export function releasedBy(step, nights) {
  const count = dayCount(nights);

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
// 13 novembre. Les étapes s'effacent derrière la suite des DATES, et les vols
// comme les trajets se rangent à leur date, au milieu du programme.
//
// UNE ENTRÉE PAR DATE, pas par jour d'étape. Le jour d'un changement de ville
// appartient aux deux (voir l'en-tête) : il rend deux PARTIES — la ville qu'on
// quitte, puis celle où l'on arrive — et le TRANSFERT qui les sépare. Les
// autres jours n'ont qu'une partie.
//
// Chaque partie porte le jour de SON étape (offset, moments, items) : c'est
// lui qu'on modifie, et ses items ne se placent que parmi les jours de leur
// ville.
//
// Les étapes doivent arriver AVEC LEURS DATES RÉSOLUES (resolveItinerary) : ce
// sont elles qui font foi, pas les colonnes date_start stockées.
export function tripSchedule(trip) {
  const steps = trip.steps ?? [];

  // Un trajet est identifié par le COUPLE d'étapes : une liaison qui subsiste
  // entre deux villes devenues non adjacentes ne doit pas s'inviter dans une
  // journée qu'elle ne concerne plus.
  const legs = new Map(cityLegs(trip.legs).map((leg) => [`${leg.from_step}>${leg.to_step}`, leg]));

  const flights = new Map();
  for (const flight of trip.flights ?? []) {
    if (!flight.date) continue;
    flights.set(flight.date, [...(flights.get(flight.date) ?? []), flight]);
  }

  const entries = [];

  steps.forEach((step, index) => {
    const previous = index > 0 ? steps[index - 1] : null;
    const schedule = scheduleOf(step);

    schedule.forEach((day) => {
      const part = {
        ...day,
        step,
        // La réserve d'une ville se pose après son dernier jour.
        lastOfStep: day.offset === schedule.length - 1,
      };

      // LE JOUR DU CHANGEMENT DE VILLE. La ville qu'on quitte l'a déjà ouvert
      // avec son jour de départ : celle où l'on arrive s'y ajoute, après le
      // trajet. `from` existe même sans liaison saisie — arriver d'ailleurs
      // est déjà une information, la durée n'en est que le détail.
      if (day.offset === 0 && previous) {
        const shared = entries.at(-1);
        shared.parts.push(part);
        shared.transfer = {
          from: previous,
          to: step,
          // Les arrêts sur la route (F5), dans l'ordre où on les rencontre,
          // chacun avec son programme. Ils appartiennent à la ville qu'on
          // quitte : c'est elle qui les porte.
          stops: stopsOf(previous).map((stop) => containerPlan(previous, stop)),
          // Le trajet entre les deux villes. S'il y a des arrêts, c'est le
          // DERNIER tronçon : du dernier arrêt à la ville d'arrivée.
          leg: legs.get(`${previous.id}>${step.id}`) ?? null,
        };
        return;
      }

      entries.push({
        date: day.date,
        parts: [part],
        transfer: null,
        flights: flights.get(day.date) ?? [],
      });
    });
  });

  return entries;
}
