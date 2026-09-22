import { useState } from 'react';
import { scheduleOf, unplacedOf } from '@/lib/days.js';
import { formatDayFull } from '@/lib/dates.js';
import { haversine, formatDistance } from '@/lib/geo.js';
import {
  duplicateItemOnDay,
  moveItemInDay,
  placeItem,
  unplaceItem,
} from '@/lib/mutations.js';
import DayPicker from './DayPicker.jsx';
import './StepDays.scss';

// Le programme d'une ville, jour par jour.
//
// C'est l'autre lecture des mêmes items : les catégories sont le garde-manger,
// les jours sont le menu. Rien n'est dupliqué en base — un item placé reste
// dans sa catégorie, il gagne seulement un jour (voir lib/days.js).
//
// La ligne est volontairement PLUS LÉGÈRE que celle des catégories : ici on
// organise — réordonner, déplacer, refaire, remettre en réserve. Modifier un
// prix ou géocoder une adresse se fait dans l'onglet Catégories, où la ligne
// porte déjà tout ce qu'il faut. Empiler les deux jeux de commandes aurait
// donné une ligne illisible sur un téléphone.
export default function StepDays({ step, isLast, readOnly, onChanged }) {
  const days = scheduleOf(step, { isLast });
  const reserve = unplacedOf(step, { isLast });

  return (
    <div className="days">
      {days.map((day) => (
        <section className="day" key={day.offset} data-empty={day.items.length === 0 || undefined}>
          <h3 className="day__head">
            <span className="day__rank">{day.departure ? 'Départ' : `J${day.offset + 1}`}</span>
            <span className="day__date">{formatDayFull(day.date)}</span>
            {day.items.length > 0 && <span className="day__count">{day.items.length}</span>}
          </h3>

          {day.items.length === 0 ? (
            // Un jour vide reste affiché : un trou dans un programme est une
            // information, et c'est là qu'on décide d'y mettre quelque chose.
            <p className="day__empty">
              {day.departure ? 'Journée de départ — rien de prévu' : 'Rien de prévu'}
            </p>
          ) : (
            <ul className="day__items">
              {day.items.map((item, index) => (
                <PlannedRow
                  key={item.id}
                  item={item}
                  step={step}
                  days={days}
                  dayItems={day.items}
                  // La distance au précédent : c'est ce qui rattrape une
                  // journée construite aux deux bouts de la ville.
                  previous={day.items[index - 1]}
                  canMoveUp={index > 0}
                  canMoveDown={index < day.items.length - 1}
                  readOnly={readOnly}
                  onChanged={onChanged}
                />
              ))}
            </ul>
          )}
        </section>
      ))}

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

// Un item posé sur un jour.
function PlannedRow({ item, step, days, dayItems, previous, canMoveUp, canMoveDown, readOnly, onChanged }) {
  // Un seul sélecteur ouvert à la fois : 'move' pour déplacer, 'copy' pour
  // refaire ailleurs. Les deux choisissent un jour, mais n'en font pas la même
  // chose — le libellé doit le dire avant le clic, pas après.
  const [picking, setPicking] = useState(null);
  const [busy, setBusy] = useState(false);

  async function run(action) {
    setBusy(true);
    try {
      await action();
      await onChanged();
      setPicking(null);
    } finally {
      setBusy(false);
    }
  }

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

  return (
    <li className="planned">
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
              title={canMoveUp ? 'Plus tôt dans la journée' : 'Déjà en premier'}
              onClick={() => run(() => moveItemInDay(dayItems, item.id, -1))}
            >
              ▲<span className="sr-only">Monter {item.title}</span>
            </button>
            <button
              type="button"
              className="planned__arrow"
              disabled={busy || !canMoveDown}
              title={canMoveDown ? 'Plus tard dans la journée' : 'Déjà en dernier'}
              onClick={() => run(() => moveItemInDay(dayItems, item.id, 1))}
            >
              ▼<span className="sr-only">Descendre {item.title}</span>
            </button>
          </span>
        )}

        <span className="planned__dot" data-cat={item.category} aria-hidden="true" />
        <span className="planned__name">{item.title}</span>
        {item.notes && <span className="planned__meta">{item.notes}</span>}

        {!readOnly && (
          <span className="planned__tools">
            <button
              type="button"
              className="planned__act"
              disabled={busy}
              title="Déplacer vers un autre jour"
              onClick={() => setPicking(picking === 'move' ? null : 'move')}
            >
              Jour
            </button>
            <button
              type="button"
              className="planned__act"
              disabled={busy}
              title="Refaire un autre jour : une copie, avec son prix et son adresse"
              onClick={() => setPicking(picking === 'copy' ? null : 'copy')}
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

      {picking && (
        <DayPicker
          days={days}
          // Sur une copie, le jour courant reste choisissable : refaire la même
          // chose deux fois dans la journée est un cas réel — un café le matin,
          // le même bar le soir.
          current={picking === 'move' ? item.day_offset : null}
          busy={busy}
          label={picking === 'move' ? 'Déplacer vers' : 'Refaire le'}
          onCancel={() => setPicking(null)}
          onPick={(offset) =>
            run(() =>
              picking === 'move'
                ? placeItem(step, item.id, offset)
                : duplicateItemOnDay(step, item, offset),
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
          busy={busy}
          label="Placer le"
          onCancel={() => setPicking(false)}
          onPick={async (offset) => {
            setBusy(true);
            try {
              await placeItem(step, item.id, offset);
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
