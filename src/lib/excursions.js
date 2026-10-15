// Le jour d'une excursion : ce qui reste en ville, ce qui part avec elle
// (L11, F6 — Florian, 15 octobre 2026).
//
// AVANT OU APRÈS, JAMAIS PENDANT. Le jour où l'on passe à Miyajima, ce qu'on
// fait à Hiroshima se fait avant de prendre le ferry ou après l'avoir repris.
// Un moment de la ville qui tombe pendant l'excursion n'est plus proposé ; un
// lieu déjà posé là se signale.
//
// LES HEURES DE L'EXCURSION VIENNENT DE SES TRAJETS : le départ du premier
// transport aller, l'arrivée du dernier retour. Sans horaire, la plage de son
// moment — du matin à la fin de l'après-midi pour une journée entière (le soir
// reste en ville, pour le dîner du retour), le seul moment d'une demi-journée.

import { SLOTS, clockOf, minutes, slotFits, slotRange } from './slots.js';
import { CONTAINER_SLOTS, isExcursion } from './containers.js';

// Une journée entière occupe le matin et l'après-midi, pas le soir.
const FULL_DAY = [6 * 60, 18 * 60];

// La plage d'une excursion, en « HH:MM » : { from, until }.
//
// `own` : ses transports, rangés par sens (transportsByItem). Chaque borne
// vient du trajet qui la donne, sinon du moment : un aller à l'heure et un
// retour sans horaire donnent un départ précis et une fin de moment.
export function excursionWindow(excursion, own = null) {
  const [defaultStart, defaultEnd] =
    excursion.day_slot === 'journee' ? FULL_DAY : (slotRange(excursion.day_slot) ?? FULL_DAY);

  const departures = (own?.aller ?? []).filter((leg) => leg.dep).map((leg) => minutes(leg.dep));
  const arrivals = (own?.retour ?? []).filter((leg) => leg.arr).map((leg) => minutes(leg.arr));

  const start = departures.length > 0 ? Math.min(...departures) : defaultStart;
  const end = arrivals.length > 0 ? Math.max(...arrivals) : defaultEnd;

  return { from: clockOf(start), until: clockOf(Math.max(end, start)) };
}

// Le moment tient-il AVANT ou APRÈS l'excursion ? « À caler » tient partout :
// il n'a pas d'heure.
//
// IL DOIT EN RESTER UNE HEURE. Les heures de ville se contentent d'un bout de
// moment — partir à 10 h laisse le matin. Une excursion est plus exigeante :
// un retour de Miyajima à 17 h 40 laisse vingt minutes d'après-midi, et
// l'après-midi passait pour « de retour à Hiroshima » alors qu'on était sur
// l'île.
const MARGIN = 60;

export function fitsAround(key, window) {
  if (key == null) return true;
  const range = slotRange(key);
  if (!range || key === 'journee') return false;
  const [start, end] = range;
  return minutes(window.from) - start >= MARGIN || end - minutes(window.until) >= MARGIN;
}

// De quel côté de l'excursion se lit un moment de la ville : avant si son
// début précède le départ, après sinon.
export function sideOf(key, window) {
  const range = slotRange(key);
  if (!range) return 'after';
  return range[0] < minutes(window.from) ? 'before' : 'after';
}

// Les excursions posées sur un jour de la ville, avec leur plage.
export function excursionsOn(step, offset, transports) {
  return (step.items ?? [])
    .filter((item) => isExcursion(item) && item.day_offset === offset)
    .map((item) => ({ item, window: excursionWindow(item, transports?.get(item.id)) }));
}

// Les moments proposés EN VILLE ce jour-là : dans la fenêtre du jour (heures
// d'arrivée et de départ de la ville), et hors de toute excursion.
export function citySlotsFor(day, slots = SLOTS) {
  return slots.filter(
    (slot) => slotFits(slot.key, day) && (day.excursions ?? []).every((x) => fitsAround(slot.key, x.window)),
  );
}

// Les moments proposés DANS une excursion : ceux de sa plage pour une
// journée entière, son seul moment pour une demi-journée — on y range une
// liste, pas un programme.
export function insideSlotsFor({ item, window }) {
  if (item.day_slot !== 'journee') return SLOTS.filter((slot) => slot.key === item.day_slot);
  return CONTAINER_SLOTS.filter((slot) => slotFits(slot.key, window));
}
