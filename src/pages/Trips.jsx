import { Link } from 'react-router-dom';
import { TRIPS } from '@/data/trips.js';
import { useTheme } from '@/hooks/useTheme.js';
import { APP_THEME } from '@/theme/themes.js';
import './Trips.scss';

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

// Sélection d'un voyage.
//
// La page porte la charte de l'application ; chaque carte porte celle de son
// pays, via data-theme. Les sélecteurs [data-theme='…'] étant autonomes, la
// carte redéfinit --accent, --surface & co. pour son propre sous-arbre : deux
// voyages de deux pays cohabiteront côte à côte, chacun à ses couleurs, sans
// que la page change d'identité.
//
// Pas de création de voyage pour l'instant : volontaire. Le formulaire viendra
// avec le créateur d'itinéraires.
export default function Trips({ email, onSignOut }) {
  useTheme(APP_THEME);

  return (
    <main className="trips">
      <header className="trips__head">
        <p className="eyebrow">Mes voyages</p>
        <h1 className="trips__title">{plural(TRIPS.length, 'voyage', 'voyages')}</h1>
      </header>

      <ul className="trips__list">
        {TRIPS.map((trip) => (
          <li key={trip.slug}>
            <Link
              className="trip-card"
              to={`/voyage/${trip.slug}`}
              data-theme={trip.theme}
            >
              <span className="trip-card__period">{trip.period}</span>
              <span className="trip-card__title">{trip.title}</span>
              <span className="trip-card__subtitle">{trip.subtitle}</span>
              <span className="trip-card__facts">
                {trip.facts.map((fact) => (
                  <span key={fact} className="trip-card__fact">
                    {fact}
                  </span>
                ))}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <footer className="trips__foot">
        <span className="trips__email">{email}</span>
        <button className="trips__signout" type="button" onClick={onSignOut}>
          Déconnexion
        </button>
      </footer>
    </main>
  );
}
