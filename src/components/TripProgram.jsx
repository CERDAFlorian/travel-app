import { useEffect, useMemo, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { tripSchedule } from '@/lib/days.js';
import { resolveItinerary } from '@/lib/itinerary.js';
import { formatDayFull, formatTripRange, todayIso } from '@/lib/dates.js';
import { formatClock, formatDuration, modeLabel } from '@/lib/transport.js';
import { haversine, formatDistance } from '@/lib/geo.js';
import './TripProgram.scss';

// Le voyage jour par jour, toutes villes confondues.
//
// C'EST LA VUE QUI SERT SUR PLACE. Préparer un voyage se fait ville par ville —
// c'est la carte d'étape. Le vivre se fait jour par jour : on n'est pas « à
// Kyoto », on est le 13 novembre, et la question est « qu'est-ce qu'on fait
// aujourd'hui ». Les étapes s'effacent donc derrière la suite des jours, et les
// vols comme les trajets se rangent à leur date, au milieu du programme.
//
// Lecture seule, sans exception : on suit un programme, on ne le construit pas
// dans le train. L'organisation reste dans la carte d'étape.
export default function TripProgram({ trip, shared = false }) {
  // Les dates viennent de l'itinéraire RÉSOLU, comme partout ailleurs : un vol
  // aller qui atterrit le lendemain décale tout le séjour, et le programme
  // afficherait sinon des jours faux sans que rien ne l'indique.
  const itinerary = useMemo(() => resolveItinerary(trip), [trip]);
  const days = useMemo(
    () => tripSchedule({ ...trip, steps: itinerary.steps }),
    [trip, itinerary],
  );

  const today = todayIso();
  const current = useRef(null);

  // Arriver sur aujourd'hui, pas en haut du 7 novembre. C'est la seule chose
  // qu'on demande à cette page le matin, en wifi d'hôtel ou en mode avion.
  useEffect(() => {
    current.current?.scrollIntoView({ block: 'center' });
  }, []);

  // Le retour se déduit de l'URL courante plutôt que du slug : la vue partagée
  // vit sous /partage/:token, où le slug ne mène nulle part.
  const { pathname } = useLocation();
  const back = pathname.replace(/\/programme$/, '');

  return (
    <div className="program">
      <header className="program__head">
        <Link className="program__back" to={back}>
          ← L'itinéraire
        </Link>
        {shared && <p className="program__shared">Vue partagée · lecture seule</p>}

        <h1 className="program__title">{trip.title}, jour par jour</h1>
        <p className="program__range">{formatTripRange(itinerary.start, itinerary.end)}</p>
      </header>

      <main className="program__days">
        {days.map((day) => {
          const isToday = day.date === today;

          return (
            <section
              key={`${day.step.id}-${day.offset}`}
              className="pday"
              data-today={isToday || undefined}
              ref={isToday ? current : null}
            >
              <header className="pday__head">
                <span className="pday__date">{formatDayFull(day.date)}</span>
                <span className="pday__city">{day.step.name}</span>
                <span className="pday__rank">
                  {day.departure ? 'départ' : `J${day.offset + 1}`}
                </span>
                {isToday && <span className="pday__now">aujourd'hui</span>}
              </header>

              {/* Le déplacement AVANT le programme : on arrive quelque part,
                  ensuite on y fait quelque chose. */}
              {day.flights.map((flight) => (
                <p className="pday__move" key={flight.id}>
                  <span className="pday__move-kind">Vol</span>
                  {flight.from_code} → {flight.to_code}
                  {flight.dep && ` · ${formatClock(flight.dep)}`}
                  {flight.arr && ` → ${formatClock(flight.arr)}`}
                  {flight.flight_no && ` · ${flight.flight_no}`}
                </p>
              ))}

              {day.leg && (
                <p className="pday__move">
                  <span className="pday__move-kind">{modeLabel(day.leg.mode)}</span>
                  {day.leg.dep
                    ? `${formatClock(day.leg.dep)} → ${formatClock(day.leg.arr)}`
                    : formatDuration(day.leg.duration_min)}
                  {day.leg.note && ` · ${day.leg.note}`}
                </p>
              )}

              <DayBody day={day} />
            </section>
          );
        })}
      </main>
    </div>
  );
}

function DayBody({ day }) {
  if (day.items.length === 0) {
    return (
      <p className="pday__empty">
        {day.departure ? 'Rien de prévu — journée de départ.' : 'Journée libre.'}
      </p>
    );
  }

  // Le précédent dans l'ordre réel de la journée, moments confondus : la
  // distance se paie entre le dernier lieu du matin et le premier de
  // l'après-midi, pas à l'intérieur d'un créneau.
  const before = new Map(day.items.map((item, index) => [item.id, day.items[index - 1]]));

  return (
    <div className="pday__slots">
      {day.groups.map((group) => {
        if (group.items.length === 0) return null;

        return (
          <div className="pslot" key={group.key ?? 'unslotted'} data-full={group.full || undefined}>
            <span className="pslot__name">{group.label}</span>

            <ul className="pslot__items">
              {group.items.map((item) => (
                <ProgramRow key={item.id} item={item} previous={before.get(item.id)} />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function ProgramRow({ item, previous }) {
  const hop =
    previous && item.lat != null && previous.lat != null
      ? haversine(
          { lat: Number(previous.lat), lng: Number(previous.lng) },
          { lat: Number(item.lat), lng: Number(item.lng) },
        )
      : null;

  const clock = formatClock(item.start_time);

  return (
    <li className="prow" data-booked={item.booked || undefined}>
      {hop != null && <span className="prow__hop">{formatDistance(hop)}</span>}

      <span className="prow__line">
        {clock && <span className="prow__time">{clock}</span>}
        <span className="prow__dot" data-cat={item.category} aria-hidden="true" />
        <span className="prow__name">{item.title}</span>
        {item.booked && <span className="prow__booked">réservé</span>}
        {item.notes && <span className="prow__meta">{item.notes}</span>}
      </span>
    </li>
  );
}
