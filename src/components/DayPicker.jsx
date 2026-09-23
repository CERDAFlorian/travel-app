import { useState } from 'react';
import { SLOTS } from '@/lib/days.js';
import { formatDayFull } from '@/lib/dates.js';
import './DayPicker.scss';

// Choisir un jour, puis un moment.
//
// Sert aux trois gestes du programme : placer un item de la réserve, déplacer
// un item déjà posé, et le refaire un autre jour. Un seul composant pour les
// trois, sinon trois façons de désigner un créneau finiraient par diverger.
//
// EN DEUX TEMPS, pas en deux listes côte à côte. Neuf pastilles d'un coup sur
// un téléphone, c'est une grille où l'on se trompe de ligne ; « quel jour ? »
// puis « quel moment ? » est la question qu'on se pose de toute façon dans cet
// ordre. Le jour courant reste choisissable : changer seulement le moment est
// le cas le plus fréquent une fois la journée bâtie.
export default function DayPicker({ days, current, currentSlot, label, busy, onPick, onCancel }) {
  const [day, setDay] = useState(null);
  const chosen = day ?? null;

  if (chosen === null) {
    return (
      <div className="daypick" role="group" aria-label={label}>
        <span className="daypick__label">{label}</span>

        <span className="daypick__chips">
          {days.map((entry) => (
            <button
              key={entry.offset}
              type="button"
              className="daypick__chip"
              data-on={entry.offset === current || undefined}
              disabled={busy}
              title={entry.date ? formatDayFull(entry.date) : `Jour ${entry.offset + 1}`}
              onClick={() => setDay(entry.offset)}
            >
              {entry.departure ? 'Départ' : `J${entry.offset + 1}`}
              <span className="sr-only"> — {entry.date ? formatDayFull(entry.date) : ''}</span>
            </button>
          ))}
        </span>

        <button type="button" className="daypick__cancel" disabled={busy} onClick={onCancel}>
          Annuler
        </button>
      </div>
    );
  }

  const target = days.find((entry) => entry.offset === chosen);

  return (
    <div className="daypick" role="group" aria-label={`${label} — moment de la journée`}>
      {/* Le retour, pas une annulation : on s'est trompé de jour, on ne
          renonce pas au placement. */}
      <button
        type="button"
        className="daypick__back"
        disabled={busy}
        title="Changer de jour"
        onClick={() => setDay(null)}
      >
        ←<span className="sr-only">Revenir au choix du jour</span>
      </button>

      <span className="daypick__label">
        {target?.departure ? 'Départ' : `J${chosen + 1}`}
        {target?.date && ` · ${formatDayFull(target.date)}`}
      </span>

      <span className="daypick__chips">
        {SLOTS.map((slot) => (
          <button
            key={slot.key}
            type="button"
            className="daypick__chip"
            data-on={(chosen === current && slot.key === currentSlot) || undefined}
            data-full={slot.full || undefined}
            disabled={busy}
            onClick={() => onPick(chosen, slot.key)}
          >
            {slot.label}
          </button>
        ))}
      </span>

      <button type="button" className="daypick__cancel" disabled={busy} onClick={onCancel}>
        Annuler
      </button>
    </div>
  );
}
