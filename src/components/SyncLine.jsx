import { formatSince } from '@/lib/dates.js';
import './SyncLine.scss';

// Fraîcheur de la donnée affichée, et raison quand elle ne l'est pas.
//
// Trois états, pas deux. Confondre « pas de réseau » et « le serveur a refusé »
// rend l'app indiagnosticable : en production, un jeton périmé s'est affiché
// comme « Hors ligne » alors que la connexion était parfaite, et il a fallu
// vider le cache à l'aveugle pour s'en sortir. Sur place, sans DevTools, il
// faut pouvoir lire ce qui se passe.
export default function SyncLine({ isOffline, syncError, lastSync, onRefresh, onSignIn }) {
  const since = formatSince(lastSync);
  const refused = !isOffline && syncError;

  return (
    <p className="sync" data-state={refused ? 'error' : isOffline ? 'offline' : 'ok'}>
      <span className="sync__dot" aria-hidden="true" />

      {refused ? (
        <>Synchronisation impossible · {syncError.message}</>
      ) : isOffline ? (
        <>Hors ligne{since ? ` · synchronisé ${since}` : ' · jamais synchronisé'}</>
      ) : (
        <>Synchronisé {since ?? "à l'instant"}</>
      )}

      {/* Une session expirée ne se répare pas en réessayant : il faut se
          reconnecter. Proposer « Actualiser » ferait tourner en rond. */}
      {refused && syncError.kind === 'auth' && onSignIn && (
        <button className="sync__action" type="button" onClick={onSignIn}>
          Se reconnecter
        </button>
      )}

      {/* Pas de bouton hors ligne : il ne ferait qu'échouer. Le hook
          resynchronise de lui-même au retour du réseau. */}
      {onRefresh && !isOffline && !(refused && syncError.kind === 'auth') && (
        <button className="sync__action" type="button" onClick={onRefresh}>
          Actualiser
        </button>
      )}
    </p>
  );
}
