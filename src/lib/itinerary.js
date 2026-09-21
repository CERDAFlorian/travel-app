// Enchaînement des dates d'un itinéraire.
//
// LE MODÈLE. Les dates ne sont pas indépendantes : une étape commence le jour
// où la précédente se termine, et dure autant de jours qu'elle compte de
// nuits. Tout découle donc de deux choses — la date de départ du voyage et le
// nombre de nuits de chaque étape.
//
// C'est le modèle du design, et c'est ce qui manquait ici. Les colonnes
// `date_start` / `date_end` restent stockées — la vue partagée et le mode hors
// ligne les lisent telles quelles — mais elles sont désormais RECALCULÉES à
// chaque changement de structure. Sans ça, retirer une étape laissait un trou
// de deux jours que rien ne rattrapait.

const DAY_MS = 86400000;

// 'YYYY-MM-DD' découpé à la main : `new Date(iso)` lit la chaîne comme UTC
// minuit, et l'arithmétique locale peut alors décaler d'un jour.
function parse(iso) {
  const [year, month, day] = String(iso).split('-').map(Number);
  return new Date(year, month - 1, day);
}

function format(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function addDays(iso, days) {
  return format(new Date(parse(iso).getTime() + days * DAY_MS));
}

// Rend, pour chaque étape dans l'ordre, les dates qu'elle DEVRAIT avoir.
// Ne touche à rien : c'est à l'appelant de décider quoi persister.
export function chainDates(startIso, steps) {
  if (!startIso) return [];

  let cursor = startIso;
  return steps.map((step) => {
    const dateStart = cursor;
    const dateEnd = addDays(cursor, step.nights ?? 0);
    cursor = dateEnd;
    return { id: step.id, date_start: dateStart, date_end: dateEnd };
  });
}

// Les seules étapes à écrire : celles dont les dates ont bougé. Sur sept
// étapes, changer une nuit au milieu en déplace quatre, pas sept.
export function datesToUpdate(startIso, steps) {
  return chainDates(startIso, steps).filter((chained) => {
    const step = steps.find((s) => s.id === chained.id);
    return step.date_start !== chained.date_start || step.date_end !== chained.date_end;
  });
}

// Fin du voyage = fin de la dernière étape. `trips.end_date` doit suivre,
// sinon l'en-tête annoncerait une période qui ne correspond plus aux étapes.
export function tripEndDate(startIso, steps) {
  const chained = chainDates(startIso, steps);
  return chained.length > 0 ? chained.at(-1).date_end : startIso;
}
