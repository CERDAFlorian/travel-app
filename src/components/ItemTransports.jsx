import { useState } from 'react';
import { formatClock, formatDuration, modeLabel } from '@/lib/transport.js';
import { priceInEuros } from '@/lib/currency.js';
import LegEditor from './LegEditor.jsx';
import ClashMark from './ClashMark.jsx';
import './ItemTransports.scss';

// Les transports d'une activité, dans un sens (L11, F4).
//
// L'ALLER se lit au-dessus de l'activité, le RETOUR en dessous : on prend le
// train puis le ferry pour Miyajima, on visite, on reprend le dernier ferry.
// Ce sont des lignes de trajet, pas des activités : plus fines, sans pastille
// de catégorie, avec la durée en avant — c'est elle qui dit ce que le
// déplacement prend à la journée.
// `sync` : les transports d'un arrêt en chemin, qui règlent l'heure de départ
// de la ville quittée (0016).
export default function ItemTransports({ item, legs, clashes, sync = null, tripId, readOnly, onChanged }) {
  if (!legs || legs.length === 0) return null;

  return (
    <ul className="itrans">
      {legs.map((leg) => (
        <TransportRow
          key={leg.id}
          item={item}
          leg={leg}
          clashes={clashes?.get(leg.id)}
          sync={sync}
          tripId={tripId}
          readOnly={readOnly}
          onChanged={onChanged}
        />
      ))}
    </ul>
  );
}

function TransportRow({ item, leg, clashes, sync, tripId, readOnly, onChanged }) {
  const [editing, setEditing] = useState(false);

  const content = (
    <>
      <span className="itrans__kind">{modeLabel(leg.mode)}</span>
      {leg.direction === 'retour' && <span className="itrans__way">retour</span>}
      {leg.duration_min != null && <span className="itrans__time">{formatDuration(leg.duration_min)}</span>}
      {leg.dep && (
        <span className="itrans__when">
          {formatClock(leg.dep)}
          {leg.arr && ` → ${formatClock(leg.arr)}`}
        </span>
      )}
      {leg.price != null && <span className="itrans__when">{priceInEuros(leg.price, leg.currency ?? 'EUR')}</span>}
      {leg.note && <span className="itrans__note">{leg.note}</span>}
      <ClashMark others={clashes} />
    </>
  );

  if (readOnly) {
    return (
      <li className="itrans__row">
        <span className="itrans__line">{content}</span>
      </li>
    );
  }

  return (
    <li className="itrans__row">
      <button
        type="button"
        className="itrans__line"
        data-open={editing || undefined}
        aria-expanded={editing}
        title="Modifier ce transport"
        onClick={() => setEditing((value) => !value)}
      >
        {content}
      </button>

      {editing && (
        <LegEditor
          tripId={tripId}
          item={item}
          leg={leg}
          sync={sync}
          onClose={() => setEditing(false)}
          onChanged={onChanged}
        />
      )}
    </li>
  );
}
