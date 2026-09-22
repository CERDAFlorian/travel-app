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

// Le programme de l'étape : chaque jour avec ses items, dans l'ordre.
//
// L'ordre vient de `day_position`, départagé par `position` — l'ordre de
// saisie — pour que deux items jamais réordonnés ne s'échangent pas d'un
// rendu à l'autre.
export function scheduleOf(step, { isLast = false } = {}) {
  const days = daysOf(step, { isLast });
  const byDay = new Map(days.map((day) => [day.offset, []]));

  for (const item of step.items ?? []) {
    if (item.day_offset == null) continue;
    byDay.get(item.day_offset)?.push(item);
  }

  for (const items of byDay.values()) {
    items.sort(
      (a, b) =>
        (a.day_position ?? 0) - (b.day_position ?? 0) || (a.position ?? 0) - (b.position ?? 0),
    );
  }

  return days.map((day) => ({ ...day, items: byDay.get(day.offset) }));
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
