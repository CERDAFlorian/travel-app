import { useState } from 'react';
import { scheduleOf, unplacedOf } from '@/lib/days.js';
import { formatDayFull } from '@/lib/dates.js';
import { formatClock, formatDuration, modeLabel } from '@/lib/transport.js';
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
import './StepDays.scss';

// Le programme d'une ville, jour par jour.
//
// C'est l'autre lecture des mêmes items : les catégories sont le garde-manger,
// les jours sont le menu. Rien n'est dupliqué en base — un item placé reste
// dans sa catégorie, il gagne seulement un jour et un moment (lib/days.js).
//
// La ligne est volontairement PLUS LÉGÈRE que celle des catégories : ici on
// organise — réordonner, déplacer, refaire, remettre en réserve. Modifier un
// prix ou géocoder une adresse se fait dans l'onglet Catégories, où la ligne
// porte déjà tout ce qu'il faut. Empiler les deux jeux de commandes aurait
// donné une ligne illisible sur un téléphone.
export default function StepDays({ step, isLast, neighbours, readOnly, onChanged }) {
  const days = scheduleOf(step, { isLast });
  const reserve = unplacedOf(step, { isLast });

  // LES TRAJETS SONT DES JOURS OCCUPÉS. Cet onglet ne montre qu'une ville : le
  // Shinkansen qui l'ouvre et celui qui la ferme n'apparaîtraient nulle part,
  // et on se retrouverait à remplir le matin d'un départ.
  //
  // L'arrivée tombe le PREMIER jour — c'est la date où l'on roule, celle qui
  // ouvre le séjour. Le départ, lui, a lieu le LENDEMAIN du dernier jour :
  // on dort ici la dernière nuit et on part au matin. Le bandeau se pose donc
  // en pied du dernier jour, en portant sa vraie date, plutôt que de laisser
  // croire à une journée pleine.
  const arrival = neighbours?.previous ?? null;
  const leaving = neighbours?.next ?? null;

  return (
    <div className="days">
      {days.map((day) => {
        // Le précédent dans l'ordre RÉEL de la journée, moments confondus :
        // c'est entre le dernier lieu du matin et le premier de l'après-midi
        // que la distance se paie.
        const before = new Map(day.items.map((item, index) => [item.id, day.items[index - 1]]));

        return (
          <section className="day" key={day.offset} data-empty={day.items.length === 0 || undefined}>
            <h3 className="day__head">
              <span className="day__rank">{day.departure ? 'Départ' : `J${day.offset + 1}`}</span>
              <span className="day__date">{formatDayFull(day.date)}</span>
              {day.items.length > 0 && <span className="day__count">{day.items.length}</span>}
            </h3>

            {day.offset === 0 && arrival && (
              <Transfer
                way="in"
                city={arrival.name}
                leg={neighbours.legIn}
                date={null}
              />
            )}

            {day.items.length === 0 ? (
              // Un jour vide reste affiché : un trou dans un programme est une
              // information, et c'est là qu'on décide d'y mettre quelque chose.
              <p className="day__empty">
                {day.departure ? 'Journée de départ — rien de prévu' : 'Rien de prévu'}
              </p>
            ) : (
              <div className="day__slots">
                {day.groups.map((group) => {
                  // « Journée entière » et « À caler » ne sont pas des moments
                  // de la journée : vides, ils n'ont pas à occuper une ligne
                  // pour dire qu'ils sont vides. Les quatre vrais moments, si —
                  // un après-midi libre est une place à prendre.
                  const optional = group.full || group.key === null;
                  if (optional && group.items.length === 0) return null;

                  return (
                    <section
                      className="slot"
                      key={group.key ?? 'unslotted'}
                      data-full={group.full || undefined}
                      data-loose={group.key === null || undefined}
                      data-empty={group.items.length === 0 || undefined}
                    >
                      <h4 className="slot__name">{group.label}</h4>

                      {group.items.length === 0 ? (
                        <p className="slot__empty">—</p>
                      ) : (
                        <ul className="slot__items">
                          {group.items.map((item, index) => (
                            <PlannedRow
                              key={item.id}
                              item={item}
                              step={step}
                              days={days}
                              // Les flèches réordonnent DANS le moment : monter
                              // une activité du soir ne doit pas la faire
                              // passer l'après-midi sans qu'on l'ait demandé.
                              slotItems={group.items}
                              previous={before.get(item.id)}
                              canMoveUp={index > 0}
                              canMoveDown={index < group.items.length - 1}
                              readOnly={readOnly}
                              onChanged={onChanged}
                            />
                          ))}
                        </ul>
                      )}
                    </section>
                  );
                })}
              </div>
            )}

            {/* Le dernier jour de la ville porte le départ du lendemain. La
                date affichée est celle du trajet, pas celle du jour : on part
                au matin, après la dernière nuit. */}
            {leaving && day.offset === days.length - 1 && (
              <Transfer
                way="out"
                city={leaving.name}
                leg={neighbours.legOut}
                date={leaving.date_start}
              />
            )}
          </section>
        );
      })}

      <section className="reserve">
        <h3 className="reserve__head">
          <span className="reserve__title">À placer</span>
          <span className="reserve__count">{reserve.length}</span>
        </h3>

        {reserve.length === 0 ? (
          <p className="reserve__empty">Tout est casé.</p>
        ) : (
          <ul className="reserve__items">
            {reserve.map((item) => (
              <ReserveRow
                key={item.id}
                item={item}
                step={step}
                days={days}
                readOnly={readOnly}
                onChanged={onChanged}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// Le trajet qui ouvre ou ferme le séjour.
//
// Il n'est pas modifiable ici : un trajet appartient à l'INTERVALLE entre deux
// villes, et se saisit entre les deux cartes d'étape (StepLink). Le rappeler
// ici sert à ne pas l'oublier en bâtissant la journée, pas à le ressaisir.
function Transfer({ way, city, leg, date }) {
  return (
    <p className="transfer" data-way={way}>
      <span className="transfer__kind">{leg ? modeLabel(leg.mode) : 'Trajet'}</span>

      <span className="transfer__route">
        {way === 'in' ? `Arrivée de ${city}` : `Départ vers ${city}`}
      </span>

      {date && <span className="transfer__date">{formatDayFull(date)}</span>}

      {/* La durée en clair : c'est elle qui dit ce qu'il reste de la journée. */}
      {leg?.duration_min != null && (
        <span className="transfer__time">{formatDuration(leg.duration_min)}</span>
      )}
      {leg?.dep && (
        <span className="transfer__when">
          {formatClock(leg.dep)}
          {leg.arr && ` → ${formatClock(leg.arr)}`}
        </span>
      )}
      {!leg && <span className="transfer__todo">horaire à renseigner</span>}
    </p>
  );
}

// Un item posé sur un jour.
function PlannedRow({ item, step, days, slotItems, previous, canMoveUp, canMoveDown, readOnly, onChanged }) {
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

// Un item de la réserve : voulu, pas encore daté.
function ReserveRow({ item, step, days, readOnly, onChanged }) {
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <li className="spare">
      <div className="spare__line">
        <span className="planned__dot" data-cat={item.category} aria-hidden="true" />
        <span className="planned__name">{item.title}</span>
        {item.notes && <span className="planned__meta">{item.notes}</span>}

        {!readOnly && (
          <button
            type="button"
            className="spare__place"
            disabled={busy}
            onClick={() => setPicking((value) => !value)}
          >
            Placer<span className="sr-only"> {item.title}</span>
          </button>
        )}
      </div>

      {picking && (
        <DayPicker
          days={days}
          current={null}
          currentSlot={null}
          busy={busy}
          label="Placer le"
          onCancel={() => setPicking(false)}
          onPick={async (offset, slot) => {
            setBusy(true);
            try {
              await placeItem(step, item.id, offset, slot);
              await onChanged();
              setPicking(false);
            } finally {
              setBusy(false);
            }
          }}
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
