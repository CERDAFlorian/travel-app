import { formatStepDates } from '@/lib/dates.js';
import './StepTimeline.scss';

// Frise chronologique navigable.
//
// La largeur de chaque segment est proportionnelle au nombre de nuits : la
// barre donne le rythme du voyage d'un coup d'œil, quatre nuits à Kyoto contre
// une à Shirakawa-go. Le `+ 2.5` vient du design — sans lui, une étape d'une
// nuit se réduit à une bande trop étroite pour porter son libellé.
export default function StepTimeline({ steps, selectedId, onSelect }) {
  return (
    <div className="timeline">
      {steps.map((step) => (
        <button
          key={step.id}
          type="button"
          className="timeline__segment"
          // `--grow` sert au mode défilant : sur mobile les segments ne
          // peuvent plus se partager la largeur, mais ils gardent leur
          // proportion — c'est elle qui donne le rythme du voyage.
          style={{ flexGrow: (step.nights ?? 0) + 2.5, '--grow': (step.nights ?? 0) + 2.5 }}
          data-selected={step.id === selectedId || undefined}
          onClick={() => onSelect(step.id === selectedId ? null : step.id)}
          title={`${step.name} · ${formatStepDates(step.date_start, step.date_end)}`}
        >
          {/* Premier mot seulement : « Matsumoto & Alpes japonaises » ne tient
              dans aucun segment. Le nom complet reste dans l'infobulle. */}
          {step.name.split(' ')[0]} · {step.nights}n
        </button>
      ))}
    </div>
  );
}
