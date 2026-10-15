import { useState } from 'react';
import { SLOTS } from '@/lib/days.js';
import { citySlotsFor, insideSlotsFor } from '@/lib/excursions.js';
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
//
// LE JOUR D'UNE EXCURSION, DEUX FAMILLES (F6, Florian, 15 octobre 2026) : en
// ville — avant ou après l'excursion, jamais pendant —, ou DANS l'excursion.
// `onPick(offset, slot, parentId)` : parentId est l'excursion choisie, ou
// null pour la ville. `cityName` nomme la première famille ; `withExcursions`
// à false s'en tient à la ville (refaire un autre jour, contenu d'un arrêt).
// `currentParent` : l'excursion où l'item se trouve déjà, pour marquer son
// moment actuel.
export default function DayPicker({
  days,
  slots = SLOTS,
  current,
  currentSlot,
  currentParent = null,
  cityName = null,
  withExcursions = true,
  label,
  busy,
  onPick,
  onCancel,
}) {
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
  const excursions = withExcursions ? (target?.excursions ?? []) : [];

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

      {/* En ville : seulement les moments possibles ce jour-là — pas
          d'après-midi à Tokyo le jour où l'on en part à 10 h (0016), rien
          pendant une excursion (F6). */}
      <Family
        name={excursions.length > 0 ? `À ${cityName ?? 'la ville'}` : null}
        slots={citySlotsFor(target ?? {}, slots)}
        isOn={(key) => chosen === current && !currentParent && key === currentSlot}
        busy={busy}
        onPick={(key) => onPick(chosen, key, null)}
      />

      {/* Dans chaque excursion du jour : Miyajima, ses moments. */}
      {excursions.map((entry) => (
        <Family
          key={entry.item.id}
          name={`◆ ${entry.item.title}`}
          slots={insideSlotsFor(entry)}
          isOn={(key) => currentParent === entry.item.id && key === currentSlot}
          busy={busy}
          onPick={(key) => onPick(chosen, key, entry.item.id)}
        />
      ))}

      <button type="button" className="daypick__cancel" disabled={busy} onClick={onCancel}>
        Annuler
      </button>
    </div>
  );
}

// Une famille de moments : en ville, ou dans une excursion. Sans nom, une
// simple rangée — un jour sans excursion n'a qu'une famille.
function Family({ name, slots, isOn, busy, onPick }) {
  if (!name) {
    return (
      <span className="daypick__chips">
        {slots.map((slot) => (
          <Chip key={slot.key} slot={slot} on={isOn(slot.key)} busy={busy} onPick={onPick} />
        ))}
      </span>
    );
  }

  if (slots.length === 0) {
    return (
      <span className="daypick__family">
        <span className="daypick__family-name">{name}</span>
        <span className="daypick__none">rien de possible ce jour-là</span>
      </span>
    );
  }

  return (
    <span className="daypick__family">
      <span className="daypick__family-name">{name}</span>
      <span className="daypick__chips">
        {slots.map((slot) => (
          <Chip key={slot.key} slot={slot} on={isOn(slot.key)} busy={busy} onPick={onPick} />
        ))}
      </span>
    </span>
  );
}

function Chip({ slot, on, busy, onPick }) {
  return (
    <button
      type="button"
      className="daypick__chip"
      data-on={on || undefined}
      data-full={slot.full || undefined}
      disabled={busy}
      onClick={() => onPick(slot.key)}
    >
      {slot.label}
    </button>
  );
}
