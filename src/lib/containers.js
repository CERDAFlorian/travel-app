// Les lieux qui en contiennent d'autres (L11, F5 et F6).
//
// Un ARRÊT EN CHEMIN — Hakushu, Shirakawa-gō — ou une EXCURSION — Miyajima —
// est un item (`kind`) qui peut contenir d'autres items (`parent_id`). On n'y
// dort pas : ce n'est pas une étape (voir 0015_arrets_excursions.sql).
//
// L'ARRÊT appartient à la ville qu'on QUITTE et se tient le jour où l'on en
// part. Il n'a ni jour ni moment à lui : sa date se déduit des nuits de la
// ville, et ajouter une nuit le déplace avec le départ sans rien écrire.
//
// CE QU'UN LIEU CONTIENT se range par moments dans le jour de son lieu. Sans
// moment, il attend dans la réserve du lieu — « À placer à Shirakawa-gō ».
//
// Ni l'arrêt ni son contenu ne sont « de la ville » : ils sortent de ses
// catégories, de ses jours et de sa réserve, et vivent sur la route.

import { SLOTS, UNSLOTTED } from './slots.js';
import { categoryOf } from './categories.js';

export const STOP = 'arret';

export const isStop = (item) => item?.kind === STOP;
export const isContained = (item) => item?.parent_id != null;

// Les moments d'un lieu. Pas de « journée entière » : un arrêt de deux heures
// ne mange pas la journée, et un lieu ne contient pas un autre lieu.
export const CONTAINER_SLOTS = SLOTS.filter((slot) => !slot.full);

// Les items de la ville elle-même : ni ses arrêts, ni ce qu'ils contiennent.
export function ownItems(step) {
  return (step.items ?? []).filter((item) => !isStop(item) && !isContained(item));
}

// La ville telle que ses catégories, ses jours et sa réserve la voient.
export function cityOnly(step) {
  return { ...step, items: ownItems(step) };
}

// Les arrêts sur la route qui part de cette ville, dans l'ordre où on les
// rencontre.
export function stopsOf(step) {
  return (step.items ?? [])
    .filter(isStop)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

// Ce qu'un lieu contient.
export function childrenOf(step, containerId) {
  return (step.items ?? []).filter((item) => item.parent_id === containerId);
}

const SLOT_RANK = new Map(CONTAINER_SLOTS.map((slot, index) => [slot.key, index]));

// Le programme d'un lieu : ses moments et leurs items, puis sa réserve.
//
// Même règle d'ordre que la journée d'une ville (scheduleOf) : le moment, puis
// `day_position`, puis `position` en dernier ressort. Un item contenu sans
// moment est en réserve ; un moment hors liste (« journée » posée avant) se
// range à part, à caler, plutôt que de disparaître.
export function containerPlan(step, container) {
  const children = childrenOf(step, container.id);

  const placed = children
    .filter((item) => item.day_slot != null)
    .sort(
      (a, b) =>
        (SLOT_RANK.get(a.day_slot) ?? CONTAINER_SLOTS.length) -
          (SLOT_RANK.get(b.day_slot) ?? CONTAINER_SLOTS.length) ||
        (a.day_position ?? 0) - (b.day_position ?? 0) ||
        (a.position ?? 0) - (b.position ?? 0),
    );

  const groups = [
    ...CONTAINER_SLOTS.map((slot) => ({
      ...slot,
      items: placed.filter((item) => item.day_slot === slot.key),
    })),
    { ...UNSLOTTED, items: placed.filter((item) => !SLOT_RANK.has(item.day_slot)) },
  ];

  return {
    container,
    step,
    items: placed,
    groups,
    reserve: children.filter((item) => item.day_slot == null && categoryOf(item.category)?.planifiable),
    // Notes et logements contenus : ils se lisent dans la carte du lieu, pas
    // dans son programme.
    count: children.length,
  };
}
