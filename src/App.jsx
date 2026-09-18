import { Navigate, Route, Routes } from 'react-router-dom';
import { useSession } from '@/hooks/useSession.js';
import { useTrips } from '@/hooks/useTrips.js';
import Login from '@/pages/Login.jsx';
import Trips from '@/pages/Trips.jsx';
import Trip from '@/pages/Trip.jsx';
import './App.scss';

export default function App() {
  const { user, loading: sessionLoading, signIn, signOut } = useSession();
  const trips = useTrips();

  // On attend la session ET la première lecture du cache. Les deux sont des
  // opérations locales de quelques millisecondes : rien d'inutile à afficher
  // entre-temps.
  if (sessionLoading || trips.loading) {
    return <main className="app-boot" aria-busy="true" />;
  }

  // La connexion s'impose seulement quand il n'y a NI session NI cache — donc
  // au tout premier lancement, et jamais après.
  //
  // C'est la règle centrale du projet : le rendu n'est pas conditionné à
  // l'authentification. Le jeton expire en une heure et son renouvellement
  // passe par le réseau ; hors ligne au Japon, `user` est null alors que
  // l'itinéraire est là, complet, dans IndexedDB. Écrire `if (!user)` ici
  // renverrait sur un formulaire de connexion impossible à valider.
  //
  // La connexion n'est pas non plus une route : une redirection vers
  // /connexion aurait le même effet, en pire, parce qu'elle changerait l'URL.
  const hasCache = (trips.trips?.length ?? 0) > 0;
  if (!user && !hasCache) return <Login onSignIn={signIn} />;

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Trips
            trips={trips.trips}
            isOffline={trips.isOffline}
            lastSync={trips.lastSync}
            onRefresh={trips.refresh}
            email={user?.email ?? null}
            onSignOut={user ? signOut : null}
          />
        }
      />
      <Route path="/voyage/:slug" element={<Trip />} />
      {/* replace : une URL inconnue ne doit pas s'empiler dans l'historique,
          sinon le bouton retour y ramène en boucle. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
