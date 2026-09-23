// Enchaînement des dates d'un itinéraire.
//
// LE MODÈLE. Les dates ne sont pas indépendantes : une étape commence le jour
// où la précédente se termine, et dure autant de jours qu'elle compte de
// nuits. Tout découle donc de deux choses — la date de départ du voyage et le
// nombre de nuits de chaque étape.
//
// C'est le modèle du design, et c'est ce qui manquait ici. Les colonnes
// `date_start` / `date_end` DES ÉTAPES restent stockées — la vue partagée et le
// mode hors ligne les lisent telles quelles — mais elles sont RECALCULÉES à
// chaque changement de structure. Sans ça, retirer une étape laissait un trou
// de deux jours que rien ne rattrapait.
//
// LES DATES DU VOYAGE, EN REVANCHE, NE SE DÉDUISENT PAS DES ÉTAPES.
// `trips.start_date` et `trips.end_date` sont la FENÊTRE : la période qu'on
// s'est donnée. Elle ne bouge pas parce qu'on ajoute une ville — c'est le
// contenu qui doit tenir dedans, pas l'inverse. Seule l'arrivée du vol aller
// peut recaler le début, parce qu'on ne décide pas de l'heure d'atterrissage.
// `nightsGap` mesure l'écart entre les deux, et c'est lui qui dit s'il reste
// des nuits à placer.

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

// Fin de la CHAÎNE D'ÉTAPES — le lendemain de la dernière nuit posée.
//
// Ce n'est PAS la fin du voyage, et la distinction est récente : `trips.end_date`
// est la fenêtre qu'on s'est donnée, elle ne suit plus les étapes. Cette
// fonction sert à savoir où commence l'étape suivante, rien d'autre.
export function plannedEndDate(startIso, steps) {
  const chained = chainDates(startIso, steps);
  return chained.length > 0 ? chained.at(-1).date_end : startIso;
}

// Date d'arrivée d'un vol : son départ décalé du nombre de jours franchis.
export function flightArrival(flight) {
  if (!flight?.date) return null;
  return addDays(flight.date, flight.arrival_offset_days ?? 0);
}

// Le voyage commence quand on ARRIVE, pas quand on décolle.
//
// Un Genève → Antananarivo décollant le 7 à 15:00 et atterrissant le 8 à
// 17:20 : la première nuit d'hôtel est celle du 8. Faire commencer le voyage
// au décollage décalerait tout l'itinéraire d'un jour, et la première nuit
// serait réservée pour une nuit passée en vol.
//
// On prend le premier vol « aller » daté. S'il n'y en a pas, la date de départ
// saisie fait foi — on ne devine rien.
export function tripStartFromFlights(flights, fallback) {
  const outbound = flights
    .filter((flight) => flight.direction === 'aller' && flight.date)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  return outbound ? flightArrival(outbound) : fallback;
}

// Fin du voyage : le DÉPART du vol retour. On dort à l'hôtel jusqu'au matin du
// décollage, pas jusqu'à l'atterrissage à la maison.
export function tripEndFromFlights(flights, fallback) {
  const inbound = flights
    .filter((flight) => flight.direction === 'retour' && flight.date)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  return inbound ? inbound.date : fallback;
}

export function nightsBetween(startIso, endIso) {
  if (!startIso || !endIso) return null;
  return Math.round((parse(endIso) - parse(startIso)) / DAY_MS);
}

