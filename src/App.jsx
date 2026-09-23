import { useState } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useSession } from '@/hooks/useSession.js';
import { useTrips } from '@/hooks/useTrips.js';
import Login from '@/pages/Login.jsx';
import Trips from '@/pages/Trips.jsx';
import Trip from '@/pages/Trip.jsx';
import SharedTrip from '@/pages/SharedTrip.jsx';
import './App.scss';

function SharedTripRoute({ programme = false }) {
  const { token } = useParams();
  return <SharedTrip token={token} programme={programme} />;
}

// Le partage est branché AVANT tout le reste, et c'est le point important :
// cette branche ne monte ni `useSession` ni `useTrips`. Un ami sans compte ne
// déclenche donc aucune requête qui lui serait refusée, et ne peut pas croiser
// l'écran de connexion.
export default function App() {
  return (
    <Routes>
      <Route path="/partage/:token" element={<SharedTripRoute />} />
      <Route path="/partage/:token/programme" element={<SharedTripRoute programme />} />
      <Route path="*" element={<PrivateApp />} />
    </Routes>
  );
}

function PrivateApp() {
  const { user, loading: sessionLoading, readOnly, signIn, signOut } = useSession();
  const trips = useTrips();

  // Connexion demandée depuis l'app alors qu'on a déjà du cache : jeton
  // expiré, ou changement de compte. Sans cet état, être déconnecté AVEC du
  // cache était sans issue.
  const [loginRequested, setLoginRequested] = useState(false);

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
  // l'itinéraire est là, complet, dans IndexedDB.
  const hasCache = (trips.trips?.length ?? 0) > 0;

  if (!user && (!hasCache || loginRequested)) {
    return (
      <Login
        onSignIn={signIn}
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
        element={<Trip onRequestLogin={user ? null : requestLogin} readOnly={readOnly} />}
      />
      {/* Le programme du voyage entier : la lecture qui sert sur place. */}
      <Route
        path="/voyage/:slug/programme"
        element={<Trip onRequestLogin={user ? null : requestLogin} readOnly={readOnly} programme />}
      />
      {/* replace : une URL inconnue ne doit pas s'empiler dans l'historique,
          sinon le bouton retour y ramène en boucle. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
