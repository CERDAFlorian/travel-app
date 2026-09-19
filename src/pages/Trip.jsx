import { useCallback, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useTrip } from '@/hooks/useTrip.js';
import { useTheme } from '@/hooks/useTheme.js';
import { APP_THEME } from '@/theme/themes.js';
import { formatPeriod } from '@/lib/dates.js';
import SyncLine from '@/components/SyncLine.jsx';
import StepCard from '@/components/StepCard.jsx';
import TripStats from '@/components/TripStats.jsx';
import StepTimeline from '@/components/StepTimeline.jsx';
import TripMap from '@/components/TripMap.jsx';
import './Trip.scss';

// L'itinéraire.
//
// La frise, la carte et la liste partagent un même `selectedStepId` : cliquer
// une épingle met en avant la carte d'étape, cliquer un segment recentre la
// lecture. C'est la raison pour laquelle la frise appartient à ce lot et pas au
// précédent — avant la carte, elle n'aurait rien eu à sélectionner.
export default function Trip({ onRequestLogin, readOnly }) {
  const { slug } = useParams();
  const { trip, loading, isOffline, syncError, lastSync, refresh } = useTrip(slug);
  const [selectedStepId, setSelectedStepId] = useState(null);

  useTheme(trip?.theme ?? APP_THEME);

  // Sélectionner amène l'étape sous les yeux. Sans ça, cliquer une épingle en
  // haut de page ne montre rien : la carte correspondante est à deux écrans
  // plus bas.
  const selectStep = useCallback((stepId) => {
    setSelectedStepId(stepId);
    if (!stepId) return;
    const target = document.getElementById(`step-${stepId}`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  if (loading) return <main className="app-boot" aria-busy="true" />;
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
        <TripStats steps={trip.steps} />
        <StepTimeline steps={trip.steps} selectedId={selectedStepId} onSelect={selectStep} />
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
          fetchPriority="high"
        />
      </div>

      <TripMap trip={trip} selectedStepId={selectedStepId} onSelectStep={selectStep} />

      <ol className="trip__steps">
        {trip.steps.map((step) => (
          <StepCard
            key={step.id}
            step={step}
            tripTitle={trip.title}
            readOnly={readOnly}
            selected={step.id === selectedStepId}
            // Après chaque écriture on resynchronise le voyage entier plutôt
            // que de rapiécer le cache localement. 300 Ko sur le wifi de la
            // maison, et surtout une seule source de vérité.
            onChanged={refresh}
          />
        ))}
      </ol>
    </main>
  );
}
