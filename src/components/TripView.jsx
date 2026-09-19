import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import SyncLine from '@/components/SyncLine.jsx';
import TripHeader from '@/components/TripHeader.jsx';
import FlightsPanel from '@/components/FlightsPanel.jsx';
import StepCard from '@/components/StepCard.jsx';
import TripMap from '@/components/TripMap.jsx';
import TravelTimes from '@/components/TravelTimes.jsx';
import HeroBanner from '@/components/HeroBanner.jsx';
import Experiences from '@/components/Experiences.jsx';
import BudgetPanel from '@/components/BudgetPanel.jsx';
import ShareLink from '@/components/ShareLink.jsx';
import { removeStep } from '@/lib/mutations.js';
import './TripView.scss';

// L'itinéraire, mis en page comme le design.
//
// Ce composant sert DEUX entrées : la page du propriétaire (`/voyage/:slug`,
// lue par PostgREST) et la vue partagée (`/partage/:token`, lue par la
// fonction de partage). Les deux rendent exactement la même chose — c'est
// délibéré : une vue partagée qui divergerait finirait par mentir sur ce que
// voit réellement la personne à qui on a envoyé le lien.
//
// Ordre des blocs : en-tête, vols, grille à deux colonnes — étapes à gauche,
// carte collante à droite —, bandeau pagode, expériences, budget, ligne
// d'itinéraire en pied. Le bandeau sépare la préparation de l'inspiration.
export default function TripView({
  trip,
  readOnly,
  shared = false,
  isOffline,
  syncError,
  lastSync,
  onRefresh,
  onRequestLogin,
  onChanged,
}) {
  const [selectedStepId, setSelectedStepId] = useState(null);

  const selectStep = useCallback((stepId) => {
    setSelectedStepId(stepId);
    if (!stepId) return;
    document.getElementById(`step-${stepId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleRemoveStep = useCallback(
    async (stepId) => {
      await removeStep(stepId, trip.steps);
      await onChanged();
    },
    [trip.steps, onChanged],
  );

  // Le trajet est rattaché à l'étape de départ : il se lit en pied de la carte
  // qu'on vient de finir, au moment où l'on se demande comment rejoindre la
  // suivante.
  const legByFromStep = useMemo(() => {
    const map = new Map();
    for (const leg of trip.legs ?? []) map.set(leg.from_step, leg);
    return map;
  }, [trip]);

  return (
    <div className="trip">
      {shared ? (
        <p className="trip__shared">Vue partagée · lecture seule</p>
      ) : (
        <Link className="trip__back" to="/">
          ← Mes voyages
        </Link>
      )}

      <TripHeader trip={trip} selectedStepId={selectedStepId} onSelectStep={selectStep} />

      <div className="trip__strip">
        <SyncLine
          isOffline={isOffline}
          syncError={syncError}
          lastSync={lastSync}
          onRefresh={onRefresh}
          onSignIn={onRequestLogin}
        />
        <ShareLink trip={trip} readOnly={readOnly} onChanged={onChanged} />
      </div>

      <FlightsPanel trip={trip} readOnly={readOnly} onChanged={onChanged} />

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
              onRemove={handleRemoveStep}
              // Après chaque écriture on resynchronise le voyage entier plutôt
              // que de rapiécer le cache : une seule source de vérité.
              onChanged={onChanged}
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
