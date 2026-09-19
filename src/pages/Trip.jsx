import { Navigate, useParams } from 'react-router-dom';
import { useTrip } from '@/hooks/useTrip.js';
import { useTheme } from '@/hooks/useTheme.js';
import { APP_THEME } from '@/theme/themes.js';
import TripView from '@/components/TripView.jsx';

// Le voyage vu par son propriétaire. Lecture par PostgREST, écriture possible.
export default function Trip({ onRequestLogin, readOnly }) {
  const { slug } = useParams();
  const { trip, loading, isOffline, syncError, lastSync, refresh } = useTrip(slug);

  // Le thème du pays vient de la donnée. Tant que le voyage n'est pas chargé,
  // on reste sur la charte de l'app plutôt que de garder celle du précédent.
  useTheme(trip?.theme ?? APP_THEME);

  if (loading) return <main className="app-boot" aria-busy="true" />;

  // Slug inconnu, ou premier lancement hors ligne sans rien en cache.
  if (!trip) return <Navigate to="/" replace />;

  return (
    <TripView
      trip={trip}
      readOnly={readOnly}
      isOffline={isOffline}
      syncError={syncError}
      lastSync={lastSync}
      onRefresh={refresh}
      onRequestLogin={onRequestLogin}
      onChanged={refresh}
    />
  );
}
