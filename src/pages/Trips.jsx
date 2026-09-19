import { Link } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme.js';
import { APP_THEME } from '@/theme/themes.js';
import { formatPeriod } from '@/lib/dates.js';
import SyncLine from '@/components/SyncLine.jsx';
import './Trips.scss';

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

// Sélection d'un voyage.
//
// La page porte la charte de l'application ; chaque carte porte celle de son
// pays, via data-theme. Les sélecteurs [data-theme='…'] étant autonomes, la
// carte redéfinit --accent, --surface & co. pour son propre sous-arbre : deux
// voyages de deux pays cohabitent côte à côte, chacun à ses couleurs, sans que
// la page change d'identité.
//
// Pas de création de voyage pour l'instant : volontaire. Le formulaire viendra
// avec le créateur d'itinéraires.
export default function Trips({
  trips,
  isOffline,
  syncError,
  lastSync,
  onRefresh,
  email,
  onSignOut,
  onRequestLogin,
}) {
  useTheme(APP_THEME);

  const list = trips ?? [];

  return (
    <main className="trips">
      <header className="trips__head">
        <p className="eyebrow">Mes voyages</p>
        <h1 className="trips__title">{plural(list.length, 'voyage', 'voyages')}</h1>
        <SyncLine
          isOffline={isOffline}
          syncError={syncError}
          lastSync={lastSync}
          onRefresh={onRefresh}
          onSignIn={onRequestLogin}
        />
      </header>

      {list.length === 0 ? (
        <p className="trips__empty">
          Aucun voyage pour l'instant.
          {isOffline && " Reconnecte-toi au réseau pour aller les chercher."}
        </p>
      ) : (
        <ul className="trips__list">
          {list.map((trip) => (
            <li key={trip.slug}>
              <Link className="trip-card" to={`/voyage/${trip.slug}`} data-theme={trip.theme}>
                <span className="trip-card__period">
                  {formatPeriod(trip.startDate, trip.endDate)}
                </span>
                <span className="trip-card__title">{trip.title}</span>
                <span className="trip-card__subtitle">{trip.subtitle}</span>
                <span className="trip-card__facts">
                  <span className="trip-card__fact">
                    {plural(trip.stepCount, 'étape', 'étapes')}
                  </span>
                  <span className="trip-card__fact">
                    {plural(trip.nights, 'nuit', 'nuits')}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <footer className="trips__foot">
        <span className="trips__email">{email ?? 'Non connecté · lecture seule'}</span>
        {onSignOut && (
          <button className="trips__signout" type="button" onClick={onSignOut}>
            Déconnexion
          </button>
        )}
        {onRequestLogin && (
          <button className="trips__signout" type="button" onClick={onRequestLogin}>
            Se connecter
          </button>
        )}
      </footer>
    </main>
  );
}
