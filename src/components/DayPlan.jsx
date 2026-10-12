import PlannedRow from './PlannedRow.jsx';
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
export default function DayPlan({ day, days, readOnly, onChanged }) {
  if (day.items.length === 0) {
    if (day.departure) return <p className="dayplan__empty">Rien de prévu — journée de départ.</p>;
    // Un jour d'arrivée sans programme n'est pas une journée vide : le trajet
    // l'occupe, et il est déjà affiché au-dessus.
    if (day.from) return <p className="dayplan__empty">Rien de plus que la route.</p>;
    return <p className="dayplan__empty">{readOnly ? 'Journée libre.' : 'Rien de prévu.'}</p>;
  }

  // Le précédent dans l'ordre RÉEL de la journée, moments confondus : c'est
  // entre le dernier lieu du matin et le premier de l'après-midi que la
  // distance se paie.
  const before = new Map(day.items.map((item, index) => [item.id, day.items[index - 1]]));

  return (
    <div className="dayplan">
      {day.groups.map((group) => {
        // En lecture, on suit le programme : seuls les moments remplis
        // comptent. En construction, les quatre vrais moments restent visibles
        // — un après-midi libre est une place à prendre. « Journée entière » et
        // « À caler » ne sont pas des moments : vides, ils n'occupent pas de
        // ligne.
        const optional = readOnly || group.full || group.key === null;
        if (optional && group.items.length === 0) return null;

        return (
          <section
            className="slot"
            key={group.key ?? 'unslotted'}
            data-full={group.full || undefined}
            data-loose={group.key === null || undefined}
            data-empty={group.items.length === 0 || undefined}
          >
            <h4 className="slot__name">{group.label}</h4>

            {group.items.length === 0 ? (
              <p className="slot__empty">—</p>
            ) : (
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
                    readOnly={readOnly}
                    onChanged={onChanged}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
