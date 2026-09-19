// Pourquoi une requête a échoué.
//
// La distinction n'est pas cosmétique : « pas de réseau » et « le serveur a
// refusé » appellent des gestes opposés, et les confondre rend l'app
// indiagnosticable. C'est ce qui s'est passé en production le 18 septembre — un
// jeton périmé s'affichait comme « Hors ligne » alors que la connexion était
// parfaite.
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

// Lève une erreur traduite, en gardant l'originale en `cause` : le message
// affiché dit quoi faire, celui de PostgREST dit quelle table a refusé.
export function fail(error, what) {
  const kind = classifyFailure(error);
  const failure = new Error(`${what} : ${REASON[kind] ?? error.message}`);
  failure.kind = kind;
  failure.cause = error;
  throw failure;
}
