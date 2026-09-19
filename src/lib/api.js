import { supabase } from '@/lib/supabase.js';

// Accès réseau — lecture seule.
//
// Deux requêtes en tout : la liste des voyages, et un voyage complet. PostgREST
// imbrique les tables liées en une seule réponse, ce qui évite six allers-retours
// sur un réseau étranger. Volume total d'un voyage : 100 à 300 Ko de JSON.
//
// RLS filtre déjà par appartenance : inutile de filtrer par utilisateur ici, et
// il ne faudrait pas s'en remettre au client pour le faire. Sans session, ces
// requêtes ne ramènent rien — `anon` n'a aucun droit sur ces tables.

// Le tri se fait ici, pas dans la requête. PostgREST sait ordonner une table
// imbriquée, mais la syntaxe est fragile et n'échoue pas bruyamment quand elle
// est fausse : on récupérerait des étapes dans le désordre sans le voir.
const byPosition = (a, b) => (a.position ?? 0) - (b.position ?? 0);

// Pourquoi la requête a échoué. La distinction n'est pas cosmétique : « pas de
// réseau » et « le serveur a refusé » appellent des gestes opposés, et les
// confondre rend l'app indiagnosticable. C'est exactement ce qui s'est passé en
// production le 18 septembre — un jeton périmé s'affichait comme « Hors ligne »
// alors que la connexion était parfaite.
//
// postgrest-js n'expose pas le statut HTTP : il enveloppe l'échec réseau dans
// un objet d'erreur ordinaire. On classe donc sur le message et le code SQLSTATE.
export function classifyFailure(error) {
  const text = `${error?.message ?? ''} ${error?.details ?? ''}`.toLowerCase();
  const code = error?.code ?? '';

  if (/failed to fetch|networkerror|load failed|network request failed/.test(text)) {
    return 'network';
  }
  // PGRST301 : JWT absent ou expiré. 42501 : privilège insuffisant côté Postgres.
  if (code === 'PGRST301' || code === '42501' || /jwt|api key|unauthor|permission denied/.test(text)) {
    return 'auth';
  }
  return 'server';
}

const REASON = {
  network: 'pas de réseau',
  auth: 'session expirée, reconnecte-toi',
};

function fail(error, what) {
  const kind = classifyFailure(error);
  const failure = new Error(`${what} : ${REASON[kind] ?? error.message}`);
  failure.kind = kind;
  // Le message brut de PostgREST reste accessible pour la console : il nomme la
  // table ou la contrainte en cause, ce que le message traduit ne fait pas.
  failure.cause = error;
  throw failure;
}

export async function fetchTrips() {
  const { data, error } = await supabase
    .from('trips')
    .select('id, slug, title, subtitle, start_date, end_date, theme, steps ( nights )')
    .order('start_date', { ascending: true });

  if (error) fail(error, 'Chargement de la liste des voyages');

  return (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    theme: row.theme,
    title: row.title,
    subtitle: row.subtitle,
    startDate: row.start_date,
    endDate: row.end_date,
    // Comptés ici plutôt que demandés à Postgres : sur trois voyages, une
    // agrégation SQL coûterait plus en complexité qu'elle ne rapporte.
    stepCount: row.steps?.length ?? 0,
    nights: (row.steps ?? []).reduce((total, step) => total + (step.nights ?? 0), 0),
  }));
}

const TRIP_SELECT = `
  id, slug, title, subtitle, start_date, end_date, theme,
  steps (
    id, position, name, date_start, date_end, nights, lat, lng, images,
    items (
      id, category, title, url, address, price, currency,
      booked, favorite, position, notes, lat, lng, geocoded_at
    )
  ),
  flights ( id, direction, from_code, to_code, date, dep, arr, airline, flight_no, ref, price, currency ),
  legs ( id, from_step, to_step, mode, duration_min, note ),
  experiences ( id, position, title, description, image, price, currency, url, favorite )
`;

export async function fetchTrip(slug) {
  const { data, error } = await supabase
    .from('trips')
    .select(TRIP_SELECT)
    .eq('slug', slug)
    .maybeSingle();

  if (error) fail(error, `Chargement du voyage « ${slug} »`);
  if (!data) return null;

  const steps = [...(data.steps ?? [])].sort(byPosition).map((step) => ({
    ...step,
    items: [...(step.items ?? [])].sort(byPosition),
  }));

  return {
    id: data.id,
    slug: data.slug,
    theme: data.theme,
    title: data.title,
    subtitle: data.subtitle,
    startDate: data.start_date,
    endDate: data.end_date,
    steps,
    // L'aller avant le retour, quelle que soit la date de saisie.
    flights: [...(data.flights ?? [])].sort((a, b) =>
      a.direction === b.direction ? 0 : a.direction === 'aller' ? -1 : 1,
    ),
    legs: data.legs ?? [],
    experiences: [...(data.experiences ?? [])].sort(byPosition),
  };
}
