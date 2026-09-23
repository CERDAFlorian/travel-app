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

// « 7 nov. » — une date seule. `formatStepDates(d, d)` rendrait « 7 – 7 nov. »,
// un intervalle là où il n'y a qu'un jour.
export function formatDay(iso) {
  const date = parse(iso);
  return date ? DAY_MONTH.format(date) : '';
}

// Aujourd'hui, en 'YYYY-MM-DD' LOCAL.
//
// `toISOString()` donnerait la date UTC : le 13 novembre à 1h du matin à
// Kyoto, elle rendrait le 12. Le programme surlignerait la veille précisément
// là où on s'en sert — sur place, au petit matin.
export function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

const WEEKDAY_DAY_MONTH = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

// « jeu. 13 nov. » — l'en-tête d'un jour du programme.
//
// Le jour de la semaine compte ici plus qu'ailleurs : un programme se pense en
// « le jeudi on fait Arashiyama », et c'est lui qui dit qu'un musée sera fermé
// ou qu'un marché n'aura pas lieu.
export function formatDayFull(iso) {
  const date = parse(iso);
  return date ? WEEKDAY_DAY_MONTH.format(date) : '';
}

// « Du 7 nov. au 26 nov. 2026 » — la forme de l'en-tête dans le design.
// L'année n'apparaît qu'une fois, à la fin : un voyage ne chevauche pas deux
// années dans la pratique, et la répéter alourdit une ligne déjà dense.
export function formatTripRange(startIso, endIso) {
  const start = parse(startIso);
  const end = parse(endIso);
  if (!start || !end) return formatPeriod(startIso, endIso);

  return `Du ${DAY_MONTH.format(start)} au ${DAY_MONTH.format(end)} ${end.getFullYear()}`;
}
