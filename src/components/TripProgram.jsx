import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { daysOf, tripSchedule, unplacedOf } from '@/lib/days.js';
import { formatDayFull, todayIso } from '@/lib/dates.js';
import { formatClock, formatDuration, modeLabel, overlappingLegs, transportsByItem } from '@/lib/transport.js';
import { priceInEuros } from '@/lib/currency.js';
import DayPlan from './DayPlan.jsx';
import CityReserve from './CityReserve.jsx';
import LegEditor from './LegEditor.jsx';
import ClashMark from './ClashMark.jsx';
import StopPlan from './StopPlan.jsx';
import { excursionsOn } from '@/lib/excursions.js';
import { childrenOf, isExcursion, isFullDayExcursion } from '@/lib/containers.js';
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

  // Les transports de chaque activité : le ferry de Miyajima, le bus de
  // Kōyasan (F4). Rangés une fois pour tout le voyage.
  const transports = useMemo(() => transportsByItem(trip.legs), [trip.legs]);

  // Par ville : ses jours, parmi lesquels un item se place ou se déplace, et
  // sa réserve. Calculés une fois par étape, pas une fois par jour affiché.
  //
  // Chaque jour connaît ses excursions et leur plage (F6) : le sélecteur
  // propose alors la ville — avant ou après — ou l'excursion elle-même.
  const cities = useMemo(
    () =>
      new Map(
        (trip.steps ?? []).map((step) => [
          step.id,
          {
            days: daysOf(step).map((day) => ({ ...day, excursions: excursionsOn(step, day.offset, transports) })),
            reserve: unplacedOf(step),
          },
        ]),
      ),
    [trip, transports],
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
        // Une excursion de la journée entière : la journée devient
        // l'excursion, et son en-tête l'annonce (F6).
        const excursion = day.transfer ? null : first.items.find(isFullDayExcursion);
        const clashes = clashesOf(day, transports);
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
                    {/* La ville et son heure ne se séparent pas au retour à la
                        ligne : « 15:40 » seul en début de ligne ne dit rien. */}
                    <span className="pday__place">
                      <button
                        type="button"
                        className="pday__city"
                        title={`Voir ${part.step.name} sur la carte`}
                        onClick={() => onSelectStep?.(part.step.id)}
                      >
                        {part.step.name}
                      </button>
                      {/* Le jour d'un changement de ville, l'heure à laquelle on
                          quitte la première et on arrive dans la seconde (0016),
                          à côté de leur nom : « Tokyo 10:00 → Matsumoto 15:40 ». */}
                      {day.transfer && index === 0 && part.until && (
                        <span className="pday__clock">{formatClock(part.until)}</span>
                      )}
                      {day.transfer && index === 1 && part.from && (
                        <span className="pday__clock">{formatClock(part.from)}</span>
                      )}
                    </span>
                  </Fragment>
                ))}

                {excursion && (
                  <>
                    <span className="pday__arrow" aria-hidden="true">→</span>
                    <span className="pday__excursion">◆ {excursion.title}</span>
                  </>
                )}

                {/* La date suffit à situer le jour : « J2 » obligeait à
                    recompter depuis l'arrivée. Seul le vol retour se signale —
                    on n'y tient pas une journée de visites. */}
                {!day.transfer && first.departure && <span className="pday__rank">départ</span>}
                {/* L'arrivée du premier jour, le départ du dernier (0016). Le
                    jour d'un changement de ville les porte sur ses deux
                    parties. */}
                {!day.transfer && first.from && (
                  <span className="pday__clock">arrivée {formatClock(first.from)}</span>
                )}
                {!day.transfer && first.until && (
                  <span className="pday__clock">départ {formatClock(first.until)}</span>
                )}
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
                <TransferDay
                  day={day}
                  tripId={trip.id}
                  cities={cities}
                  transports={transports}
                  clashes={clashes}
                  readOnly={readOnly}
                  onChanged={onChanged}
                />
              ) : (
                <DayPlan
                  day={first}
                  days={cities.get(first.step.id).days}
                  transports={transports}
                  clashes={clashes}
                  tripId={trip.id}
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
function TransferDay({ day, tripId, cities, transports, clashes, readOnly, onChanged }) {
  const [leaving, arriving] = day.parts;
  const { transfer } = day;

  // UNE PARTIE VIDE NE DIT RIEN (passe UX du 15 octobre 2026). « Rien de
  // prévu avant de partir », « Rien de prévu en arrivant » : quatre lignes
  // pour un jour où l'on ne fait que rouler. On place le matin du départ
  // depuis la réserve, et la partie apparaît.
  const show = (part) => part.items.length > 0;
  const nothing = readOnly && !show(leaving) && !show(arriving) && transfer.stops.length === 0;

  return (
    <>
      {show(leaving) && (
        <div className="pday__part" data-way="out">
          <p className="pday__part-name">À {leaving.step.name}, avant de partir</p>
          <DayPlan
            day={leaving}
            days={cities.get(leaving.step.id).days}
            transports={transports}
            clashes={clashes}
            tripId={tripId}
            readOnly={readOnly}
            onChanged={onChanged}
            emptyText="Rien de prévu avant de partir."
          />
        </div>
      )}

      {/* Les arrêts en chemin (F5), dans l'ordre où on les rencontre :
          Hakushu entre Tokyo et Matsumoto. Chacun porte le transport qui y
          mène. */}
      {transfer.stops.map((plan, index) => (
        <StopPlan
          key={plan.container.id}
          plan={plan}
          origin={index > 0 ? transfer.stops[index - 1].container.title : transfer.from.name}
          sync={routeOf(transfer)}
          date={day.date}
          transports={transports}
          clashes={clashes}
          tripId={tripId}
          readOnly={readOnly}
          onChanged={onChanged}
        />
      ))}

      <TransferLine
        transfer={transfer}
        clashes={transfer.leg ? clashes.get(transfer.leg.id) : null}
        tripId={tripId}
        readOnly={readOnly}
        onChanged={onChanged}
      />

      {show(arriving) && (
        <div className="pday__part" data-way="in">
          <p className="pday__part-name">À {arriving.step.name}</p>
          <DayPlan
            day={arriving}
            days={cities.get(arriving.step.id).days}
            transports={transports}
            clashes={clashes}
            tripId={tripId}
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

// La ligne du trajet, au milieu du jour où l'on change de ville.
//
// C'EST ICI QU'ON LE SAISIT depuis L11 F3 : cliquer la ligne ouvre la saisie
// juste dessous, entre ce qu'on fait avant de partir et ce qu'on fait en
// arrivant — on règle l'horaire du train en voyant ce qu'il laisse de la
// journée. La vue Villes ne fait plus que le rappeler.
function TransferLine({ transfer, clashes, tripId, readOnly, onChanged }) {
  const [editing, setEditing] = useState(false);
  const { leg } = transfer;

  // Avec des arrêts, ce trajet est le DERNIER tronçon : il part du dernier
  // arrêt, pas de la ville qu'on a quittée le matin.
  const lastStop = transfer.stops.at(-1)?.container ?? null;
  const origin = lastStop?.title ?? transfer.from.name;

  const content = (
    <>
      <span className="pday__move-kind">{leg ? modeLabel(leg.mode) : 'Transfert'}</span>
      <span className="pday__move-route">
        {origin} → {transfer.to.name}
      </span>

      {/* La durée en clair : une demi-journée de train n'est pas une
          matinée libre, et c'est ce qu'on vient vérifier. */}
      {leg?.duration_min != null && (
        <span className="pday__move-time">{formatDuration(leg.duration_min)}</span>
      )}
      {leg?.dep && (
        <span className="pday__move-when">
          {formatClock(leg.dep)}
          {leg.arr && ` → ${formatClock(leg.arr)}`}
        </span>
      )}
      {leg?.price != null && (
        <span className="pday__move-when">{priceInEuros(leg.price, leg.currency ?? 'EUR')}</span>
      )}
      {leg?.note && <span className="pday__move-note">{leg.note}</span>}
      <ClashMark others={clashes} />
      {!leg && (
        <span className="pday__move-note">
          {readOnly ? 'durée non renseignée' : '+ ajouter le transport'}
        </span>
      )}
    </>
  );

  if (readOnly) {
    return (
      <p className="pday__move" data-kind="transfert">
        {content}
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        className="pday__move"
        data-kind="transfert"
        data-open={editing || undefined}
        aria-expanded={editing}
        title={leg ? 'Modifier ce trajet' : 'Saisir ce trajet'}
        onClick={() => setEditing((value) => !value)}
      >
        {content}
      </button>

      {editing && (
        <LegEditor
          tripId={tripId}
          fromStep={transfer.from}
          toStep={transfer.to}
          leg={leg}
          sync={routeOf(transfer)}
          onClose={() => setEditing(false)}
          onChanged={onChanged}
        />
      )}
    </>
  );
}

// Les transports d'une journée qui se chevauchent : le trajet entre deux
// villes, et ceux de toutes les activités du jour, aller comme retour. Sur
// toute la journée et pas activité par activité : un ferry pour Miyajima qui
// chevauche le train du départ est la même faute qu'un bus qui chevauche un
// train.
function clashesOf(day, transports) {
  const ofItems = (items) =>
    items.flatMap((item) => {
      const own = transports.get(item.id);
      return own ? [...own.aller, ...own.retour] : [];
    });

  // Les arrêts aussi : le transport qui mène à Hakushu, et ceux de ce qu'il
  // contient.
  const stops = day.transfer?.stops ?? [];

  // Et ce que contient une excursion (F6) : le téléphérique du mont Misen.
  const insideExcursions = (part) =>
    part.items.filter(isExcursion).flatMap((excursion) => childrenOf(part.step, excursion.id));

  const legs = [
    day.transfer?.leg,
    ...day.parts.flatMap((part) => ofItems(part.items)),
    ...day.parts.flatMap((part) => ofItems(insideExcursions(part))),
    ...ofItems(stops.map((plan) => plan.container)),
    ...stops.flatMap((plan) => ofItems(plan.items)),
  ].filter(Boolean);

  return overlappingLegs(legs);
}

// La route d'un jour de changement de ville, pour régler les heures des deux
// villes après l'enregistrement d'un de ses trajets (le trajet prime, 0016).
function routeOf(transfer) {
  return {
    fromStepId: transfer.from.id,
    toStepId: transfer.to.id,
    firstStopId: transfer.stops[0]?.container.id ?? null,
  };
}
