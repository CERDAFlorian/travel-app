import { useState } from 'react';
import { placeItem } from '@/lib/mutations.js';
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
export default function CityReserve({ step, days, items, readOnly, onChanged }) {
  if (readOnly || items.length === 0) return null;

  return (
    <section className="reserve" aria-label={`À placer à ${step.name}`}>
      <h3 className="reserve__head">
        <span className="reserve__title">À placer à {step.name}</span>
        <span className="reserve__count">{items.length}</span>
      </h3>

      <ul className="reserve__items">
        {items.map((item) => (
          <ReserveRow key={item.id} item={item} step={step} days={days} onChanged={onChanged} />
        ))}
      </ul>
    </section>
  );
}

// Un item de la réserve : voulu, pas encore daté.
function ReserveRow({ item, step, days, onChanged }) {
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