// L'itinéraire tel qu'il doit S'AFFICHER.
//
// Les dates viennent d'ici, pas des colonnes `date_start` / `date_end`. La
// raison est concrète : ajouter un vol aller qui atterrit le lendemain décale
// tout le séjour, et attendre une écriture pour le voir serait absurde — on
// afficherait sciemment des dates fausses en attendant que l'utilisateur
// « touche » quelque chose.
//
// Les colonnes restent écrites à chaque changement de structure : la base
// reste juste pour qui l'interroge directement, et la vue partagée n'a pas
// besoin de rejouer ce calcul. Mais c'est bien le couple (arrivée du vol
// aller, nuits de chaque étape) qui fait foi.
export function resolveItinerary(trip) {
  const start = tripStartFromFlights(trip.flights ?? [], trip.startDate);
  const chained = chainDates(start, trip.steps ?? []);
  const byId = new Map(chained.map((entry) => [entry.id, entry]));

  const steps = (trip.steps ?? []).map((step) => {
    const dates = byId.get(step.id);
    return dates ? { ...step, date_start: dates.date_start, date_end: dates.date_end } : step;
  });

  const plannedNights = steps.reduce((total, step) => total + (step.nights ?? 0), 0);

  // LA FENÊTRE DU VOYAGE — ses dates, celles qu'on annonce.
  //
  // Elle ne se déduit PAS des étapes. Un voyage dure du 17 octobre au 5
  // novembre parce que c'est la période qu'on a posée, et ça ne change pas
  // parce qu'on vient d'ajouter Kyoto. L'en-tête additionnait les nuits
  // planifiées : un séjour de trois semaines s'affichait « du 17 au 17 oct. »
  // à vide, puis grandissait ville après ville. C'était la fenêtre qui
  // suivait le contenu, alors que c'est le contenu qui doit tenir dans la
  // fenêtre.
  //
  // Deux sources, dans cet ordre : le vol retour quand il est daté — c'est lui
  // qui borne vraiment le séjour —, sinon la période saisie à la création.
  const windowEnd = tripEndFromFlights(trip.flights ?? [], null) ?? trip.endDate ?? null;
  const availableNights = windowEnd ? nightsBetween(start, windowEnd) : null;

  // Fin de ce qui est PLANIFIÉ : la dernière nuit posée. Ce n'est plus ce que
  // l'en-tête annonce, mais c'est ce que `nightsGap` compare à la fenêtre.
  const plannedEnd = steps.length > 0 ? steps.at(-1).date_end : start;

  return {
    start,
    // Les dates du voyage. `plannedEnd` dit où en est le remplissage.
    end: windowEnd ?? plannedEnd,
    plannedEnd,
    steps,
    plannedNights,
    // Nuits disponibles entre l'arrivée et la fin de la fenêtre.
    availableNights,
    // > 0 : il reste des nuits à placer. < 0 : le séjour déborde le vol retour.
    // null : pas de vol retour daté, rien à comparer.
    nightsGap: availableNights == null ? null : availableNights - plannedNights,
  };
}

// Le fil chronologique complet : vols ET étapes, dans l'ordre où on les vit.
//
// Le tri se fait sur la date, avec un départage quand elle est la même. On
// prend l'avion AVANT d'arriver à l'étape qui commence ce jour-là — le vol
// passe donc devant. Le retour fait exception : il part de la dernière étape,
// donc après elle.
//
// Un vol intérieur s'intercale tout seul : daté du 15, il se place entre
// l'étape qui commence le 12 et celle qui commence le 16, sans qu'on ait à
// savoir laquelle il relie.
const RANK = { aller: -1, interieur: -0.5, retour: 1 };

export function timelineEntries(steps = [], flights = []) {
  const entries = [
    ...steps.map((step) => ({
      kind: 'step',
      id: step.id,
      date: step.date_start,
      rank: 0,
      step,
    })),
    ...flights
      // Un vol sans date n'a pas de place dans une chronologie. Il reste
      // visible dans son panneau, pas ici.
      .filter((flight) => flight.date)
      .map((flight) => ({
        kind: 'flight',
        id: flight.id,
        date: flight.date,
        rank: RANK[flight.direction] ?? 0,
        flight,
      })),
  ];

  return entries.sort((a, b) => {
    if (a.date !== b.date) return (a.date ?? '').localeCompare(b.date ?? '');
    return a.rank - b.rank;
  });
}

// Déplace une étape d'un cran dans l'itinéraire.
//
// Rend un NOUVEAU tableau, ou le tableau d'origine si le mouvement est
// impossible — première étape vers le haut, dernière vers le bas. L'appelant
// peut donc comparer les références pour savoir s'il y a quelque chose à
// écrire.
//
// Les dates ne sont pas touchées ici : elles se recalculent depuis l'ordre et
// les nuits, c'est `datesToUpdate` qui s'en charge.
export function reorderSteps(steps, stepId, delta) {
  const index = steps.findIndex((step) => step.id === stepId);
  const target = index + delta;

  if (index < 0 || target < 0 || target >= steps.length) return steps;

  const next = [...steps];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function canMoveStep(steps, stepId, delta) {
  const index = steps.findIndex((step) => step.id === stepId);
  return index >= 0 && index + delta >= 0 && index + delta < steps.length;
}
