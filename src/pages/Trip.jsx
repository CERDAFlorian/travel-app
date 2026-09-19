import { useCallback, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useTrip } from '@/hooks/useTrip.js';
import { useTheme } from '@/hooks/useTheme.js';
import { APP_THEME } from '@/theme/themes.js';
import SyncLine from '@/components/SyncLine.jsx';
import TripHeader from '@/components/TripHeader.jsx';
import FlightsPanel from '@/components/FlightsPanel.jsx';
import StepCard from '@/components/StepCard.jsx';
import TripMap from '@/components/TripMap.jsx';
import TravelTimes from '@/components/TravelTimes.jsx';
import HeroBanner from '@/components/HeroBanner.jsx';
import Experiences from '@/components/Experiences.jsx';
import BudgetPanel from '@/components/BudgetPanel.jsx';
import './Trip.scss';

// L'itinéraire, mis en page comme le design.
//
// Ordre des blocs : en-tête, vols, puis la grille à deux colonnes — étapes à
// gauche, carte collante à droite —, puis le bandeau pagode, les expériences,
// le budget, et la ligne d'itinéraire en pied.
//
// Le bandeau n'est pas sous l'en-tête : il sépare la partie préparation de la
// partie inspiration. C'était l'un de mes écarts au design.
export default function Trip({ onRequestLogin, readOnly }) {
  const { slug } = useParams();
  const { trip, loading, isOffline, syncError, lastSync, refresh } = useTrip(slug);
  const [selectedStepId, setSelectedStepId] = useState(null);

  useTheme(trip?.theme ?? APP_THEME);

  const selectStep = useCallback((stepId) => {
    setSelectedStepId(stepId);
    if (!stepId) return;
    document.getElementById(`step-${stepId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Le trajet est rattaché à l'étape de départ : il se lit en pied de la carte
  // qu'on vient de finir, au moment où l'on se demande comment rejoindre la
  // suivante.
  const legByFromStep = useMemo(() => {
    const map = new Map();
    for (const leg of trip?.legs ?? []) map.set(leg.from_step, leg);
    return map;
  }, [trip]);

  if (loading) return <main className="app-boot" aria-busy="true" />;
  if (!trip) return <Navigate to="/" replace />;

  return (
    <div className="trip">
      <Link className="trip__back" to="/">
        ← Mes voyages
      </Link>

      <TripHeader trip={trip} selectedStepId={selectedStepId} onSelectStep={selectStep} />

      <div className="trip__sync">
        <SyncLine
          isOffline={isOffline}
          syncError={syncError}
          lastSync={lastSync}
          onRefresh={refresh}
          onSignIn={onRequestLogin}
        />
      </div>

      <FlightsPanel flights={trip.flights} />

      <main className="trip__main">
        <section className="trip__steps">
          {trip.steps.map((step) => (
            <StepCard
              key={step.id}
              step={step}
              tripTitle={trip.title}
              readOnly={readOnly}
              selected={step.id === selectedStepId}
              leg={legByFromStep.get(step.id)}
              onSelect={setSelectedStepId}
              // Après chaque écriture on resynchronise le voyage entier plutôt
              // que de rapiécer le cache : une seule source de vérité.
              onChanged={refresh}
            />
          ))}
        </section>

        <aside className="trip__aside">
          <div className="trip__map-card">
            <div className="trip__map-head">
              <h2 className="trip__map-title">La carte du voyage</h2>
              <span className="trip__map-hint">molette pour zoomer · glisser pour déplacer</span>
            </div>
            <TripMap trip={trip} selectedStepId={selectedStepId} onSelectStep={selectStep} />
            <TravelTimes steps={trip.steps} legs={trip.legs} />
          </div>
        </aside>
      </main>

      <HeroBanner steps={trip.steps} />
      <Experiences experiences={trip.experiences} />
      <BudgetPanel trip={trip} />

      <footer className="trip__foot">
        {trip.steps.map((step) => step.name.split(' ')[0]).join(' → ')}
      </footer>
    </div>
  );
}
