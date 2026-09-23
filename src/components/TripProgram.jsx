import { useEffect, useMemo, useRef } from 'react';
import { tripSchedule } from '@/lib/days.js';
import { formatDayFull, todayIso } from '@/lib/dates.js';
import { formatClock, formatDuration, modeLabel } from '@/lib/transport.js';
import { haversine, formatDistance } from '@/lib/geo.js';
import './TripProgram.scss';

// Le voyage jour par jour — la colonne de gauche, à la place des étapes.
//
// C'EST LA LECTURE QUI SERT SUR PLACE. Préparer un voyage se fait ville par
// ville ; le vivre se fait jour par jour : on n'est pas « à Kyoto », on est le
// 13 novembre, et la question est « qu'est-ce qu'on fait aujourd'hui ».
//
// Elle remplace la colonne des étapes SANS quitter l'écran du voyage : la
// carte, l'en-tête, la frise et le panneau des vols restent en place, et
// cliquer une ville ici la sélectionne là-bas comme le ferait une carte
// d'étape. Une page séparée aurait coupé le programme de la carte, alors que
// c'est précisément ensemble qu'ils servent.
//
// Lecture seule, sans exception : on suit un programme, on ne le construit pas
// dans le train. L'organisation reste dans la carte d'étape.
export default function TripProgram({ trip, selectedStepId, onSelectStep }) {
  const days = useMemo(() => tripSchedule(trip), [trip]);

  const today = todayIso();
  const current = useRef(null);

  // Arriver sur aujourd'hui, pas en haut du 7 novembre. C'est la seule chose
  // qu'on demande à cette colonne le matin, en wifi d'hôtel ou en mode avion.
  useEffect(() => {
    current.current?.scrollIntoView({ block: 'center' });
  }, []);

  if (days.length === 0) {
    return (
      <p className="program__none">
        Aucune ville dans cet itinéraire : le programme se remplira quand il y
        aura des jours à remplir.
      </p>
    );
  }

  return (
    <div className="program">
      {days.map((day) => {
        const isToday = day.date === today;

        return (
          <section
            key={`${day.step.id}-${day.offset}`}
            id={`day-${day.step.id}-${day.offset}`}
            className="pday"
            data-today={isToday || undefined}
            data-selected={day.step.id === selectedStepId || undefined}
            ref={isToday ? current : null}
          >
            <header className="pday__head">
              <span className="pday__date">{formatDayFull(day.date)}</span>

              {/* La ville reste cliquable : c'est le lien avec la carte, qu'on
                  garde sous les yeux. */}
              <button
                type="button"
                className="pday__city"
                title={`Voir ${day.step.name} sur la carte`}
                onClick={() => onSelectStep?.(day.step.id)}
              >
                {day.step.name}
              </button>

              <span className="pday__rank">{day.departure ? 'départ' : `J${day.offset + 1}`}</span>
              {isToday && <span className="pday__now">aujourd'hui</span>}
            </header>

            {/* Le déplacement AVANT le programme : on arrive quelque part,
                ensuite on y fait quelque chose. */}
            {day.flights.map((flight) => (
              <p className="pday__move" key={flight.id} data-kind="vol">
                <span className="pday__move-kind">Vol</span>
                <span className="pday__move-route">
                  {flight.from_code} → {flight.to_code}
                </span>
                {flight.dep && (
                  <span className="pday__move-when">
                    {formatClock(flight.dep)}
                    {flight.arr && ` → ${formatClock(flight.arr)}`}
                  </span>
                )}
                {flight.flight_no && <span className="pday__move-note">{flight.flight_no}</span>}
              </p>
            ))}

            {day.from && (
              <p className="pday__move" data-kind="transfert">
                <span className="pday__move-kind">{day.leg ? modeLabel(day.leg.mode) : 'Transfert'}</span>
                <span className="pday__move-route">
                  {day.from.name} → {day.step.name}
                </span>

                {/* La durée en clair : une demi-journée de train n'est pas une
                    matinée libre, et c'est ce qu'on vient vérifier. */}
                {day.leg?.duration_min != null && (
                  <span className="pday__move-time">{formatDuration(day.leg.duration_min)}</span>
                )}
                {day.leg?.dep && (
                  <span className="pday__move-when">
                    {formatClock(day.leg.dep)}
                    {day.leg.arr && ` → ${formatClock(day.leg.arr)}`}
                  </span>
                )}
                {day.leg?.note && <span className="pday__move-note">{day.leg.note}</span>}
                {!day.leg && <span className="pday__move-note">durée non renseignée</span>}
              </p>
            )}

            <DayBody day={day} />
          </section>
        );
      })}
    </div>
  );
}

function DayBody({ day }) {
  if (day.items.length === 0) {
    if (day.departure) return <p className="pday__empty">Rien de prévu — journée de départ.</p>;
    // Un jour d'arrivée sans programme n'est pas une journée vide : le trajet
    // l'occupe, et il est déjà affiché au-dessus.
    if (day.from) return <p className="pday__empty">Rien de plus que la route.</p>;
    return <p className="pday__empty">Journée libre.</p>;
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
