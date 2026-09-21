import { CATEGORIES } from '@/lib/categories.js';
import { formatTripRange } from '@/lib/dates.js';
import StepTimeline from './StepTimeline.jsx';
import './TripHeader.scss';

const GEOGRAPHIC = new Set(CATEGORIES.filter((c) => c.onMap).map((c) => c.key));

// En-tête du voyage — titre, chiffres, frise.
//
// Le décor déborde volontairement du cadre : le momiji mord sur le bord gauche
// (-18px, -14px), le Fuji occupe le coin droit. Le bloc de titre réserve la
// place par ses marges internes, très asymétriques, pour ne jamais passer
// dessous.
export default function TripHeader({ trip, selectedStepId, onSelectStep, back }) {
  const steps = trip.steps;
  const nights = steps.reduce((total, step) => total + (step.nights ?? 0), 0);
  const places = steps.reduce(
    (total, step) => total + step.items.filter((item) => GEOGRAPHIC.has(item.category)).length,
    0,
  );

  return (
    <header className="trip-header">
      <img className="trip-header__momiji" src="/img/deco-momiji.webp" alt="" aria-hidden="true" />
      <img className="trip-header__fuji" src="/img/deco-fuji.webp" alt="" aria-hidden="true" />

      <div className="trip-header__bar">
        <h1 className="trip-header__title">{trip.title}</h1>

        <div className="trip-header__subtitle">
          <div className="trip-header__tagline">— {trip.subtitle}</div>
          <div className="trip-header__dates">{formatTripRange(trip.startDate, trip.endDate)}</div>
        </div>
      </div>

      {/* Le retour et les chiffres partagent une ligne, SOUS le titre et les
          dates : on lit d'abord où l'on va, ensuite de quoi c'est fait. Le
          lien flottait auparavant en position absolue, où il chevauchait le
          décor et volait de la place au titre sur un écran étroit. */}
      <div className="trip-header__summary">
        {back}

        <ul className="trip-header__chips">
          <li className="trip-header__chip">{steps.length} étapes</li>
          <li className="trip-header__chip">{nights} nuits</li>
          {/* Les notes perso sont exclues : « Récupérer le JR Pass » n'est pas
              un lieu. Le design les comptait, à tort. */}
          <li className="trip-header__chip">{places} lieux</li>
        </ul>
      </div>

      <div className="trip-header__timeline">
        <StepTimeline steps={steps} selectedId={selectedStepId} onSelect={onSelectStep} />
      </div>
    </header>
  );
}
