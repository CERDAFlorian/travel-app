import { useState } from 'react';
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

  // Connexion demandée depuis l'app alors qu'on a déjà du cache : jeton
  // expiré, ou changement de compte. Sans cet état, être déconnecté AVEC du
  // cache était sans issue — l'app s'affichait en lecture et aucun écran ne
  // permettait de se reconnecter.
  const [loginRequested, setLoginRequested] = useState(false);

  // On attend la session ET la première lecture du cache. Les deux sont des
  // opérations locales de quelques millisecondes.
  if (sessionLoading || trips.loading) {
    return <main className="app-boot" aria-busy="true" />;
  }

  // La connexion s'impose quand il n'y a NI session NI cache — donc au tout
  // premier lancement. Elle reste accessible à la demande le reste du temps,
  // sans jamais s'imposer.
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

  if (!user && (!hasCache || loginRequested)) {
    return (
      <Login
        onSignIn={signIn}
        // Échappatoire : tant qu'il y a du cache, on doit pouvoir refermer le
        // formulaire et continuer à lire son itinéraire.
        onDismiss={hasCache ? () => setLoginRequested(false) : null}
      />
    );
  }

  const requestLogin = () => setLoginRequested(true);

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Trips
            trips={trips.trips}
            isOffline={trips.isOffline}
            syncError={trips.syncError}
            lastSync={trips.lastSync}
            onRefresh={trips.refresh}
            email={user?.email ?? null}
            onSignOut={user ? signOut : null}
            onRequestLogin={user ? null : requestLogin}
          />
        }
      />
      <Route
        path="/voyage/:slug"
        element={<Trip onRequestLogin={user ? null : requestLogin} />}
      />
      {/* replace : une URL inconnue ne doit pas s'empiler dans l'historique,
          sinon le bouton retour y ramène en boucle. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
