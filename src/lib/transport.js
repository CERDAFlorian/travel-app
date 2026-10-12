import { priceInEuros } from './currency.js';

// Trajets entre étapes.
//
// Les modes reprennent le CHECK de `legs.mode` dans 0001_schema.sql. Comme
// pour les catégories, la liste vit à un seul endroit côté code — deux listes
// qui divergent, c'est une valeur refusée à l'insertion sans qu'on comprenne
// pourquoi.
export const TRANSPORT_MODES = [
  { value: 'shinkansen', label: 'Shinkansen' },
  { value: 'train', label: 'Train' },
  { value: 'bus', label: 'Bus' },
  { value: 'voiture', label: 'Voiture' },
  { value: 'ferry', label: 'Ferry' },
  { value: 'avion', label: 'Avion' },
  { value: 'marche', label: 'À pied' },
];

const LABELS = Object.fromEntries(TRANSPORT_MODES.map((m) => [m.value, m.label]));

export function modeLabel(mode) {
  return LABELS[mode] ?? mode;
}

const toMinutes = (time) => {
  const [hours, minutes] = String(time).split(':').map(Number);
  return hours * 60 + minutes;
};

// Durée déduite des deux horaires.
//
// Une arrivée antérieure au départ n'est pas une erreur : c'est un trajet de
// nuit. Le bus de 23h10 qui arrive à 6h30 dure 7h20, pas moins seize heures.
// On ne gère pas au-delà de 24 h — aucun trajet terrestre du voyage n'en
// approche, et un cas pareil mériterait une vraie date, pas une heure.
export function durationBetween(dep, arr) {
  if (!dep || !arr) return null;

  const minutes = toMinutes(arr) - toMinutes(dep);
  return minutes < 0 ? minutes + 24 * 60 : minutes;
}

// « 2h40 », « 45 min ». Pas de « 0h45 » : on ne dit pas l'heure quand il n'y
// en a pas.
export function formatDuration(minutes) {
  if (minutes == null) return null;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}

// Postgres rend un `time` en « HH:MM:SS ». Les secondes d'un horaire de train
// n'apprennent rien.
export function formatClock(time) {
  return time ? String(time).slice(0, 5) : null;
}

// Ce qui se lit d'un trajet connu : « Shinkansen · 09:12 → 11:52 · 2 h 40 ·
// 110 € ». La durée reste même sans horaire, pour les trajets dont on ne
// connaît que ça. Le prix se lit là où l'œil passe déjà : six trajets pèsent
// lourd, et les chercher un par un dans le budget ne dit pas lequel coûte cher.
//
// Un seul endroit pour cette phrase : elle s'affiche dans la route de la vue
// Villes et dans le jour du programme, et deux versions finiraient par dire
// deux choses.
export function legSummary(leg) {
  if (!leg) return null;

  return [
    modeLabel(leg.mode),
    formatClock(leg.dep) && `${formatClock(leg.dep)} → ${formatClock(leg.arr) ?? '?'}`,
    formatDuration(leg.duration_min),
    priceInEuros(leg.price, leg.currency ?? 'EUR'),
  ]
    .filter(Boolean)
    .join(' · ');
}

// LES DEUX SORTES DE TRAJETS (L11, F4). Un trajet relie deux villes
// (from_step → to_step), ou mène à une activité (item_id) : le ferry de
// Miyajima, le téléphérique du mont Misen. Le budget les additionne tous ;
// tout ce qui raisonne en « entre deux villes » ne doit voir que les premiers.
export function cityLegs(legs = []) {
  return legs.filter((leg) => !leg.item_id);
}

const byPosition = (a, b) => (a.position ?? 0) - (b.position ?? 0);

// L'ordre où l'on prend les transports d'une activité.
//
// L'HEURE DE DÉPART FAIT FOI quand on la connaît : on saisit un train à 12 h,
// puis un bus à 12 h 30, on s'aperçoit que le bus part à 11 h — il doit passer
// devant sans qu'on ait à le déplacer. (Ce n'est pas la règle des activités,
// où l'heure ne réordonne pas la journée : un transport, lui, n'a pas d'autre
// ordre que celui de l'horloge.)
//
// Un transport SANS HEURE garde sa place dans l'ordre de saisie : on ne sait
// pas quand il part, on ne le déplace pas. Seuls les transports à l'heure
// s'échangent entre eux, dans les places qu'ils occupent déjà.
//
// Pas de trajet de nuit ici : une activité ne se rejoint pas en franchissant
// minuit.
export function orderTransports(legs) {
  const ordered = [...legs].sort(byPosition);
  const timed = ordered.filter((leg) => leg.dep).sort((a, b) => a.dep.localeCompare(b.dep) || byPosition(a, b));

  let next = 0;
  return ordered.map((leg) => (leg.dep ? timed[next++] : leg));
}

// Les transports de chaque activité, rangés par sens puis dans l'ordre où on
// les prend (orderTransports) : le train, PUIS le ferry. L'aller se lit avant l'activité, le
// retour après — c'est le dernier ferry qu'il ne faut pas rater.
export function transportsByItem(legs = []) {
  const map = new Map();

  for (const leg of legs) {
    if (!leg.item_id) continue;
    const entry = map.get(leg.item_id) ?? { aller: [], retour: [] };
    (leg.direction === 'retour' ? entry.retour : entry.aller).push(leg);
    map.set(leg.item_id, entry);
  }

  for (const entry of map.values()) {
    entry.aller = orderTransports(entry.aller);
    entry.retour = orderTransports(entry.retour);
  }

  return map;
}

// Le créneau qu'un transport occupe, en minutes depuis minuit : du départ à
// l'arrivée, ou du départ à départ + durée quand seule la durée est connue.
// Une arrivée « avant » le départ est un trajet de nuit : elle tombe le
// lendemain. Sans heure de départ, aucun créneau — on ne sait pas quand.
function slotOf(leg) {
  if (!leg.dep) return null;

  const start = toMinutes(leg.dep);
  let end = leg.arr ? toMinutes(leg.arr) : leg.duration_min != null ? start + leg.duration_min : null;
  if (end == null) return null;
  if (end < start) end += 24 * 60;

  return { start, end };
}

// Les transports d'une journée qui se chevauchent : impossible d'être dans le
// train de 12 h à 12 h 30 ET dans le bus de 12 h 15. C'est presque toujours
// une faute de saisie — un horaire recopié de travers, un aller noté en
// retour —, et c'est sur place qu'on la découvrirait.
//
// Rend, pour chaque transport en conflit, ceux qui le chevauchent. Un trajet
// qui arrive à 12 h et un autre qui part à 12 h ne se chevauchent pas : on
// descend de l'un, on monte dans l'autre.
export function overlappingLegs(legs = []) {
  const timed = legs.map((leg) => ({ leg, slot: slotOf(leg) })).filter((entry) => entry.slot);
  const clashes = new Map();

  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i];
      const b = timed[j];
      if (a.slot.start < b.slot.end && b.slot.start < a.slot.end) {
        clashes.set(a.leg.id, [...(clashes.get(a.leg.id) ?? []), b.leg]);
        clashes.set(b.leg.id, [...(clashes.get(b.leg.id) ?? []), a.leg]);
      }
    }
  }

  return clashes;
}
