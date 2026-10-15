import { SLOTS } from '@/lib/days.js';
import PlannedRow from './PlannedRow.jsx';
import CityReserve from './CityReserve.jsx';
import './Excursion.scss';

// Une excursion d'une DEMI-JOURNÉE, sous sa ligne : Nara l'après-midi depuis
// Kyoto (F6).
//
// UNE LISTE, PAS DES SOUS-MOMENTS (Florian, 15 octobre 2026). L'excursion
// occupe déjà un moment de la journée ; ce qu'on y fait se lit dans l'ordre où
// on l'a rangé, et se place dans ce seul moment — le sélecteur ne propose que
// lui.
export default function ExcursionList({ plan, date, cityDays, transports, clashes, tripId, readOnly, onChanged }) {
  const { container: excursion, step, list, reserve } = plan;
  const days = [{ offset: 0, date, departure: false }];
  const slots = SLOTS.filter((slot) => slot.key === excursion.day_slot);

  return (
    <div className="xlist">
      {list.length > 0 && (
        <ul className="xlist__items">
          {list.map((item, index) => (
            <PlannedRow
              key={item.id}
              item={item}
              step={step}
              days={days}
              slotItems={list}
              previous={list[index - 1]}
              canMoveUp={index > 0}
              canMoveDown={index < list.length - 1}
              transports={transports?.get(item.id)}
              clashes={clashes}
              container={excursion}
              slots={slots}
              cityDays={cityDays}
              tripId={tripId}
              readOnly={readOnly}
              onChanged={onChanged}
            />
          ))}
        </ul>
      )}

      <CityReserve
        step={step}
        days={days}
        items={reserve}
        container={excursion}
        slots={slots}
        readOnly={readOnly}
        onChanged={onChanged}
      />
    </div>
  );
}
