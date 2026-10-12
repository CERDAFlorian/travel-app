import { useState } from 'react';
import { SLOTS } from '@/lib/days.js';
import { formatDayFull, formatDayShort } from '@/lib/dates.js';
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
//
// LA DATE, PAS LE RANG. « J2 » obligeait à recompter depuis l'arrivée dans la
// ville ; la date se lit telle qu'on la vivra, et c'est la même que celle des
// titres du programme. Sans date — étape jamais datée —, le rang reste le seul
// repère possible.
const dayLabel = (entry) => (entry.date ? formatDayShort(entry.date) : `Jour ${entry.offset + 1}`);
//
// `slots` restreint les moments proposés : un arrêt en chemin n'a pas de
// « journée entière ». Avec un seul jour possible — le contenu d'un arrêt vit
// le jour de l'arrêt —, la question du jour ne se pose pas : on passe
// directement aux moments.
export default function DayPicker({ days, slots = SLOTS, current, currentSlot, label, busy, onPick, onCancel }) {
  const single = days.length === 1;
  const [day, setDay] = useState(single ? days[0].offset : null);
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
              {dayLabel(entry)}
              {entry.departure && <span className="daypick__mark"> · départ</span>}
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
          renonce pas au placement. Rien à quoi revenir s'il n'y a qu'un jour. */}
      {!single && (
        <button
          type="button"
          className="daypick__back"
          disabled={busy}
          title="Changer de jour"
          onClick={() => setDay(null)}
        >
          ←<span className="sr-only">Revenir au choix du jour</span>
        </button>
      )}

      <span className="daypick__label">
        {target?.date ? formatDayFull(target.date) : `Jour ${chosen + 1}`}
        {target?.departure && ' · départ'}
      </span>

      <span className="daypick__chips">
        {slots.map((slot) => (
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
