import { containerPlan } from '@/lib/containers.js';
import DayPlan from './DayPlan.jsx';
import PlannedRow from './PlannedRow.jsx';
import ItemTransports from './ItemTransports.jsx';
import CityReserve from './CityReserve.jsx';
import './Excursion.scss';

// Une excursion de la JOURNÉE ENTIÈRE : Miyajima depuis Hiroshima (F6).
//
// LA JOURNÉE DEVIENT L'EXCURSION (Florian, 15 octobre 2026). Plus de « Journée
// entière » qui contient Miyajima qui contient ses moments : deux retraits, un
// fond rose, et des lignes qui sortaient de la carte. La journée se lit telle
// qu'on la vivra — le ferry, Miyajima, le matin, l'après-midi, le dernier
// ferry — et ses moments s'alignent sur ceux de n'importe quel autre jour.
//
// L'en-tête du jour l'annonce déjà (« Hiroshima → ◆ Miyajima », TripProgram).
// La ligne de Miyajima reste : c'est elle qui porte ses commandes — la
// déplacer, la réserver, lui ajouter un transport.
export default function ExcursionDay({ excursion, day, days, transports, clashes, tripId, readOnly, onChanged }) {
  const plan = containerPlan(day.step, excursion);
  const own = transports?.get(excursion.id);
  // Ce qu'elle contient vit le jour de l'excursion : on n'en choisit que le
  // moment.
  const inside = [{ offset: 0, date: day.date, departure: false }];

  return (
    <section className="xday" aria-label={`Excursion : ${excursion.title}`}>
      {/* L'aller, en tête de journée. */}
      <ItemTransports
        item={excursion}
        legs={own?.aller}
        clashes={clashes}
        tripId={tripId}
        readOnly={readOnly}
        onChanged={onChanged}
      />

      <ul className="xday__head">
        <PlannedRow
          item={excursion}
          step={day.step}
          days={days}
          slotItems={[excursion]}
          canMoveUp={false}
          canMoveDown={false}
          // Ses transports sont lus autour de la journée, pas sous sa ligne.
          transports={{ aller: [], retour: [] }}
          clashes={clashes}
          tripId={tripId}
          readOnly={readOnly}
          onChanged={onChanged}
        />
      </ul>

      {/* Ses moments, dans la colonne des moments du jour. */}
      <DayPlan
        day={{ ...plan, date: day.date }}
        days={inside}
        transports={transports}
        clashes={clashes}
        container={excursion}
        cityDays={days}
        tripId={tripId}
        readOnly={readOnly}
        onChanged={onChanged}
        emptyText={null}
      />

      {/* Le retour, en fin de journée : le dernier ferry. */}
      <ItemTransports
        item={excursion}
        legs={own?.retour}
        clashes={clashes}
        tripId={tripId}
        readOnly={readOnly}
        onChanged={onChanged}
      />

      <CityReserve
        step={day.step}
        days={inside}
        items={plan.reserve}
        container={excursion}
        readOnly={readOnly}
        onChanged={onChanged}
      />
    </section>
  );
}
