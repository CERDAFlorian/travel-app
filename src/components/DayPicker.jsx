import { formatDayFull } from '@/lib/dates.js';
import './DayPicker.scss';

// Choisir un jour de l'étape.
//
// Sert aux trois gestes du programme : placer un item de la réserve, déplacer
// un item déjà posé, et le refaire un autre jour. Un seul composant pour les
// trois, sinon trois façons de désigner un jour finiraient par diverger.
//
// Des pastilles et pas une liste déroulante : sur quatre jours, un <select>
// demande deux gestes et cache les dates derrière le premier. Ici tout est
// visible, et la cible reste atteignable au doigt.
export default function DayPicker({ days, current, label, busy, onPick, onCancel }) {
  return (
    <div className="daypick" role="group" aria-label={label}>
      <span className="daypick__label">{label}</span>

      <span className="daypick__chips">
        {days.map((day) => (
          <button
            key={day.offset}
            type="button"
            className="daypick__chip"
            data-on={day.offset === current || undefined}
            // Le jour courant reste affiché, désactivé : le retirer ferait
            // glisser les autres sous le doigt au moment du choix.
            disabled={busy || day.offset === current}
            title={day.date ? formatDayFull(day.date) : `Jour ${day.offset + 1}`}
            onClick={() => onPick(day.offset)}
          >
            {day.departure ? 'Départ' : `J${day.offset + 1}`}
            <span className="sr-only"> — {day.date ? formatDayFull(day.date) : ''}</span>
          </button>
        ))}
      </span>

      <button type="button" className="daypick__cancel" disabled={busy} onClick={onCancel}>
        Annuler
      </button>
    </div>
  );
}
