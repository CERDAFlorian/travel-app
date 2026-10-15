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

// LES HEURES DES MOMENTS — pour savoir ce qui tient avant un départ ou après
// une arrivée (heures de ville, 0016). Des bornes larges et rondes : un moment
// reste un moment, pas un créneau ; elles servent seulement à dire qu'on ne
// fera pas « l'après-midi à Tokyo » en partant à 10 h.
const SLOT_HOURS = {
  journee: [6, 24],
  matin: [6, 12],
  midi: [12, 14],
  'apres-midi': [14, 18],
  soir: [18, 24],
};

// Les bornes d'un moment, en minutes depuis minuit. NULL pour « à caler ».
export function slotRange(key) {
  const hours = SLOT_HOURS[key];
  return hours ? hours.map((hour) => hour * 60) : null;
}

const pad = (n) => String(n).padStart(2, '0');

// Des minutes à « HH:MM » — la forme que slotFits lit.
export function clockOf(totalMinutes) {
  return `${pad(Math.floor(totalMinutes / 60))}:${pad(totalMinutes % 60)}`;
}

// « HH:MM » ou « HH:MM:SS » en minutes depuis minuit.
export const minutes = (time) => {
  const [hours, mins] = String(time).split(':').map(Number);
  return hours * 60 + mins;
};

// Le moment tient-il dans la fenêtre du jour ? `from` : l'heure d'arrivée,
// le premier jour dans une ville. `until` : l'heure de départ, le jour où on
// la quitte. Sans borne, tout tient — c'est le cas de presque tous les jours.
//
// Un moment tient s'il en reste un bout : partir à 10 h laisse le matin,
// arriver à 15 h 40 laisse l'après-midi. La journée entière ne tient que si
// la journée l'est : un jour d'arrivée ou de départ n'en a pas une.
export function slotFits(key, { from = null, until = null } = {}) {
  if (!from && !until) return true;
  if (key === 'journee') return false;
  const hours = key ? SLOT_HOURS[key] : null;
  if (!hours) return true;

  const [start, end] = hours.map((hour) => hour * 60);
  if (until && start >= minutes(until)) return false;
  if (from && end <= minutes(from)) return false;
  return true;
}
