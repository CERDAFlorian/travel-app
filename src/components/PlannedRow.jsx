import { useState } from 'react';
import { formatClock } from '@/lib/transport.js';
import { haversine, formatDistance } from '@/lib/geo.js';
import {
  duplicateItemOnDay,
  moveItemInDay,
  placeItem,
  setBooked,
  setStartTime,
  unplaceItem,
} from '@/lib/mutations.js';
import DayPicker from './DayPicker.jsx';
import PlaceThumb from './PlaceThumb.jsx';
import './PlannedRow.scss';

// Un item posé sur un jour.
//
// La même ligne sert à construire et à suivre le programme : en lecture seule
// (vue partagée, hors ligne) elle perd ses commandes et garde l'heure, la
// marque « réservé » et la distance au précédent — ce qu'on vient lire sur
// place.
export default function PlannedRow({ item, step, days, slotItems, previous, canMoveUp, canMoveDown, readOnly, onChanged }) {
  // Un seul panneau ouvert à la fois : 'move' pour déplacer, 'copy' pour
  // refaire ailleurs, 'time' pour l'heure. Les deux premiers choisissent un
  // créneau mais n'en font pas la même chose — le libellé doit le dire avant
  // le clic, pas après.
  const [panel, setPanel] = useState(null);
  const [busy, setBusy] = useState(false);

  async function run(action) {
    setBusy(true);
    try {
      await action();
      await onChanged();
      setPanel(null);
    } finally {
      setBusy(false);
    }
  }

  const toggle = (name) => setPanel((current) => (current === name ? null : name));

  // Deux points géolocalisés qui se suivent dans la même journée : la distance
  // à vol d'oiseau suffit à voir qu'on a mis Fushimi le matin et Arashiyama
  // l'après-midi, aux deux bouts de Kyoto.
  const hop =
    previous && item.lat != null && previous.lat != null
      ? haversine(
          { lat: Number(previous.lat), lng: Number(previous.lng) },
          { lat: Number(item.lat), lng: Number(item.lng) },
        )
      : null;

  const clock = formatClock(item.start_time);

  return (
    <li className="planned" data-booked={item.booked || undefined}>
      {hop != null && (
        <span className="planned__hop" aria-label={`À ${formatDistance(hop)} du précédent`}>
          {formatDistance(hop)}
        </span>
      )}

      <div className="planned__line">
        {!readOnly && (
          <span className="planned__order">
            <button
              type="button"
              className="planned__arrow"
              disabled={busy || !canMoveUp}
              title={canMoveUp ? 'Plus tôt dans ce moment' : 'Déjà en premier'}
              onClick={() => run(() => moveItemInDay(slotItems, item.id, -1))}
            >
              ▲<span className="sr-only">Monter {item.title}</span>
            </button>
            <button
              type="button"
              className="planned__arrow"
              disabled={busy || !canMoveDown}
              title={canMoveDown ? 'Plus tard dans ce moment' : 'Déjà en dernier'}
              onClick={() => run(() => moveItemInDay(slotItems, item.id, 1))}
            >
              ▼<span className="sr-only">Descendre {item.title}</span>
            </button>
          </span>
        )}

        {/* L'heure en tête de ligne : c'est ce qui se lit en premier quand
            quelque chose ne peut pas se rater. */}
        {clock ? (
          readOnly ? (
            <span className="planned__time" data-on="true">{clock}</span>
          ) : (
            <button
              type="button"
              className="planned__time"
              data-on="true"
              disabled={busy}
              title="Changer l'heure"
              onClick={() => toggle('time')}
            >
              {clock}
            </button>
          )
        ) : (
          !readOnly && (
            <button
              type="button"
              className="planned__time"
              disabled={busy}
              title="Une heure ferme : musée, visite guidée, table réservée"
              onClick={() => toggle('time')}
            >
              +h<span className="sr-only">Ajouter une heure à {item.title}</span>
            </button>
          )
        )}

        <PlaceThumb place={item} size="xs" />
        <span className="planned__dot" data-cat={item.category} aria-hidden="true" />
        <span className="planned__name">{item.title}</span>
        {item.notes && <span className="planned__meta">{item.notes}</span>}

        {/* Réservé : en lecture, c'est la marque qui dit « ne rate pas ça ». */}
        {readOnly ? (
          item.booked && <span className="planned__booked" data-on="true">réservé</span>
        ) : (
          <button
            type="button"
            className="planned__booked"
            data-on={item.booked || undefined}
            aria-pressed={item.booked}
            disabled={busy}
            title={item.booked ? 'Réservé — cliquer pour annuler' : 'Marquer comme réservé'}
            onClick={() => run(() => setBooked(item.id, !item.booked))}
          >
            {item.booked ? '✓ réservé' : 'réserver'}
          </button>
        )}

        {!readOnly && (
          <span className="planned__tools">
            <button
              type="button"
              className="planned__act"
              disabled={busy}
              title="Déplacer vers un autre jour ou un autre moment"
              onClick={() => toggle('move')}
            >
              Jour
            </button>
            <button
              type="button"
              className="planned__act"
              disabled={busy}
              title="Refaire un autre jour : une copie, avec son prix et son adresse"
              onClick={() => toggle('copy')}
            >
              Refaire
            </button>
            <button
              type="button"
              className="planned__act"
              disabled={busy}
              title="Renvoyer en réserve — l'item reste dans sa catégorie"
              onClick={() => run(() => unplaceItem(item.id))}
            >
              ✕<span className="sr-only">Renvoyer {item.title} en réserve</span>
            </button>
          </span>
        )}
      </div>

      {panel === 'time' && (
        <TimeField
          value={clock ?? ''}
          busy={busy}
          onCancel={() => setPanel(null)}
          onSave={(next) => run(() => setStartTime(item.id, next))}
        />
      )}

      {(panel === 'move' || panel === 'copy') && (
        <DayPicker
          days={days}
          // Sur une copie, aucun créneau n'est « l'actuel » : refaire la même
          // chose deux fois dans la journée est un cas réel — un café le
          // matin, le même bar le soir.
          current={panel === 'move' ? item.day_offset : null}
          currentSlot={panel === 'move' ? (item.day_slot ?? null) : null}
          busy={busy}
          label={panel === 'move' ? 'Déplacer vers' : 'Refaire le'}
          onCancel={() => setPanel(null)}
          onPick={(offset, slot) =>
            run(() =>
              panel === 'move'
                ? placeItem(step, item.id, offset, slot)
                : duplicateItemOnDay(step, item, offset, slot),
            )
          }
        />
      )}
    </li>
  );
}

// La saisie d'une heure ferme.
//
// `<input type="time">` natif, comme les horaires de trajet dans StepLink : le
// navigateur fournit le clavier numérique sur mobile et le format local. Un
// champ texte imposerait de valider « 19h30 », « 19:30 » et « 7h30 du soir ».
function TimeField({ value, busy, onCancel, onSave }) {
  const [time, setTime] = useState(value);

  return (
    <form
      className="timefield"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(time);
      }}
    >
      <label className="timefield__label">
        Heure
        <input
          type="time"
          value={time}
          autoFocus
          onChange={(event) => setTime(event.target.value)}
        />
      </label>

      <button type="submit" className="timefield__save" disabled={busy}>
        Enregistrer
      </button>

      {/* Effacer plutôt que « mettre à vide » : une heure annulée doit pouvoir
          disparaître sans passer par un champ qu'on vide à la main. */}
      {value && (
        <button
          type="button"
          className="timefield__clear"
          disabled={busy}
          onClick={() => onSave('')}
        >
          Retirer l'heure
        </button>
      )}

      <button type="button" className="timefield__cancel" disabled={busy} onClick={onCancel}>
        Annuler
      </button>
    </form>
  );
}
