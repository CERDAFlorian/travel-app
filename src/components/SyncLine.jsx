import { formatSince } from '@/lib/dates.js';
import './SyncLine.scss';

// Fraîcheur de la donnée affichée.
//
// Discret quand tout va bien, explicite quand ce qui est à l'écran sort du
// cache. C'est une information dont on a réellement besoin sur place : savoir
// si l'horaire de train qu'on lit a été synchronisé ce matin ou il y a trois
// jours change ce qu'on en fait.
export default function SyncLine({ isOffline, lastSync, onRefresh }) {
  const since = formatSince(lastSync);

  return (
    <p className="sync" data-offline={isOffline || undefined}>
      {isOffline ? (
        <>
          <span className="sync__dot" aria-hidden="true" />
          Hors ligne{since ? ` · synchronisé ${since}` : ' · jamais synchronisé'}
        </>
      ) : (
        <>Synchronisé {since ?? "à l'instant"}</>
      )}

      {/* Pas de bouton hors ligne : il ne ferait qu'échouer. Le hook resynchronise
          de lui-même au retour du réseau, au prochain montage. */}
      {onRefresh && !isOffline && (
        <button className="sync__refresh" type="button" onClick={onRefresh}>
          Actualiser
        </button>
      )}
    </p>
  );
}
