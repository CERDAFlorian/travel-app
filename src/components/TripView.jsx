import { Fragment, useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import SyncLine from '@/components/SyncLine.jsx';
import TripHeader from '@/components/TripHeader.jsx';
import StepTimeline from '@/components/StepTimeline.jsx';
import FlightsPanel from '@/components/FlightsPanel.jsx';
import StepCard from '@/components/StepCard.jsx';
import TripMap from '@/components/TripMap.jsx';
import TravelTimes from '@/components/TravelTimes.jsx';
import HeroBanner from '@/components/HeroBanner.jsx';
import Experiences from '@/components/Experiences.jsx';
import BudgetPanel from '@/components/BudgetPanel.jsx';
import ShareLink from '@/components/ShareLink.jsx';
import NightsGap from '@/components/NightsGap.jsx';
import LocateAll from '@/components/LocateAll.jsx';
import AddStep from '@/components/AddStep.jsx';
import StepLink from '@/components/StepLink.jsx';
import LoveNote from '@/components/LoveNote.jsx';
import { addStep, moveStep, removeStep, setStepNights } from '@/lib/mutations.js';
import { resolveItinerary, timelineEntries } from '@/lib/itinerary.js';
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

  // Vols et étapes dans l'ordre où on les vit. Un vol intérieur s'intercale
  // tout seul à sa date, sans qu'on ait à savoir quelles étapes il relie.
  const entries = useMemo(
    () => timelineEntries(itinerary.steps, view.flights),
    [itinerary.steps, view.flights],
  );

  // Cliquer un vol amène au panneau des billets. Sur mobile il peut être
  // replié : on l'ouvre au passage, sinon on enverrait vers un bloc fermé.
  const showFlights = useCallback(() => {
    const target = document.getElementById('vols');
    target?.querySelector('[aria-expanded="false"]')?.click();
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleRemoveStep = useCallback(
    async (stepId) => {
      await removeStep(view, stepId);
      await onChanged();
    },
    [view, onChanged],
  );

  const handleMoveStep = useCallback(
    async (stepId, delta) => {
      await moveStep(view, stepId, delta);
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

      {/* Collante sur mobile : en faisant défiler sept étapes, on garde sous
          les yeux où l'on en est dans le voyage, et de quoi sauter ailleurs.
          Sortie de l'en-tête pour ça — voir TripHeader. */}
      <div className="trip__timeline">
        <StepTimeline
          entries={entries}
          selectedId={selectedStepId}
          onSelectStep={selectStep}
          onSelectFlight={showFlights}
        />
      </div>

      {/* Ne s'affiche que s'il y a quelque chose à signaler — hors ligne ou
          synchronisation refusée. */}
      <div className="trip__strip">
        <SyncLine
          isOffline={isOffline}
          syncError={syncError}
          lastSync={lastSync}
          onRefresh={onRefresh}
          onSignIn={onRequestLogin}
        />
      </div>

      <FlightsPanel trip={view} readOnly={readOnly} onChanged={onChanged} />

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
                  onMove={handleMoveStep}
                  canMoveUp={index > 0}
                  canMoveDown={index < view.steps.length - 1}
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

          {/* Apres la derniere ville : on lit d'abord les nuits qu'on a
              posees, ensuite celles qui manquent. Entre les vols et la
              premiere etape, la remarque arrivait avant qu'on ait de quoi la
              comprendre. */}
          <NightsGap gap={itinerary.nightsGap} />

          {!readOnly && <AddStep onAdd={handleAddStep} />}
        </section>

        <aside className="trip__aside">
          <div className="trip__map-card">
            <div className="trip__map-head">
              <h2 className="trip__map-title">La carte du voyage</h2>
              {/* L'indication « molette pour zoomer » disait ce que tout le
                  monde essaie de toute façon. La place sert mieux à une
                  action. */}
              <LocateAll trip={view} readOnly={readOnly} onChanged={onChanged} />
            </div>
            <TripMap trip={view} selectedStepId={selectedStepId} onSelectStep={selectStep} />
            <TravelTimes steps={view.steps} legs={view.legs} />
          </div>
        </aside>
      </main>

      <HeroBanner steps={view.steps} startDate={view.startDate} />
      <Experiences experiences={view.experiences} />
      <BudgetPanel trip={view} />

      {/* Le partage tout en bas : c'est ce qu'on fait une fois l'itinéraire
          prêt, pas en le préparant. */}
      <div className="trip__share">
        <ShareLink trip={view} readOnly={readOnly} onChanged={onChanged} />
      </div>

      <footer className="trip__foot">
        <LoveNote seed={trip.id ?? trip.slug} />
      </footer>
    </div>
  );
}
