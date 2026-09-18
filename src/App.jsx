import { Navigate, Route, Routes } from 'react-router-dom';
import { useSession } from '@/hooks/useSession.js';
import Login from '@/pages/Login.jsx';
import Trips from '@/pages/Trips.jsx';
import Trip from '@/pages/Trip.jsx';
import './App.scss';

export default function App() {
  const { user, loading, signIn, signOut } = useSession();

  // Le temps de relire le jeton stocké. Sans cette attente, l'écran de
  // connexion apparaît une fraction de seconde à chaque ouverture, alors qu'on
  // est déjà connecté.
  if (loading) return <main className="app-boot" aria-busy="true" />;

  // ⚠️ À REPRENDRE EN L2 — cette condition est provisoire.
  //
  // Aujourd'hui l'app n'a rien à afficher sans réseau : le cache n'existe pas
  // encore. L'écran de connexion occupe donc la place quand il n'y a pas de
  // session. Dès que useTrip() existe, la condition devient :
  //
  //     if (!user && !cachedTrips) return <Login … />;
  //
  // et les voyages s'affichent depuis IndexedDB même sans session — c'est toute
  // la promesse de l'app hors ligne.
  //
  // Noter que la connexion n'est PAS une route, et ne doit pas le devenir :
  // rediriger vers /connexion quand le jeton expire expulserait de son
  // itinéraire quelqu'un qui n'a pas de réseau pour se reconnecter. L'écran se
  // substitue au contenu, il ne déplace personne.
  if (!user) return <Login onSignIn={signIn} />;

  return (
    <Routes>
      <Route path="/" element={<Trips email={user.email} onSignOut={signOut} />} />
      <Route path="/voyage/:slug" element={<Trip />} />
      {/* replace : une URL inconnue ne doit pas s'empiler dans l'historique,
          sinon le bouton retour y ramène en boucle. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
