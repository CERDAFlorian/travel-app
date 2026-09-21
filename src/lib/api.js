import { supabase } from '@/lib/supabase.js';
import { fail } from '@/lib/errors.js';

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
  id, slug, title, subtitle, start_date, end_date, theme, share_token,
  steps (
    id, position, name, date_start, date_end, nights, lat, lng, images,
    items (
      id, category, title, url, address, price, currency,
      booked, favorite, position, notes, lat, lng, geocoded_at
    )
  ),
  flights ( id, direction, from_code, to_code, stops, date, dep, arr, arrival_offset_days, airline, flight_no, ref, price, currency ),
  legs ( id, from_step, to_step, mode, duration_min, note, dep, arr ),
  experiences ( id, position, title, description, image, price, currency, url, favorite )
`;

// Une seule mise en forme pour les deux sources : la requête PostgREST du
// propriétaire et la fonction de partage rendent la même structure. Sans ce
// normaliseur commun, la vue partagée finirait par diverger sans qu'on le voie.
function normalizeTrip(data) {
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
    shareToken: data.share_token ?? null,
    steps,
    // Par date : avec des vols intérieurs, « aller avant retour » ne suffit
    // plus à ordonner un trajet Paris → Tokyo → Fukuoka → Tokyo → Paris.
    // Un vol sans date passe en fin de liste plutôt que de s'intercaler.
    flights: [...(data.flights ?? [])].sort((a, b) =>
      (a.date ?? '9999').localeCompare(b.date ?? '9999'),
    ),
    legs: data.legs ?? [],
    experiences: [...(data.experiences ?? [])].sort(byPosition),
  };
}

export async function fetchTrip(slug) {
  const { data, error } = await supabase
    .from('trips')
    .select(TRIP_SELECT)
    .eq('slug', slug)
    .maybeSingle();

  if (error) fail(error, `Chargement du voyage « ${slug} »`);
  return normalizeTrip(data);
}

// Lecture par lien de partage.
//
// Passe par une fonction `security definer` : `anon` n'a aucun droit sur les
// tables, et la clé publique seule ne lit toujours rien. C'est le jeton, et lui
// seul, qui ouvre la porte. Voir supabase/migrations/0003_partage.sql.
export async function fetchSharedTrip(token) {
  const { data, error } = await supabase.rpc('trip_by_share_token', { p_token: token });

  if (error) fail(error, 'Chargement du voyage partagé');
  // Jeton inconnu ou lien révoqué : la fonction ne rend rien. On ne distingue
  // pas les deux cas — le dire renseignerait qui essaie des jetons au hasard.
  return normalizeTrip(data);
}
