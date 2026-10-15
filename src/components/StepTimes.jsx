import { useState } from 'react';
import { formatClock } from '@/lib/transport.js';
import { setStepTimes } from '@/lib/mutations.js';
import './StepTimes.scss';

// L'heure d'arrivée et l'heure de départ d'une ville (0016), dans l'en-tête
// de sa carte.
//
// Elles bornent le premier et le dernier jour : partir à 10 h ferme
// l'après-midi dans la ville. LE TRAJET PRIME : dès qu'un trajet de la route a
// un horaire, c'est lui qui les règle (syncRouteTimes) — ce qu'on saisit ici
// vaut tant qu'on n'en sait pas plus.
//
// REPLIÉES AU REPOS (passe UX du 15 octobre 2026) : deux champs « --:-- » vides
// sur chaque carte de ville faisaient un formulaire de ce qui devait être un
// en-tête. Sans heure, un « + heures » ; avec, le texte, modifiable au clic.
export default function StepTimes({ step, readOnly, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const arrival = formatClock(step.arrival_time);
  const departure = formatClock(step.departure_time);

  if (readOnly) {
    if (!arrival && !departure) return null;
    return (
      <p className="steptimes">
        {arrival && <span>arrivée {arrival}</span>}
        {departure && <span>départ {departure}</span>}
      </p>
    );
  }

  async function save(patch) {
    setBusy(true);
    try {
      await setStepTimes(step.id, patch);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  // Enregistré en quittant le champ, seulement s'il a changé : un champ
  // traversé au clavier ne réécrit rien.
  const field = (label, value, key) => (
    <label className="steptimes__field">
      <span>{label}</span>
      <input
        type="time"
        defaultValue={value ?? ''}
        disabled={busy}
        aria-label={`Heure ${label === 'arrivée' ? "d'arrivée à" : 'de départ de'} ${step.name}`}
        onBlur={(event) => {
          if ((event.target.value || null) !== (value ?? null)) save({ [key]: event.target.value });
        }}
      />
    </label>
  );

  if (!editing) {
    return (
      <div className="steptimes" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="steptimes__show"
          title="L'heure d'arrivée et l'heure de départ : elles bornent le premier et le dernier jour"
          onClick={() => setEditing(true)}
        >
          {arrival || departure
            ? [arrival && `arrivée ${arrival}`, departure && `départ ${departure}`].filter(Boolean).join(' · ')
            : '+ heures'}
        </button>
      </div>
    );
  }

  return (
    <div className="steptimes" onClick={(event) => event.stopPropagation()}>
      {field('arrivée', arrival, 'arrivalTime')}
      {field('départ', departure, 'departureTime')}
      <button type="button" className="steptimes__done" onClick={() => setEditing(false)}>
        OK
      </button>
    </div>
  );
}
