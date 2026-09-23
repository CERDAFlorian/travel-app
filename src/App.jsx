import { useState } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useSession } from '@/hooks/useSession.js';
import { useTrips } from '@/hooks/useTrips.js';
import Login from '@/pages/Login.jsx';
import Trips from '@/pages/Trips.jsx';
import Trip from '@/pages/Trip.jsx';
import SharedTrip from '@/pages/SharedTrip.jsx';
import './App.scss';

function SharedTripRoute() {
  const { token } = useParams();
  return <SharedTrip token={token} />;
}

// Le partage est branché AVANT tout le reste, et c'est le point important :
// cette branche ne monte ni `useSession` ni `useTrips`. Un ami sans compte ne
// déclenche donc aucune requête qui lui serait refusée, et ne peut pas croiser
// l'écran de connexion.
export default function App() {
  return (
    <Routes>
      <Route path="/partage/:token" element={<SharedTripRoute />} />
      <Route path="*" element={<PrivateApp />} />
    </Routes>
  );
}

// La session, et rien d'autre. Les données vivent un cran plus bas, et c'est
// tout l'objet de ce découpage.
function PrivateApp() {
  const { user, loading: sessionLoading, readOnly, signIn, signOut } = useSession();

  if (sessionLoading) {
    return <main className="app-boot" aria-busy="true" />;
  }

  // LA CLÉ REMONTE TOUT QUAND L'UTILISATEUR CHANGE, et ce n'est pas un détail.
  //
  // `useCached` lit le réseau une fois, au montage. À l'ouverture de l'app
  // personne n'est encore connecté : RLS ne rend rien, et la liste vide est
  // mise en cache. Se connecter ensuite ne relançait AUCUN effet — la session
  // apparaissait, l'écran restait vide, et il fallait recharger à la main pour
  // voir ses voyages. Le bug existait déjà ; il était masqué par le cache du
  // compte précédent, qu'on affichait faute de mieux.
  //
  // Changer la clé démonte et remonte tout l'arbre : la lecture repart, cette
  // fois avec la session. Et à la déconnexion, elle repart sans — donc sur une
  // liste vide et l'écran de connexion.
  //
  // `anon` couvre les deux cas où l'on n'a pas de session : jamais connecté, ou
  // jeton expiré hors ligne. Le second doit continuer de rendre le cache, c'est
  // toute la promesse de l'app — d'où un montage, pas un effacement.
  return (
    <AuthedApp
      key={user?.id ?? 'anon'}
      user={user}
      readOnly={readOnly}
      signIn={signIn}
      signOut={signOut}
    />
  );
}

// Les données du compte courant. Remontée à chaque changement d'utilisateur.
function AuthedApp({ user, readOnly, signIn, signOut }) {
  const trips = useTrips();

  // Connexion demandée depuis l'app alors qu'on a déjà du cache : jeton
  // expiré, ou changement de compte. Sans cet état, être déconnecté AVEC du
  // cache était sans issue.
  const [loginRequested, setLoginRequested] = useState(false);

  if (trips.loading) {
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
      {/* replace : une URL inconnue ne doit pas s'empiler dans l'historique,
          sinon le bouton retour y ramène en boucle. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
