import { useState } from 'react';
import { formatClock } from '@/lib/transport.js';
import { haversine, formatDistance } from '@/lib/geo.js';
import {
  duplicateItemOnDay,
  moveItemInDay,
  placeItem,
  setBooked,
  moveIntoContainer,
  moveOutOfContainer,
  setChildSlot,
  setStartTime,
  unplaceItem,
} from '@/lib/mutations.js';
import { CONTAINER_SLOTS, isExcursion } from '@/lib/containers.js';
import DayPicker from './DayPicker.jsx';
import PlaceThumb from './PlaceThumb.jsx';
import ItemTransports from './ItemTransports.jsx';
import LegEditor from './LegEditor.jsx';
import './PlannedRow.scss';

// Un item posé sur un jour.
//
// La même ligne sert à construire et à suivre le programme : en lecture seule
// (vue partagée, hors ligne) elle perd ses commandes et garde l'heure, la
// marque « réservé » et la distance au précédent — ce qu'on vient lire sur
// place.
//
// LES COMMANDES SONT REPLIÉES (passe UX du 15 octobre 2026). Sept boutons sur
// chaque ligne — ▲▼, heure, réserver, trajet, jour, refaire, retirer —
// faisaient du programme un tableau de bord : on ne lisait plus la journée. La
// ligne montre ce qu'on vient lire ; un « ⋯ », ou un clic sur le nom, déplie
// ce qu'on peut en faire. Seules les flèches ▲▼ sont revenues sur la ligne.
export default function PlannedRow({
  item,
  step,
  days,
  slotItems,
  previous,
  canMoveUp,
  canMoveDown,
  transports,
  clashes,
  container = null,
  // Les moments où l'item peut aller. Un seul : il n'a pas à en changer — le
  // contenu d'une demi-journée vit dans le moment de l'excursion (F6).
  slots = null,
  // Les jours de la ville, quand l'item est dans une excursion : il peut en
  // sortir — revenir à Hiroshima, avant ou après (F6).
  cityDays = null,
  nested = null,
  tripId,
  readOnly,
  onChanged,
}) {
  // Un seul panneau ouvert à la fois : 'move' pour déplacer, 'copy' pour
  // refaire ailleurs, 'time' pour l'heure, 'transport' pour y aller. Les deux premiers choisissent un
  // créneau mais n'en font pas la même chose — le libellé doit le dire avant
  // le clic, pas après.
  const [panel, setPanel] = useState(null);
  const [busy, setBusy] = useState(false);
  // La barre des commandes, repliée par défaut.
  const [open, setOpen] = useState(false);

  async function run(action) {
    setBusy(true);
    try {
      await action();
      await onChanged();
      setPanel(null);
    } finally {
      setBusy(false);
    }
  }

  const toggle = (name) => setPanel((current) => (current === name ? null : name));

  // DANS UNE EXCURSION, on change de moment ou on en sort ; EN VILLE, on
  // change de jour, ou l'on entre dans une excursion du jour choisi (F6). Une
  // excursion n'entre dans aucune autre, et ne se gêne pas elle-même : on la
  // retire des excursions du jour quand c'est elle qu'on déplace.
  const inExcursion = Boolean(container && isExcursion(container) && cityDays);
  const moveDays = inExcursion
    ? cityDays
    : days?.map((day) => ({
        ...day,
        excursions: (day.excursions ?? []).filter((entry) => entry.item.id !== item.id),
      }));

  function move(offset, slot, parentId) {
    if (inExcursion) {
      if (parentId === container.id) return setChildSlot(step, item.id, slot);
      if (parentId) return moveIntoContainer(step, item.id, parentId, slot);
      return moveOutOfContainer(step, item.id, offset, slot);
    }
    if (container) return setChildSlot(step, item.id, slot);
    if (parentId) return moveIntoContainer(step, item.id, parentId, slot);
    return placeItem(step, item.id, offset, slot);
  }

  // Deux points géolocalisés qui se suivent dans la même journée : la distance
  // à vol d'oiseau suffit à voir qu'on a mis Fushimi le matin et Arashiyama
  // l'après-midi, aux deux bouts de Kyoto.
  const hop =
    previous && item.lat != null && previous.lat != null
      ? haversine(
          { lat: Number(previous.lat), lng: Number(previous.lng) },
          { lat: Number(item.lat), lng: Number(item.lng) },
        )
      : null;

  const clock = formatClock(item.start_time);

  return (
    <li className="planned" data-edit={!readOnly || undefined} data-booked={item.booked || undefined} data-kind={item.kind ?? undefined}>
      {hop != null && (
        <span className="planned__hop" aria-label={`À ${formatDistance(hop)} du précédent`}>
          {formatDistance(hop)}
        </span>
      )}

      {/* Comment on y va, au-dessus : le train, puis le ferry. */}
      <ItemTransports
        item={item}
        legs={transports?.aller}
        clashes={clashes}
        tripId={tripId}
        readOnly={readOnly}
        onChanged={onChanged}
      />

      <div className="planned__line">
        {/* L'ordre dans le moment, en tête de ligne et hors du « ⋯ » : on
            réorganise une journée d'un coup d'œil (Florian, 15 oct. 2026).
            Toujours là, même grisé, pour que les noms restent alignés. */}
        {!readOnly && (
          <span className="planned__order">
            <button
              type="button"
              className="planned__arrow"
              disabled={busy || !canMoveUp}
              title={canMoveUp ? 'Plus tôt dans ce moment' : 'Déjà en premier'}
              onClick={() => run(() => moveItemInDay(slotItems, item.id, -1))}
            >
              ▲<span className="sr-only">Monter {item.title}</span>
            </button>
            <button
              type="button"
              className="planned__arrow"
              disabled={busy || !canMoveDown}
              title={canMoveDown ? 'Plus tard dans ce moment' : 'Déjà en dernier'}
              onClick={() => run(() => moveItemInDay(slotItems, item.id, 1))}
            >
              ▼<span className="sr-only">Descendre {item.title}</span>
            </button>
          </span>
        )}

        {/* L'heure en tête de ligne : c'est ce qui se lit en premier quand
            quelque chose ne peut pas se rater. */}
        {clock && (
          <span className="planned__time" data-on="true">
            {clock}
          </span>
        )}

        <PlaceThumb place={item} size="xs" />
        <span className="planned__dot" data-cat={item.category} aria-hidden="true" />

        {readOnly ? (
          <span className="planned__name">{item.title}</span>
        ) : (
          // Le nom déplie les commandes : c'est là que le doigt se pose.
          <button
            type="button"
            className="planned__name"
            aria-expanded={open}
            title="Afficher les commandes"
            onClick={() => setOpen((value) => !value)}
          >
            {item.title}
          </button>
        )}
        {item.notes && <span className="planned__meta">{item.notes}</span>}

        {/* Réservé : la marque qui dit « ne rate pas ça ». */}
        {item.booked && (
          <span className="planned__booked" data-on="true">
            réservé
          </span>
        )}

        {!readOnly && (
          <button
            type="button"
            className="planned__more"
            data-on={open || undefined}
            aria-expanded={open}
            title={open ? 'Replier les commandes' : 'Heure, réservation, trajet, déplacer…'}
            onClick={() => setOpen((value) => !value)}
          >
            ⋯<span className="sr-only"> Commandes de {item.title}</span>
          </button>
        )}
      </div>

      {/* Les commandes, repliées. Rendues mais masquées (`hidden`) plutôt que
          démontées : la ligne garde sa structure, et la barre réapparaît
          telle qu'on l'a laissée. */}
      {!readOnly && (
        <div className="planned__bar" hidden={!open}>
          <button
            type="button"
            className="planned__act"
            disabled={busy}
            title="Une heure ferme : musée, visite guidée, table réservée"
            onClick={() => toggle('time')}
          >
            {clock ? 'heure' : '+ heure'}
          </button>

          <button
            type="button"
            className="planned__act"
            data-on={item.booked || undefined}
            aria-pressed={item.booked}
            disabled={busy}
            title={item.booked ? 'Réservé — cliquer pour annuler' : 'Marquer comme réservé'}
            onClick={() => run(() => setBooked(item.id, !item.booked))}
          >
            {item.booked ? '✓ réservé' : 'réserver'}
          </button>

          <button
            type="button"
            className="planned__act"
            disabled={busy}
            title="Ajouter un transport pour y aller ou en revenir : train, ferry, bus…"
            onClick={() => toggle('transport')}
          >
            + trajet
          </button>

          {/* Dans un arrêt (F5), le jour est celui de l'arrêt : on ne change
              que de moment, et on ne « refait » pas un autre jour ce qui
              n'existe qu'en passant par là. */}
          {(slots?.length !== 1 || inExcursion) && (
            <button
              type="button"
              className="planned__act"
              disabled={busy}
              title={
                inExcursion
                  ? `Changer de moment, ou revenir à ${step.name}`
                  : container
                    ? 'Changer de moment'
                    : 'Déplacer vers un autre jour, un autre moment, ou dans une excursion'
              }
              onClick={() => toggle('move')}
            >
              {inExcursion ? 'Déplacer' : container ? 'Moment' : 'Jour'}
            </button>
          )}
          {/* Une excursion ne se « refait » pas : sa copie partirait sans ce
              qu'elle contient. On la déplace. */}
          {!container && !nested && (
            <button
              type="button"
              className="planned__act"
              disabled={busy}
              title="Refaire un autre jour : une copie, avec son prix et son adresse"
              onClick={() => toggle('copy')}
            >
              Refaire
            </button>
          )}
          <button
            type="button"
            className="planned__act"
            disabled={busy}
            title={
              container
                ? `Renvoyer dans la réserve de ${container.title}`
                : "Renvoyer en réserve — l'item reste dans sa catégorie"
            }
            onClick={() => run(() => (container ? setChildSlot(step, item.id, null) : unplaceItem(item.id)))}
          >
            ✕<span className="sr-only">Renvoyer {item.title} en réserve</span>
          </button>
        </div>
      )}

      {/* Ce qu'une excursion contient (F6), entre l'aller et le retour :
          on prend le ferry, on visite, on reprend le ferry. */}
      {nested}

      {/* Le retour, en dessous : le dernier ferry qu'il ne faut pas rater. */}
      <ItemTransports
        item={item}
        legs={transports?.retour}
        clashes={clashes}
        tripId={tripId}
        readOnly={readOnly}
        onChanged={onChanged}
      />

      {panel === 'transport' && (
        <LegEditor
          tripId={tripId}
          item={item}
          leg={null}
          onClose={() => setPanel(null)}
          onChanged={onChanged}
        />
      )}

      {panel === 'time' && (
        <TimeField
          value={clock ?? ''}
          busy={busy}
          onCancel={() => setPanel(null)}
          onSave={(next) => run(() => setStartTime(item.id, next))}
        />
      )}

      {(panel === 'move' || panel === 'copy') && (
        <DayPicker
          days={panel === 'move' ? moveDays : days}
          // Hors excursion, les moments d'un arrêt ou d'une demi-journée ;
          // depuis une excursion, la ville propose les siens.
          slots={inExcursion && panel === 'move' ? undefined : (slots ?? (container ? CONTAINER_SLOTS : undefined))}
          // Sur une copie, aucun créneau n'est « l'actuel » : refaire la même
          // chose deux fois dans la journée est un cas réel — un café le
          // matin, le même bar le soir.
          current={panel === 'move' ? (inExcursion ? container.day_offset : item.day_offset) : null}
          currentSlot={panel === 'move' ? (item.day_slot ?? null) : null}
          currentParent={panel === 'move' && inExcursion ? container.id : null}
          cityName={step.name}
          // On refait un autre jour en ville seulement ; une excursion n'entre
          // dans aucune autre ; le contenu d'un arrêt reste dans l'arrêt.
          withExcursions={panel === 'move' && !isExcursion(item) && (!container || inExcursion)}
          busy={busy}
          label={panel === 'move' ? 'Déplacer vers' : 'Refaire le'}
          onCancel={() => setPanel(null)}
          onPick={(offset, slot, parentId) =>
            run(() =>
              panel === 'move' ? move(offset, slot, parentId) : duplicateItemOnDay(step, item, offset, slot),
            )
          }
        />
      )}
    </li>
  );
}

// La saisie d'une heure ferme.
//
// `<input type="time">` natif, comme les horaires de trajet dans StepLink : le
// navigateur fournit le clavier numérique sur mobile et le format local. Un
// champ texte imposerait de valider « 19h30 », « 19:30 » et « 7h30 du soir ».
function TimeField({ value, busy, onCancel, onSave }) {
  const [time, setTime] = useState(value);

  return (
    <form
      className="timefield"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(time);
      }}
    >
      <label className="timefield__label">
        Heure
        <input
          type="time"
          value={time}
          autoFocus
          onChange={(event) => setTime(event.target.value)}
        />
      </label>

      <button type="submit" className="timefield__save" disabled={busy}>
        Enregistrer
      </button>

      {/* Effacer plutôt que « mettre à vide » : une heure annulée doit pouvoir
          disparaître sans passer par un champ qu'on vide à la main. */}
      {value && (
        <button
          type="button"
          className="timefield__clear"
          disabled={busy}
          onClick={() => onSave('')}
        >
          Retirer l'heure
        </button>
      )}

      <button type="button" className="timefield__cancel" disabled={busy} onClick={onCancel}>
        Annuler
      </button>
    </form>
  );
}
