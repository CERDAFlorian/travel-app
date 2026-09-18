import { Link, Navigate, useParams } from 'react-router-dom';
import { useTrip } from '@/hooks/useTrip.js';
import { useTheme } from '@/hooks/useTheme.js';
import { APP_THEME } from '@/theme/themes.js';
import { formatPeriod } from '@/lib/dates.js';
import SyncLine from '@/components/SyncLine.jsx';
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
// L3 posera ici le vrai contenu : étapes dépliables, items, carte. Cet écran
// n'affiche pour l'instant qu'un relevé de ce que la couche données a ramené,
// parce que c'est ce qui permet de vérifier L2 à l'œil : si les sept étapes et
// les quarante-huit items sont là hors ligne, le cache fait son travail.
export default function Trip() {
  const { slug } = useParams();
  const { trip, loading, isOffline, lastSync, refresh } = useTrip(slug);

  // Le thème du pays vient maintenant de la donnée (trips.theme), plus d'un
  // tableau en dur. Tant que le voyage n'est pas chargé, on reste sur la
  // charte de l'app plutôt que de garder celle du voyage précédent.
  useTheme(trip?.theme ?? APP_THEME);

  if (loading) return <main className="app-boot" aria-busy="true" />;

  // Slug inconnu, ou premier lancement hors ligne sans rien en cache : retour à
  // la liste plutôt qu'un écran vide. `replace` évite que le bouton retour y
  // ramène en boucle.
  if (!trip) return <Navigate to="/" replace />;

  const itemCount = trip.steps.reduce((total, step) => total + step.items.length, 0);
  const countFor = (category) =>
    trip.steps.reduce(
      (total, step) => total + step.items.filter((item) => item.category === category).length,
      0,
    );

  return (
    <main className="trip">
      <header className="trip__head">
        <Link className="trip__back" to="/">
          ← Mes voyages
        </Link>
        <p className="eyebrow">{formatPeriod(trip.startDate, trip.endDate)}</p>
        <h1 className="trip__title">{trip.title}</h1>
        <p className="trip__subtitle">{trip.subtitle}</p>
        <SyncLine isOffline={isOffline} lastSync={lastSync} onRefresh={refresh} />
      </header>

      <section className="trip__card">
        <p className="trip__intro">
          Couche données branchée : {trip.steps.length} étapes, {itemCount} items,{' '}
          {trip.legs.length} liaisons, {trip.flights.length} vols,{' '}
          {trip.experiences.length} expériences. L'affichage réel arrive en L3.
        </p>

        <ul className="trip__cats">
          {CATEGORIES.map(({ key, label }) => (
            <li key={key} className="trip__cat">
              <span className="trip__dot" data-cat={key} />
              {label}
              <span className="trip__count">{countFor(key)}</span>
            </li>
          ))}
        </ul>
      </section>

      <ol className="trip__steps">
        {trip.steps.map((step) => (
          <li key={step.id} className="trip__step">
            <span className="trip__step-position">{step.position}</span>
            <span className="trip__step-name">{step.name}</span>
            <span className="trip__step-meta">
              {step.nights} {step.nights > 1 ? 'nuits' : 'nuit'} · {step.items.length} items
            </span>
          </li>
        ))}
      </ol>
    </main>
  );
}
