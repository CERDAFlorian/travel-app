// Dates de voyage — affichage seulement.
//
// Les colonnes date de Postgres arrivent en 'YYYY-MM-DD'. On les découpe à la
// main plutôt que de les passer à `new Date(iso)` : cette forme est interprétée
// comme UTC minuit, et l'affichage local peut alors reculer d'un jour à l'ouest
// de Greenwich. Une étape qui commence la veille est le genre d'erreur qu'on ne
// voit qu'une fois sur place.
function parse(iso) {
  if (!iso) return null;
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

const MONTH_YEAR = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const DAY_MONTH_YEAR = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

// « 7 → 26 novembre 2026 » quand le voyage tient dans un mois,
// « 28 novembre 2026 → 3 décembre 2026 » quand il le déborde.
export function formatPeriod(startIso, endIso) {
  const start = parse(startIso);
  const end = parse(endIso);

  if (!start && !end) return '';
  if (!start) return DAY_MONTH_YEAR.format(end);
  if (!end) return DAY_MONTH_YEAR.format(start);

  const sameMonth =
    start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();

  return sameMonth
    ? `${start.getDate()} → ${end.getDate()} ${MONTH_YEAR.format(end)}`
    : `${DAY_MONTH_YEAR.format(start)} → ${DAY_MONTH_YEAR.format(end)}`;
}

// « il y a 3 min », pour l'horodatage de dernière synchro.
export function formatSince(timestamp) {
  if (!timestamp) return null;

  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;

  const days = Math.floor(hours / 24);
  return days === 1 ? 'hier' : `il y a ${days} jours`;
}

const DAY_MONTH = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

// Dates d'une étape, format court : « 7 – 9 nov. » dans le mois,
// « 30 oct. – 2 nov. » quand elle le déborde. Pas d'année : elle est déjà dans
// l'en-tête du voyage, la répéter sept fois n'apprend rien.
export function formatStepDates(startIso, endIso) {
  const start = parse(startIso);
  const end = parse(endIso);

  if (!start && !end) return '';
  if (!start) return DAY_MONTH.format(end);
  if (!end) return DAY_MONTH.format(start);

  const sameMonth =
    start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();

  return sameMonth
    ? `${start.getDate()} – ${DAY_MONTH.format(end)}`
    : `${DAY_MONTH.format(start)} – ${DAY_MONTH.format(end)}`;
}

// Un prix dans sa devise. Les montants sont entiers au Japon : le yen n'a pas
// de subdivision, afficher « 34 000,00 ¥ » serait une faute de sens.
export function formatPrice(amount, currency = 'JPY') {
  if (amount === null || amount === undefined) return null;

  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'JPY' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}
