import { Fragment, useCallback, useMemo, useState } from 'react';
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
import AddStep from '@/components/AddStep.jsx';
import StepLink from '@/components/StepLink.jsx';
import { addStep, removeStep, setStepNights } from '@/lib/mutations.js';
import { resolveItinerary } from '@/lib/itinerary.js';
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
  const [justAddedStep, setJustAddedStep] = useState(null);

  // Les dates affichées sont DÉRIVÉES de l'arrivée du vol aller et du nombre
  // de nuits, pas lues dans `date_start` / `date_end`. Ajouter un vol qui
  // atterrit le lendemain décale tout le séjour, et il serait absurde
  // d'afficher des dates fausses en attendant une écriture.
  //
  // `view` remplace `trip` partout en dessous : composants d'affichage comme
  // mutations. Les écritures persistent donc exactement ce qui est à l'écran.
  const itinerary = useMemo(() => resolveItinerary(trip), [trip]);
  const view = useMemo(
    () => ({ ...trip, steps: itinerary.steps, startDate: itinerary.start, endDate: itinerary.end }),
    [trip, itinerary],
  );

  const selectStep = useCallback((stepId) => {
    setSelectedStepId(stepId);
    if (!stepId) return;
    document.getElementById(`step-${stepId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleRemoveStep = useCallback(
    async (stepId) => {
      await removeStep(view, stepId);
      await onChanged();
    },
    [view, onChanged],
  );

  const handleNights = useCallback(
    async (stepId, nights) => {
      await setStepNights(view, stepId, nights);
      await onChanged();
    },
    [view, onChanged],
  );

  const handleAddStep = useCallback(
    async (values) => {
      const id = await addStep(view, values);
      setJustAddedStep(id);
      await onChanged();
    },
    [view, onChanged],
  );

  // Le trajet est rattaché à l'étape de départ : il se lit en pied de la carte
  // qu'on vient de finir, au moment où l'on se demande comment rejoindre la
  // suivante.
  // Un trajet est identifié par le COUPLE d'étapes, pas par son départ seul :
  // une liaison vers une étape non adjacente s'afficherait sinon au mauvais
  // endroit.
  const legBetween = useMemo(() => {
    const map = new Map();
    for (const leg of view.legs ?? []) map.set(`${leg.from_step}>${leg.to_step}`, leg);
    return (from, to) => map.get(`${from}>${to}`) ?? null;
  }, [view]);

  return (
    <div className="trip">
      <TripHeader
        trip={view}
        selectedStepId={selectedStepId}
        onSelectStep={selectStep}
        back={
          shared ? (
            <p className="trip__shared">Vue partagée · lecture seule</p>
          ) : (
            <Link className="trip__back" to="/">
              ← Mes voyages
            </Link>
          )
        }
      />

      <div className="trip__strip">
        <SyncLine
          isOffline={isOffline}
          syncError={syncError}
          lastSync={lastSync}
          onRefresh={onRefresh}
          onSignIn={onRequestLogin}
        />
        <ShareLink trip={view} readOnly={readOnly} onChanged={onChanged} />
      </div>

      <FlightsPanel trip={view} itinerary={itinerary} readOnly={readOnly} onChanged={onChanged} />

      <main className="trip__main">
        <section className="trip__steps">
          {view.steps.map((step, index) => {
            const next = view.steps[index + 1];

            return (
              <Fragment key={step.id}>
                <StepCard
                  step={step}
                  tripTitle={view.title}
                  readOnly={readOnly}
                  selected={step.id === selectedStepId}
                  onSelect={setSelectedStepId}
                  onRemove={handleRemoveStep}
                  onNights={handleNights}
                  autoLocate={step.id === justAddedStep}
                  // Après chaque écriture on resynchronise le voyage entier
                  // plutôt que de rapiécer le cache : une seule source de
                  // vérité.
                  onChanged={onChanged}
                />

                {/* Le trajet appartient à l'intervalle, pas à la ville qu'on
                    quitte : il se pose donc entre les deux cartes. */}
                {next && (
                  <StepLink
                    trip={view}
                    fromStep={step}
                    toStep={next}
                    leg={legBetween(step.id, next.id)}
                    readOnly={readOnly}
                    onChanged={onChanged}
                  />
                )}
              </Fragment>
            );
          })}

          {!readOnly && <AddStep onAdd={handleAddStep} />}
        </section>

        <aside className="trip__aside">
          <div className="trip__map-card">
            <div className="trip__map-head">
              <h2 className="trip__map-title">La carte du voyage</h2>
              <span className="trip__map-hint">molette pour zoomer · glisser pour déplacer</span>
            </div>
            <TripMap trip={view} selectedStepId={selectedStepId} onSelectStep={selectStep} />
            <TravelTimes steps={view.steps} legs={view.legs} />
          </div>
        </aside>
      </main>

      <HeroBanner steps={view.steps} />
      <Experiences experiences={view.experiences} />
      <BudgetPanel trip={view} />

      <footer className="trip__foot">
        {view.steps.map((step) => step.name.split(' ')[0]).join(' → ')}
      </footer>
    </div>
  );
}
