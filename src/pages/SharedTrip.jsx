import { useSharedTrip } from '@/hooks/useSharedTrip.js';
import { useTheme } from '@/hooks/useTheme.js';
import { APP_THEME } from '@/theme/themes.js';
import TripView from '@/components/TripView.jsx';
import './SharedTrip.scss';

// Le voyage vu par quelqu'un qui n'a pas de compte.
//
// Cette page est volontairement HORS du contrôle de session : elle se rend
// avant que l'app ne se demande qui est connecté. Un ami qui ouvre le lien ne
// doit jamais croiser l'écran de connexion.
//
// Elle est en lecture seule par construction : `anon` n'a aucun droit
// d'écriture, et la fonction de partage ne rend que des données.
export default function SharedTrip({ token }) {
  const { trip, loading, isOffline, syncError, lastSync, refresh } = useSharedTrip(token);

  useTheme(trip?.theme ?? APP_THEME);

  if (loading) return <main className="app-boot" aria-busy="true" />;

  // Jeton inconnu, lien révoqué, ou lien correct consulté hors ligne sans
  // cache. On ne distingue pas les cas : préciser lequel renseignerait qui
  // essaie des jetons au hasard.
  if (!trip) {
    return (
      <main className="dead-link">
        <h1 className="dead-link__title">Ce lien ne mène à rien</h1>
        <p className="dead-link__text">
          Il a peut-être été révoqué, ou l'adresse est incomplète. Demande-en un nouveau
          à la personne qui te l'a envoyé.
        </p>
      </main>
    );
  }

  return (
    <TripView
      trip={trip}
      readOnly
      shared
      isOffline={isOffline}
      syncError={syncError}
      lastSync={lastSync}
      onRefresh={refresh}
      onChanged={refresh}
    />
  );
}
