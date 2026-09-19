import { CATEGORIES } from '@/lib/categories.js';
import { formatStepDates } from '@/lib/dates.js';
import PhotoStrip from './PhotoStrip.jsx';
import CategoryAccordion from './CategoryAccordion.jsx';
import './StepCard.scss';

const MODE_LABEL = {
  shinkansen: 'Shinkansen',
  train: 'Train',
  bus: 'Bus',
  voiture: 'Voiture',
  ferry: 'Ferry',
  avion: 'Avion',
  marche: 'À pied',
};

function formatDuration(minutes) {
  if (!minutes) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}

// Une étape : rail à gauche, contenu à droite.
//
// Le rail porte le numéro puis un filet dégradé qui descend vers l'étape
// suivante. C'est lui qui fait lire la colonne comme un itinéraire plutôt que
// comme une liste de cartes indépendantes.
export default function StepCard({ step, tripTitle, readOnly, selected, leg, onSelect, onChanged }) {
  const itemsByCategory = new Map(CATEGORIES.map(({ key }) => [key, []]));
  for (const item of step.items) {
    itemsByCategory.get(item.category)?.push(item);
  }

  const duration = formatDuration(leg?.duration_min);

  return (
    <article
      className="step"
      id={`step-${step.id}`}
      data-selected={selected || undefined}
      onClick={() => onSelect(step.id)}
    >
      <div className="step__rail">
        <div className="step__number">{step.position}</div>
        <div className="step__thread" aria-hidden="true" />
      </div>

      <div className="step__body">
        <div className="step__head">
          <h2 className="step__name">{step.name}</h2>
          <span className="step__dates">{formatStepDates(step.date_start, step.date_end)}</span>
          <span className="step__nights">
            {step.nights} {step.nights > 1 ? 'nuits' : 'nuit'}
          </span>
        </div>

        <PhotoStrip items={step.items} stepName={step.name.split(' ')[0]} />

        <div className="step__cats">
          {CATEGORIES.map((category) => (
            <CategoryAccordion
              key={category.key}
              category={category}
              items={itemsByCategory.get(category.key)}
              step={step}
              tripTitle={tripTitle}
              readOnly={readOnly}
              onChanged={onChanged}
            />
          ))}
        </div>

        {/* Le trajet vers l'étape suivante, en pied de carte : il appartient à
            l'intervalle, pas à l'étape d'arrivée. */}
        {duration && (
          <div className="step__travel">
            <span className="step__travel-kind">{MODE_LABEL[leg.mode] ?? leg.mode}</span>
            <span className="step__travel-rule" aria-hidden="true" />
            <span className="step__travel-time">{duration}</span>
          </div>
        )}
      </div>
    </article>
  );
}
