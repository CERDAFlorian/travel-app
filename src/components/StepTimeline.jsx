import { formatStepDates } from '@/lib/dates.js';
import './StepTimeline.scss';

// Frise chronologique navigable.
//
// Ce n'est pas un fil d'Ariane : la largeur de chaque segment est
// proportionnelle au nombre de nuits, si bien que la barre donne le rythme du
// voyage d'un coup d'œil — quatre nuits à Kyoto se voient contre une à
// Shirakawa-go.
//
// Le `+ 2.5` vient du design : sans lui, une étape d'une nuit se réduit à une
// bande trop étroite pour porter son libellé, et devient impossible à viser au
// doigt.
export default function StepTimeline({ steps, selectedId, onSelect }) {
  return (
    <ul className="timeline">
      {steps.map((step) => (
        <li
          key={step.id}
          className="timeline__cell"
          style={{ flexGrow: (step.nights ?? 0) + 2.5 }}
        >
          <button
            type="button"
            className="timeline__segment"
            data-selected={step.id === selectedId || undefined}
            onClick={() => onSelect(step.id === selectedId ? null : step.id)}
            title={`${step.name} · ${formatStepDates(step.date_start, step.date_end)}`}
          >
            {/* Premier mot seulement : « Matsumoto & Alpes japonaises » ne tient
                dans aucun segment, et le nom complet reste dans l'infobulle et
                sur la carte de l'étape. */}
            <span className="timeline__name">{step.name.split(' ')[0]}</span>
            <span className="timeline__nights">· {step.nights}n</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
