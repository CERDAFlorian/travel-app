import { useEffect, useState } from 'react';
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
export default function StepCard({
  step,
  tripTitle,
  readOnly,
  selected,
  leg,
  onSelect,
  onRemove,
  onChanged,
}) {
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);

  // La confirmation retombe seule après trois secondes : retirer une étape
  // emporte ses items et ses liaisons, il n'y a pas de corbeille.
  useEffect(() => {
    if (!confirming) return undefined;
    const timer = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(timer);
  }, [confirming]);

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

        {!readOnly && onRemove && (
          <button
            type="button"
            className="step__remove"
            data-armed={confirming || undefined}
            disabled={removing}
            title={confirming ? 'Confirmer le retrait' : 'Retirer cette étape'}
            onClick={(event) => {
              // Sans ça, le clic remonte à l'article et sélectionne l'étape
              // qu'on est en train de supprimer.
              event.stopPropagation();
              if (!confirming) {
                setConfirming(true);
                return;
              }
              setRemoving(true);
              onRemove(step.id).finally(() => setRemoving(false));
            }}
          >
            {confirming ? '⚠' : '✕'}
            <span className="sr-only">
              {confirming ? `Confirmer le retrait de ${step.name}` : `Retirer ${step.name}`}
            </span>
          </button>
        )}

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
