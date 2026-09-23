import { whisperFor } from '@/lib/lovenotes.js';
import { useLoveNotes } from '@/hooks/useLoveNotes.js';
import './TravelTimes.scss';

// Les temps de trajet entre deux villes.
//
// Les durées sont saisies à la main dans `legs` : le vol d'oiseau ne dit rien
// d'un Shinkansen, et aucune API ne couvre correctement les correspondances
// bus + train japonaises.
function formatDuration(minutes) {
  if (!minutes) return '—';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}

export default function TravelTimes({ steps, legs }) {
  if (legs.length === 0) return null;

  const nameOf = new Map(steps.map((step) => [step.id, step.name.split(' ')[0]]));
  const mots = useLoveNotes();
  const ordered = steps
    .flatMap((step) => legs.filter((leg) => leg.from_step === step.id))
    .filter((leg) => nameOf.has(leg.from_step) && nameOf.has(leg.to_step));

  return (
    <div className="travel-times">
      {/* Le mot doux sert ici de titre : partagé, un titre neutre le remplace
          plutôt que de laisser le bloc sans en-tête. */}
      <p className="travel-times__title">
        {mots ? whisperFor('travel', legs.length) : 'Temps de trajet'}
      </p>
      {ordered.map((leg) => (
        <div key={leg.id} className="travel-times__row">
          <span className="travel-times__label">
            {nameOf.get(leg.from_step)} → {nameOf.get(leg.to_step)}
          </span>
          <span className="travel-times__rule" aria-hidden="true" />
          <span className="travel-times__time">{formatDuration(leg.duration_min)}</span>
        </div>
      ))}
    </div>
  );
}
