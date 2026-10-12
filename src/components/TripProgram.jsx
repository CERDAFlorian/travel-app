import { Fragment, useEffect, useMemo, useRef } from 'react';
import { daysOf, tripSchedule, unplacedOf } from '@/lib/days.js';
import { formatDayFull, todayIso } from '@/lib/dates.js';
import { formatClock, formatDuration, modeLabel } from '@/lib/transport.js';
import DayPlan from './DayPlan.jsx';
import CityReserve from './CityReserve.jsx';
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
// C'EST AUSSI LÀ QU'ON LE CONSTRUIT (L11, F1). Le programme vivait en double :
// éditable dans un onglet de chaque ville, en lecture seule ici. Deux écrans
// pour la même chose, dont un seul montrait le voyage d'un bout à l'autre. Il
// n'en reste qu'un : on place, déplace et réordonne ici, et la carte de ville
// ne garde que ses catégories — le garde-manger. La vue partagée et le mode
// hors ligne le rendent en lecture seule, sans une commande.
export default function TripProgram({ trip, readOnly, onChanged, selectedStepId, onSelectStep }) {
  const days = useMemo(() => tripSchedule(trip), [trip]);

  // Par ville : ses jours, parmi lesquels un item se place ou se déplace, et
  // sa réserve. Calculés une fois par étape, pas une fois par jour affiché.
  const cities = useMemo(
    () =>
      new Map(
        (trip.steps ?? []).map((step) => [step.id, { days: daysOf(step), reserve: unplacedOf(step) }]),
      ),
    [trip],
  );

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
        const [first] = day.parts;
        // L'ancre que la frise et la carte visent : le premier jour d'une
        // ville. Le jour d'un changement de ville est celui où la suivante
        // commence.
        const anchor = day.transfer ? `day-${day.transfer.to.id}-0` : `day-${first.step.id}-${first.offset}`;

        return (
          <Fragment key={day.date ?? anchor}>
            <section
              id={anchor}
              className="pday"
              data-today={isToday || undefined}
              data-selected={day.parts.some((part) => part.step.id === selectedStepId) || undefined}
              ref={isToday ? current : null}
            >
              <header className="pday__head">
                <span className="pday__date">{formatDayFull(day.date)}</span>

                {/* Les villes restent cliquables : c'est le lien avec la carte,
                    qu'on garde sous les yeux. Deux le jour où l'on change. */}
                {day.parts.map((part, index) => (
                  <Fragment key={part.step.id}>
                    {index > 0 && <span className="pday__arrow" aria-hidden="true">→</span>}
                    <button
                      type="button"
                      className="pday__city"
                      title={`Voir ${part.step.name} sur la carte`}
                      onClick={() => onSelectStep?.(part.step.id)}
                    >
                      {part.step.name}
                    </button>
                  </Fragment>
                ))}

                {/* La date suffit à situer le jour : « J2 » obligeait à
                    recompter depuis l'arrivée. Seul le vol retour se signale —
                    on n'y tient pas une journée de visites. */}
                {!day.transfer && first.departure && <span className="pday__rank">départ</span>}
                {isToday && <span className="pday__now">aujourd'hui</span>}
              </header>

              {/* Les vols d'abord : on arrive au Japon avant d'y faire quoi
                  que ce soit, et le vol retour clôt la journée qu'il occupe. */}
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

              {day.transfer ? (
                <TransferDay day={day} cities={cities} readOnly={readOnly} onChanged={onChanged} />
              ) : (
                <DayPlan
                  day={first}
                  days={cities.get(first.step.id).days}
                  readOnly={readOnly}
                  onChanged={onChanged}
                  emptyText={
                    first.departure
                      ? 'Rien de prévu — journée de départ.'
                      : readOnly
                        ? 'Journée libre.'
                        : 'Rien de prévu.'
                  }
                />
              )}
            </section>

            {/* Ce qui reste à caser dans une ville, juste après ses jours : on
                pioche là où l'on vient de lire les trous. Le jour d'un
                changement de ville clôt celle qu'on quitte. */}
            {day.parts
              .filter((part) => part.lastOfStep)
              .map((part) => (
                <CityReserve
                  key={part.step.id}
                  step={part.step}
                  days={cities.get(part.step.id).days}
                  items={cities.get(part.step.id).reserve}
                  readOnly={readOnly}
                  onChanged={onChanged}
                />
              ))}
          </Fragment>
        );
      })}
    </div>
  );
}

// Le jour d'un changement de ville, en trois temps : ce qu'on fait avant de
// partir, le trajet, ce qu'on fait en arrivant.
//
// Le trajet est AU MILIEU, pas en tête : avant F2 il ouvrait la journée, qui
// appartenait tout entière à la ville d'arrivée, et le matin à Tokyo avant le
// train ne se notait nulle part.
function TransferDay({ day, cities, readOnly, onChanged }) {
  const [leaving, arriving] = day.parts;
  const { transfer } = day;

  // En lecture, une partie vide ne dit rien : on suit la route. En
  // construction, elle reste visible — c'est une place à prendre.
  const show = (part) => !readOnly || part.items.length > 0;
  const nothing = readOnly && !show(leaving) && !show(arriving);

  return (
    <>
      {show(leaving) && (
        <div className="pday__part" data-way="out">
          <p className="pday__part-name">À {leaving.step.name}, avant de partir</p>
          <DayPlan
            day={leaving}
            days={cities.get(leaving.step.id).days}
            readOnly={readOnly}
            onChanged={onChanged}
            emptyText="Rien de prévu avant de partir."
          />
        </div>
      )}

      <p className="pday__move" data-kind="transfert">
        <span className="pday__move-kind">{transfer.leg ? modeLabel(transfer.leg.mode) : 'Transfert'}</span>
        <span className="pday__move-route">
          {transfer.from.name} → {transfer.to.name}
        </span>

        {/* La durée en clair : une demi-journée de train n'est pas une
            matinée libre, et c'est ce qu'on vient vérifier. */}
        {transfer.leg?.duration_min != null && (
          <span className="pday__move-time">{formatDuration(transfer.leg.duration_min)}</span>
        )}
        {transfer.leg?.dep && (
          <span className="pday__move-when">
            {formatClock(transfer.leg.dep)}
            {transfer.leg.arr && ` → ${formatClock(transfer.leg.arr)}`}
          </span>
        )}
        {transfer.leg?.note && <span className="pday__move-note">{transfer.leg.note}</span>}
        {!transfer.leg && <span className="pday__move-note">durée non renseignée</span>}
      </p>

      {show(arriving) && (
        <div className="pday__part" data-way="in">
          <p className="pday__part-name">À {arriving.step.name}</p>
          <DayPlan
            day={arriving}
            days={cities.get(arriving.step.id).days}
            readOnly={readOnly}
            onChanged={onChanged}
            emptyText="Rien de prévu en arrivant."
          />
        </div>
      )}

      {nothing && <p className="dayplan__empty">Rien de plus que la route.</p>}
    </>
  );
}
