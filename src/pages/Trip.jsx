import { Navigate, useParams } from 'react-router-dom';
import { useTrip } from '@/hooks/useTrip.js';
import { useTheme } from '@/hooks/useTheme.js';
import { APP_THEME } from '@/theme/themes.js';
import TripView from '@/components/TripView.jsx';
import TripProgram from '@/components/TripProgram.jsx';

// Le voyage vu par son propriétaire. Lecture par PostgREST, écriture possible.
//
// `programme` bascule sur la lecture jour par jour. Même page, même chargement,
// même cache : seul le rendu change. Une page séparée aurait dupliqué le hook
// et le thème pour afficher les mêmes données.
export default function Trip({ onRequestLogin, readOnly, programme = false }) {
  const { slug } = useParams();
  const { trip, loading, isOffline, syncError, lastSync, refresh } = useTrip(slug);

  // Le thème du pays vient de la donnée. Tant que le voyage n'est pas chargé,
  // on reste sur la charte de l'app plutôt que de garder celle du précédent.
  useTheme(trip?.theme ?? APP_THEME);

  if (loading) return <main className="app-boot" aria-busy="true" />;

  // Slug inconnu, ou premier lancement hors ligne sans rien en cache.
  if (!trip) return <Navigate to="/" replace />;

  if (programme) return <TripProgram trip={trip} />;

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
