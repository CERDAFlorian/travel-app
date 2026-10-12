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
  const cities = useMemo(() => {
    const steps = trip.steps ?? [];
    return new Map(
      steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return [step.id, { days: daysOf(step, { isLast }), reserve: unplacedOf(step, { isLast }) }];
      }),
    );
  }, [trip]);

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
        const city = cities.get(day.step.id);

        return (
          <Fragment key={`${day.step.id}-${day.offset}`}>
            <section
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

                {/* La date suffit à situer le jour : « J2 » obligeait à
                    recompter depuis l'arrivée. Seul le départ se signale — on
                    n'y tient pas une journée de visites. */}
                {day.departure && <span className="pday__rank">départ</span>}
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

              <DayPlan day={day} days={city.days} readOnly={readOnly} onChanged={onChanged} />
            </section>

            {/* Ce qui reste à caser dans cette ville, juste après ses jours :
                on pioche là où l'on vient de lire les trous. */}
            {day.lastOfStep && (
              <CityReserve
                step={day.step}
                days={city.days}
                items={city.reserve}
                readOnly={readOnly}
                onChanged={onChanged}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
