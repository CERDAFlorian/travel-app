import { useState } from 'react';
import ContainerBody from './ContainerBody.jsx';
import ItemTransports from './ItemTransports.jsx';
import LegEditor from './LegEditor.jsx';
import PlaceThumb from './PlaceThumb.jsx';
import './StopPlan.scss';

// Un arrêt en chemin, dans le jour où l'on change de ville (L11, F5).
//
// Il se lit dans l'ordre où on le vit : le transport qui y MÈNE, l'arrêt, ce
// qu'on y fait rangé par moments, ce qui reste à y caser. Le trajet suivant —
// vers l'arrêt d'après, ou vers la ville d'arrivée — vient ensuite.
//
// Hakushu, vide, tient sur une ligne : l'arrêt EST la visite. Shirakawa-gō, qui
// contient un temple et un déjeuner, déroule son programme. On n'a rien à
// choisir : c'est le contenu qui décide de la forme.
//
// `origin` : d'où l'on vient — la ville quittée le matin, ou l'arrêt précédent.
export default function StopPlan({ plan, origin, sync, date, transports, clashes, tripId, readOnly, onChanged }) {
  const [adding, setAdding] = useState(false);
  const { container: stop } = plan;
  const own = transports.get(stop.id);

  const toStop = own?.aller ?? [];

  return (
    <div className="stopplan">
      {/* LE TRAJET QUI MÈNE À L'ARRÊT, au même rang que celui entre deux
          villes : Tokyo → Hakushu se lit, et se réclame tant qu'il manque.
          Un « + trajet » discret dans l'en-tête de l'arrêt ne suffisait pas —
          on ne le voyait pas. */}
      {toStop.length === 0 ? (
        readOnly ? (
          <p className="pday__move" data-kind="transfert">
            <span className="pday__move-kind">Transfert</span>
            <span className="pday__move-route">
              {origin} → {stop.title}
            </span>
            <span className="pday__move-note">durée non renseignée</span>
          </p>
        ) : (
          <button
            type="button"
            className="pday__move"
            data-kind="transfert"
            data-open={adding || undefined}
            aria-expanded={adding}
            title={`Saisir le trajet ${origin} → ${stop.title}`}
            onClick={() => setAdding((value) => !value)}
          >
            <span className="pday__move-kind">Transfert</span>
            <span className="pday__move-route">
              {origin} → {stop.title}
            </span>
            <span className="pday__move-note">+ ajouter le transport</span>
          </button>
        )
      ) : (
        <>
          <p className="stopplan__route">
            {origin} → {stop.title}
          </p>
          <ItemTransports
            item={stop}
            legs={toStop}
            sync={sync}
            clashes={clashes}
            tripId={tripId}
            readOnly={readOnly}
            onChanged={onChanged}
          />
        </>
      )}

      <p className="stopplan__head">
        <span className="stopplan__mark" aria-hidden="true">◆</span>
        <PlaceThumb place={stop} size="xs" />
        <span className="stopplan__name">{stop.title}</span>
        <span className="stopplan__kind">arrêt</span>

        {/* Un second tronçon — le train PUIS le bus — s'ajoute ici, une fois
            le premier saisi. */}
        {!readOnly && toStop.length > 0 && (
          <button
            type="button"
            className="stopplan__act"
            title={`Un autre transport pour aller à ${stop.title}`}
            onClick={() => setAdding((value) => !value)}
          >
            + trajet
          </button>
        )}
      </p>

      {adding && (
        <LegEditor
          tripId={tripId}
          item={stop}
          leg={null}
          sync={sync}
          onClose={() => setAdding(false)}
          onChanged={onChanged}
        />
      )}

      <ContainerBody
        plan={plan}
        date={date}
        transports={transports}
        clashes={clashes}
        tripId={tripId}
        readOnly={readOnly}
        onChanged={onChanged}
      />

      <ItemTransports
        item={stop}
        legs={own?.retour}
        clashes={clashes}
        tripId={tripId}
        readOnly={readOnly}
        onChanged={onChanged}
      />
    </div>
  );
}
