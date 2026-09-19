import { Link, Navigate, useParams } from 'react-router-dom';
import { useTrip } from '@/hooks/useTrip.js';
import { useTheme } from '@/hooks/useTheme.js';
import { APP_THEME } from '@/theme/themes.js';
import { formatPeriod } from '@/lib/dates.js';
import SyncLine from '@/components/SyncLine.jsx';
import StepCard from '@/components/StepCard.jsx';
import './Trip.scss';

// L'itinéraire, en lecture.
//
// Pas d'édition et pas de carte dans ce lot : L4 et L5. Le décor — momiji,
// Fuji, pagode — vient du design ; ce sont des images purement ornementales,
// donc `alt=""` et `aria-hidden`, pour qu'un lecteur d'écran ne les annonce pas.
export default function Trip({ onRequestLogin, readOnly }) {
  const { slug } = useParams();
  const { trip, loading, isOffline, syncError, lastSync, refresh } = useTrip(slug);

  // Le thème du pays vient de la donnée (trips.theme). Tant que le voyage n'est
  // pas chargé, on reste sur la charte de l'app plutôt que de garder celle du
  // voyage précédent.
  useTheme(trip?.theme ?? APP_THEME);

  if (loading) return <main className="app-boot" aria-busy="true" />;

  // Slug inconnu, ou premier lancement hors ligne sans rien en cache : retour à
  // la liste plutôt qu'un écran vide.
  if (!trip) return <Navigate to="/" replace />;

  return (
    <main className="trip">
      <header className="trip__head">
        <img className="trip__deco trip__deco--left" src="/img/deco-momiji.webp" alt="" aria-hidden="true" />
        <img className="trip__deco trip__deco--right" src="/img/deco-fuji.webp" alt="" aria-hidden="true" />

        <Link className="trip__back" to="/">
          ← Mes voyages
        </Link>

        <p className="eyebrow">{formatPeriod(trip.startDate, trip.endDate)}</p>
        <h1 className="trip__title">{trip.title}</h1>
        <p className="trip__subtitle">{trip.subtitle}</p>
        <SyncLine
          isOffline={isOffline}
          syncError={syncError}
          lastSync={lastSync}
          onRefresh={refresh}
          onSignIn={onRequestLogin}
        />
      </header>

      <div className="trip__hero">
        <img
          className="trip__hero-img"
          src="/img/hero-pagode.webp"
          alt=""
          aria-hidden="true"
          // Seule image au-dessus de la ligne de flottaison : elle se charge
          // tout de suite, là où les photos d'étapes sont en lazy.
          fetchPriority="high"
        />
      </div>

      <ol className="trip__steps">
        {trip.steps.map((step) => (
          <StepCard
            key={step.id}
            step={step}
            tripTitle={trip.title}
            readOnly={readOnly}
            // Après chaque écriture on resynchronise le voyage entier plutôt
            // que de rapiécer le cache localement. 300 Ko sur le wifi de la
            // maison, et surtout une seule source de vérité : l'écran montre
            // ce que la base contient, pas ce qu'on suppose y avoir écrit.
            onChanged={refresh}
          />
        ))}
      </ol>
    </main>
  );
}
