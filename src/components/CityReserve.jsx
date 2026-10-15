import { useState } from 'react';
import { placeItem, setChildSlot } from '@/lib/mutations.js';
import { CONTAINER_SLOTS } from '@/lib/containers.js';
import DayPicker from './DayPicker.jsx';
import PlaceThumb from './PlaceThumb.jsx';
import './PlannedRow.scss';
import './CityReserve.scss';

// La réserve d'une ville : ce qu'on veut y faire sans avoir dit quand.
//
// Elle se pose APRÈS LE DERNIER JOUR DE LA VILLE, dans le programme du voyage :
// on vient de lire les jours de Kyoto, on voit ce qui reste à y caser, on le
// place sans changer d'écran. Les jours proposés sont ceux de la ville, et
// eux seuls — un item appartient à son étape.
//
// Rien quand tout est casé : sur huit villes, huit blocs « tout est casé »
// alourdiraient le programme pour ne rien dire. Le compteur de la carte de
// ville le dit déjà.
//
// Elle sert aussi à un arrêt en chemin (F5) : `container` est alors l'arrêt,
// dont le contenu se place dans ses moments, le jour de l'arrêt.
//
// REPLIÉE PAR DÉFAUT (passe UX du 15 octobre 2026) : vingt lieux à placer à
// Tokyo s'étalaient entre deux jours et coupaient la lecture du programme. Une
// ligne avec son compteur ; on la déplie quand on vient placer.
export default function CityReserve({ step, days, items, container = null, readOnly, onChanged }) {
  const [open, setOpen] = useState(false);
  if (readOnly || items.length === 0) return null;

  const name = container?.title ?? step.name;

  return (
    <section
      className="reserve"
      data-inside={container ? true : undefined}
      data-open={open || undefined}
      aria-label={`À placer à ${name}`}
    >
      <h3 className="reserve__head">
        <button
          type="button"
          className="reserve__toggle"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="reserve__title">À placer à {name}</span>
          <span className="reserve__count">{items.length}</span>
          <span className="reserve__caret" aria-hidden="true">{open ? '▴' : '▾'}</span>
        </button>
      </h3>

      <ul className="reserve__items" hidden={!open}>
        {items.map((item) => (
          <ReserveRow
            key={item.id}
            item={item}
            step={step}
            days={days}
            container={container}
            onChanged={onChanged}
          />
        ))}
      </ul>
    </section>
  );
}

// Un item de la réserve : voulu, pas encore daté.
function ReserveRow({ item, step, days, container, onChanged }) {
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <li className="spare">
      <div className="spare__line">
        <PlaceThumb place={item} size="xs" />
        <span className="planned__dot" data-cat={item.category} aria-hidden="true" />
        <span className="planned__name">{item.title}</span>
        {item.notes && <span className="planned__meta">{item.notes}</span>}

        <button
          type="button"
          className="spare__place"
          disabled={busy}
          onClick={() => setPicking((value) => !value)}
        >
          Placer<span className="sr-only"> {item.title}</span>
        </button>
      </div>

      {picking && (
        <DayPicker
          days={days}
          slots={container ? CONTAINER_SLOTS : undefined}
          current={null}
          currentSlot={null}
          busy={busy}
          label="Placer le"
          onCancel={() => setPicking(false)}
          onPick={async (offset, slot) => {
            setBusy(true);
            try {
              await (container ? setChildSlot(step, item.id, slot) : placeItem(step, item.id, offset, slot));
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
