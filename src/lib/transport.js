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
