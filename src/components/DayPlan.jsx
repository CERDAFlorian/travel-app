import PlannedRow from './PlannedRow.jsx';
import { slotFits } from '@/lib/slots.js';
import ExcursionDay from './ExcursionDay.jsx';
import ExcursionList from './ExcursionList.jsx';
import { containerPlan, isExcursion, isFullDayExcursion } from '@/lib/containers.js';
import { excursionWindow, fitsAround, sideOf } from '@/lib/excursions.js';
import './DayPlan.scss';

// Les moments d'un jour du programme, et leurs items.
//
// Une seule mise en page pour construire et pour suivre : il y en avait deux,
// celle de l'onglet d'une ville et celle du programme du voyage, presque
// identiques, qui auraient fini par diverger.
//
// `days` est la liste des jours DE LA VILLE du jour affiché : c'est parmi eux
// qu'un item se déplace ou se refait. On ne déménage pas une activité de Kyoto
// à Hiroshima depuis le programme — elle appartient à son étape.
//
// `container` : le programme d'un arrêt en chemin (F5). Ses items ne changent
// que de moment, le jour étant celui de l'arrêt.
export default function DayPlan({
  day,
  days,
  cityDays = null,
  transports,
  clashes,
  container,
  tripId,
  readOnly,
  onChanged,
  emptyText,
}) {
  // Le message d'un jour vide dépend de ce qui l'entoure — journée libre,
  // matin d'un départ, soir d'une arrivée : c'est le programme qui le sait.
  // Sans message, rien : un arrêt vide EST la visite, il n'a rien à annoncer.
  if (day.items.length === 0) return emptyText ? <p className="dayplan__empty">{emptyText}</p> : null;

  // Les excursions de ce jour, avec leur plage (F6) — connues des jours de la
  // ville. Dans un lieu (arrêt, excursion), on ne les cherche pas.
  const excursions = (!container && days?.find((entry) => entry.offset === day.offset)?.excursions) || [];

  // UNE EXCURSION D'UNE JOURNÉE ENTIÈRE PREND LA JOURNÉE : ses moments sont
  // ceux du jour. Ce qui reste en ville se fait AVANT de partir ou APRÈS être
  // revenu — jamais pendant —, et se lit de part et d'autre de l'excursion.
  const excursion = !container && day.items.find(isFullDayExcursion);
  if (excursion) {
    const window =
      excursions.find((entry) => entry.item.id === excursion.id)?.window ?? excursionWindow(excursion);
    const side = (wanted) => {
      const groups = day.groups.map((group) => ({
        ...group,
        items: group.items.filter(
          (item) => item !== excursion && (group.key === null ? 'after' : sideOf(group.key, window)) === wanted,
        ),
      }));
      return { ...day, groups, items: groups.flatMap((group) => group.items) };
    };
    const before = side('before');
    const after = side('after');
    const cityPart = (part) => (
      <DayPlan
        day={part}
        days={days}
        transports={transports}
        clashes={clashes}
        tripId={tripId}
        readOnly={readOnly}
        onChanged={onChanged}
        emptyText={null}
      />
    );

    return (
      <>
        {before.items.length > 0 && (
          <>
            <p className="dayplan__back">Avant de partir à {excursion.title}</p>
            {cityPart(before)}
          </>
        )}
        <ExcursionDay
          excursion={excursion}
          day={day}
          days={days}
          transports={transports}
          clashes={clashes}
          tripId={tripId}
          readOnly={readOnly}
          onChanged={onChanged}
        />
        {after.items.length > 0 && (
          <>
            <p className="dayplan__back">De retour à {day.step.name}</p>
            {cityPart(after)}
          </>
        )}
      </>
    );
  }

  // Le précédent dans l'ordre RÉEL de la journée, moments confondus : c'est
  // entre le dernier lieu du matin et le premier de l'après-midi que la
  // distance se paie.
  const before = new Map(day.items.map((item, index) => [item.id, day.items[index - 1]]));

  return (
    <div className="dayplan">
      {day.groups.map((group) => {
        // SEULS LES MOMENTS REMPLIS S'AFFICHENT, en construction comme en
        // lecture (passe UX du 15 octobre 2026). Les « Midi — », « Soir — »
        // de chaque journée doublaient sa hauteur pour ne rien dire : on place
        // un item depuis la réserve, et le sélecteur propose de toute façon
        // tous les moments.
        if (group.items.length === 0) return null;

        // Hors de la fenêtre du jour (heures de ville, 0016) : partir à 10 h
        // ferme l'après-midi. Un item déjà posé là reste — on ne cache pas une
        // activité — mais le moment se signale.
        const outside = group.key !== null && !slotFits(group.key, day);

        // Pendant une excursion (F6) : un lieu de la ville posé à un moment
        // où l'on est à Miyajima. On ne le cache pas, on le signale.
        const during =
          group.key !== null &&
          group.items.some((item) => !isExcursion(item)) &&
          excursions.find((entry) => !fitsAround(group.key, entry.window));

        return (
          <section
            className="slot"
            key={group.key ?? 'unslotted'}
            data-full={group.full || undefined}
            data-loose={group.key === null || undefined}
            data-outside={outside || during || undefined}
          >
            <h4 className="slot__name">
              {group.label}
              {outside && (
                <span className="slot__outside" title="Ce moment tombe hors de la présence dans la ville ce jour-là">
                  {' '}⚠ {day.until ? 'après le départ' : 'avant l’arrivée'}
                </span>
              )}
              {during && (
                <span className="slot__outside" title={`Ce moment tombe pendant l'excursion à ${during.item.title}`}>
                  {' '}⚠ pendant l’excursion
                </span>
              )}
            </h4>

            <ul className="slot__items">
              {group.items.map((item, index) => (
                <PlannedRow
                  key={item.id}
                  item={item}
                  step={day.step}
                  days={days}
                  // Les flèches réordonnent DANS le moment : monter une
                  // activité du soir ne doit pas la faire passer l'après-midi
                  // sans qu'on l'ait demandé.
                  slotItems={group.items}
                  previous={before.get(item.id)}
                  canMoveUp={index > 0}
                  canMoveDown={index < group.items.length - 1}
                  transports={transports?.get(item.id)}
                  clashes={clashes}
                  container={container}
                  cityDays={cityDays}
                  // Une excursion d'une demi-journée déroule ce qu'elle contient
                  // sous sa ligne, en liste (F6).
                  nested={
                    isExcursion(item) ? (
                      <ExcursionList
                        plan={containerPlan(day.step, item)}
                        cityDays={days}
                        date={day.date}
                        transports={transports}
                        clashes={clashes}
                        tripId={tripId}
                        readOnly={readOnly}
                        onChanged={onChanged}
                      />
                    ) : null
                  }
                  tripId={tripId}
                  readOnly={readOnly}
                  onChanged={onChanged}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
