import DayPlan from './DayPlan.jsx';
import CityReserve from './CityReserve.jsx';
import './ContainerBody.scss';

// Ce qu'un lieu contient, dans le jour par jour : ses moments, puis ce qui
// reste à y caser. Le même pour un arrêt en chemin (F5) et une excursion (F6).
//
// Son contenu vit le jour du lieu : un seul jour possible, on ne choisit que
// le moment. Déplacer l'excursion d'un jour emporte donc tout ce qu'elle
// contient, sans rien écrire de plus.
export default function ContainerBody({ plan, date, transports, clashes, tripId, readOnly, onChanged }) {
  const days = [{ offset: 0, date, departure: false }];

  return (
    <div className="cbody">
      <DayPlan
        day={plan}
        days={days}
        transports={transports}
        clashes={clashes}
        container={plan.container}
        tripId={tripId}
        readOnly={readOnly}
        onChanged={onChanged}
        emptyText={null}
      />

      <CityReserve
        step={plan.step}
        days={days}
        items={plan.reserve}
        container={plan.container}
        readOnly={readOnly}
        onChanged={onChanged}
      />
    </div>
  );
}
