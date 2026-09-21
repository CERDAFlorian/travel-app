import { formatDay, formatStepDates } from '@/lib/dates.js';
import { flightArrival } from '@/lib/itinerary.js';
import { useDragScroll } from '@/hooks/useDragScroll.js';
import './StepTimeline.scss';

const DIRECTION = { aller: 'Aller', interieur: 'Vol', retour: 'Retour' };

// Frise chronologique navigable — vols et étapes.
//
// La largeur d'une étape est proportionnelle à son nombre de nuits : la barre
// donne le rythme du voyage d'un coup d'œil, quatre nuits à Kyoto contre une à
// Shirakawa-go. Le `+ 2.5` vient du design — sans lui, une étape d'une nuit se
// réduit à une bande trop étroite pour porter son libellé.
//
// Un vol n'a pas de nuits : il prend une largeur fixe, volontairement étroite.
// Il marque une transition, il n'occupe pas de temps de séjour.
const FLIGHT_GROW = 2;

export default function StepTimeline({ entries, selectedId, onSelectStep, onSelectFlight }) {
  // Le glisser à la souris n'existe pas nativement sur un conteneur défilant.
  const ref = useDragScroll();

  return (
    <div className="timeline" ref={ref}>
      {entries.map((entry) =>
        entry.kind === 'flight' ? (
          <FlightSegment key={entry.id} flight={entry.flight} onSelect={onSelectFlight} />
        ) : (
          <StepSegment
            key={entry.id}
            step={entry.step}
            selected={entry.id === selectedId}
            onSelect={onSelectStep}
          />
        ),
      )}
    </div>
  );
}

function StepSegment({ step, selected, onSelect }) {
  const grow = (step.nights ?? 0) + 2.5;

  return (
    <button
      type="button"
      className="timeline__segment"
      // `--grow` sert au mode défilant : sur mobile les segments ne peuvent
      // plus se partager la largeur, mais ils gardent leur proportion.
      style={{ flexGrow: grow, '--grow': grow }}
      data-selected={selected || undefined}
      onClick={() => onSelect(selected ? null : step.id)}
      title={`${step.name} · ${formatStepDates(step.date_start, step.date_end)}`}
    >
      {/* Premier mot seulement : « Matsumoto & Alpes japonaises » ne tient
          dans aucun segment. Le nom complet reste dans l'infobulle. */}
      {step.name.split(' ')[0]} · {step.nights}n
    </button>
  );
}

function FlightSegment({ flight, onSelect }) {
  const offset = flight.arrival_offset_days ?? 0;
  const dates =
    offset === 0
      ? formatDay(flight.date)
      : `${formatDay(flight.date)} → ${formatDay(flightArrival(flight))}`;

  return (
    <button
      type="button"
      className="timeline__segment timeline__segment--flight"
      style={{ flexGrow: FLIGHT_GROW, '--grow': FLIGHT_GROW }}
      onClick={() => onSelect?.()}
      title={`${DIRECTION[flight.direction] ?? 'Vol'} ${flight.from_code ?? ''} → ${flight.to_code ?? ''} · ${dates}`}
    >
      <span aria-hidden="true">✈</span>
      {/* Le code d'arrivée suffit : sur la frise on lit où l'on va, pas d'où
          l'on vient — l'étape précédente le dit déjà. */}
      <span className="sr-only">
        {DIRECTION[flight.direction] ?? 'Vol'} vers{' '}
      </span>
      {flight.to_code ?? '···'}
    </button>
  );
}
