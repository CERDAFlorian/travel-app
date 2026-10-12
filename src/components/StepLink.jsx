import { Fragment, useState } from 'react';
import { legSummary } from '@/lib/transport.js';
import { stopsOf } from '@/lib/containers.js';
import { addStop } from '@/lib/mutations.js';
import RouteStop from './RouteStop.jsx';
import './StepLink.scss';

// La route entre deux villes, dans la vue Villes.
//
// LA VUE VILLES SERT À SAISIR, LE JOUR PAR JOUR À ORGANISER (Florian, 12
// octobre 2026). Les trajets s'y lisent sans s'y modifier — ils se règlent
// dans le jour par jour, sur le jour où l'on change de ville (L11, F3). Les
// ARRÊTS EN CHEMIN, eux, se saisissent ici (F5) : Hakushu entre Tokyo et
// Matsumoto, Shirakawa-gō entre Takayama et Kyoto.
//
// Chaque point de la route porte le trajet qui y MÈNE : l'arrêt, le tronçon
// qui l'amène (F4) ; la ville d'arrivée, le trajet entre les deux villes —
// devenu, avec des arrêts, le dernier tronçon.
export default function StepLink({ from, to, leg, transports, readOnly, onChanged }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  // L'arrêt tout juste créé ouvre sa recherche Google, comme un item.
  const [justAdded, setJustAdded] = useState(null);

  const stops = stopsOf(from);

  async function submit(event) {
    event.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      const id = await addStop(from, title);
      setJustAdded(id);
      await onChanged();
      setTitle('');
      setAdding(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="route">
      {stops.map((stop) => (
        <Fragment key={stop.id}>
          <Segment legs={transports?.get(stop.id)?.aller ?? []} />
          <RouteStop
            stop={stop}
            from={from}
            to={to}
            autoLocate={stop.id === justAdded}
            readOnly={readOnly}
            onChanged={onChanged}
          />
        </Fragment>
      ))}

      <Segment legs={leg ? [leg] : []} />

      {!readOnly &&
        (adding ? (
          <form className="route__add-form" onSubmit={submit}>
            <input
              className="route__add-title"
              type="text"
              value={title}
              autoFocus
              placeholder="Un arrêt en chemin : une distillerie, un village…"
              aria-label={`Ajouter un arrêt entre ${from.name} et ${to.name}`}
              onChange={(event) => setTitle(event.target.value)}
            />
            <button className="route__add-submit" type="submit" disabled={busy}>
              Ajouter
            </button>
            <button className="route__add-cancel" type="button" onClick={() => setAdding(false)}>
              Annuler
            </button>
          </form>
        ) : (
          <button type="button" className="route__add" onClick={() => setAdding(true)}>
            + arrêt en chemin
          </button>
        ))}
    </div>
  );
}

// Un tronçon de la route : le résumé de son trajet, ou « à préciser ». En
// lecture seule — il se règle dans le jour par jour.
function Segment({ legs }) {
  return (
    <div className="link">
      <span className="link__rule" aria-hidden="true" />

      {legs.length > 0 ? (
        legs.map((leg) => (
          <span className="link__label" key={leg.id}>
            {legSummary(leg)}
            {leg.note && <span className="link__note"> · {leg.note}</span>}
          </span>
        ))
      ) : (
        // Un trajet manquant reste visible : c'est une chose à faire — vers
        // une ville comme vers un arrêt. Mais il se saisit ailleurs, et la
        // ligne le dit.
        <span className="link__todo" title="Le trajet se saisit dans la vue Jour par jour">
          trajet à préciser
        </span>
      )}

      <span className="link__rule" aria-hidden="true" />
    </div>
  );
}
