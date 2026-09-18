import { CATEGORIES } from '@/lib/categories.js';
import { formatStepDates } from '@/lib/dates.js';
import PhotoStrip from './PhotoStrip.jsx';
import CategoryAccordion from './CategoryAccordion.jsx';
import './StepCard.scss';

// Une étape de l'itinéraire : en-tête, bandeau photo, les 6 catégories.
//
// Les catégories sont toujours les 6, dans le même ordre, même vides. Un
// affichage qui n'en montrerait que trois sur une étape et cinq sur une autre
// obligerait à relire la liste à chaque fois pour savoir ce qui manque.
export default function StepCard({ step }) {
  const itemsByCategory = new Map(CATEGORIES.map(({ key }) => [key, []]));
  for (const item of step.items) {
    itemsByCategory.get(item.category)?.push(item);
  }

  return (
    <li className="step-card">
      <header className="step-card__head">
        <span className="step-card__number" aria-hidden="true">
          {step.position}
        </span>
        <span className="step-card__identity">
          <h2 className="step-card__name">{step.name}</h2>
          <p className="step-card__dates">
            {formatStepDates(step.date_start, step.date_end)}
            {step.nights > 0 && (
              <>
                {' · '}
                {step.nights} {step.nights > 1 ? 'nuits' : 'nuit'}
              </>
            )}
          </p>
        </span>
      </header>

      <PhotoStrip items={step.items} />

      <div className="step-card__cats">
        {CATEGORIES.map((category) => (
          <CategoryAccordion
            key={category.key}
            category={category}
            items={itemsByCategory.get(category.key)}
          />
        ))}
      </div>
    </li>
  );
}
