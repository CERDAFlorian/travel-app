import { Link, Navigate, useParams } from 'react-router-dom';
import { findTrip } from '@/data/trips.js';
import { useTheme } from '@/hooks/useTheme.js';
import { APP_THEME } from '@/theme/themes.js';
import './Trip.scss';

const CATEGORIES = [
  { key: 'hotel', label: 'Hôtel' },
  { key: 'activite', label: 'Activités' },
  { key: 'restaurant', label: 'Restaurants' },
  { key: 'shopping', label: 'Shopping' },
  { key: 'lieu', label: 'Lieux touristiques' },
  { key: 'note', label: 'Notes perso' },
];

// L'intérieur d'un voyage — PLACEHOLDER.
//
// C'est ici que L3 posera le vrai contenu : étapes, items, carte. Le slug lu
// dans l'URL est celui que `useTrip(slug)` consommera en L2 ; `findTrip` sera
// alors remplacé par une lecture du cache.
export default function Trip() {
  const { slug } = useParams();
  const trip = findTrip(slug);

  // Un slug inconnu — lien périmé, URL tapée à la main — ramène à la liste
  // plutôt que d'afficher un écran vide. `replace` évite que le retour
  // navigateur y revienne.
  useTheme(trip ? trip.theme : APP_THEME);
  if (!trip) return <Navigate to="/" replace />;

  return (
    <main className="trip">
      <header className="trip__head">
        <Link className="trip__back" to="/">
          ← Mes voyages
        </Link>
        <p className="eyebrow">{trip.period}</p>
        <h1 className="trip__title">{trip.title}</h1>
        <p className="trip__subtitle">{trip.subtitle}</p>
      </header>

      <section className="trip__card">
        <p className="trip__intro">
          Thème du pays actif. Le contenu — étapes, items, carte — arrive aux
          lots suivants.
        </p>
        <ul className="trip__cats">
          {CATEGORIES.map(({ key, label }) => (
            <li key={key} className="trip__cat">
              <span className="trip__dot" data-cat={key} />
              {label}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
