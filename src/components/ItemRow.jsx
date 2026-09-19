import { useEffect, useState } from 'react';
import { formatPrice } from '@/lib/dates.js';
import { haversine, formatDistance, MAX_DISTANCE_FROM_STEP_KM } from '@/lib/geo.js';
import { deleteItem, setFavorite, updateItem } from '@/lib/mutations.js';
import ItemForm from './ItemForm.jsx';
import GeocodePicker from './GeocodePicker.jsx';
import './ItemRow.scss';

// Lien « Plan » vers Apple Plans. L'universal link ouvre l'app native sur
// iPhone et retombe sur la version web ailleurs, sans détection de plateforme.
function mapUrl(item) {
  if (item.lat === null || item.lng === null) return null;
  return `https://maps.apple.com/?ll=${item.lat},${item.lng}&q=${encodeURIComponent(item.title)}`;
}

export default function ItemRow({ item, step, tripTitle, readOnly, onChanged }) {
  const [mode, setMode] = useState('view');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // La confirmation de suppression retombe d'elle-même au bout de trois
  // secondes. Un bouton « Confirmer ? » qui resterait armé finirait par être
  // cliqué par inadvertance, et il n'y a pas de corbeille.
  useEffect(() => {
    if (!confirmingDelete) return undefined;
    const timer = setTimeout(() => setConfirmingDelete(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmingDelete]);

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await onChanged();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'edit') {
    return (
      <li className="item-row item-row--editing">
        <ItemForm
          initial={item}
          submitLabel="Enregistrer"
          onCancel={() => setMode('view')}
          onSubmit={async (values) => {
            await updateItem(item.id, values);
            await onChanged();
            setMode('view');
          }}
        />
      </li>
    );
  }

  const href = mapUrl(item);
  const price = formatPrice(item.price, item.currency);
  const located = item.lat !== null && item.lng !== null;

  // Le contrôle de cohérence ne vaut pas qu'au moment du choix : un item
  // enregistré malgré l'avertissement, ou géocodé avant que ce contrôle
  // existe, doit rester signalé. Sinon l'erreur redevient invisible dès qu'on
  // referme le sélecteur — et on ne la découvre que devant une porte close.
  const distanceFromStep =
    located && step.lat != null && step.lng != null
      ? haversine(
          { lat: Number(step.lat), lng: Number(step.lng) },
          { lat: Number(item.lat), lng: Number(item.lng) },
        )
      : null;
  const farFromStep = distanceFromStep != null && distanceFromStep > MAX_DISTANCE_FROM_STEP_KM;

  return (
    <li className="item-row">
      <div className="item-row__main">
        <span className="item-row__dot" data-cat={item.category} aria-hidden="true" />

        <span className="item-row__body">
          <span className="item-row__title">{item.title}</span>
          {item.notes && <span className="item-row__notes">{item.notes}</span>}
        </span>

        {farFromStep && (
          <span className="item-row__far" title={`À ${formatDistance(distanceFromStep)} du centre de ${step.name}`}>
            ⚠ {formatDistance(distanceFromStep)}
          </span>
        )}

        {price && <span className="item-row__price">{price}</span>}

        {href && (
          <a className="item-row__plan" href={href} target="_blank" rel="noreferrer">
            Plan
          </a>
        )}
      </div>

      <div className="item-row__tools">
        {/* L'étoile reste affichée en lecture seule — c'est une information —
            mais ne devient un bouton que lorsque l'écriture est possible. */}
        {readOnly ? (
          item.favorite && (
            <span className="item-row__star" data-on="true" title="Favori">
              ★<span className="sr-only"> favori</span>
            </span>
          )
        ) : (
          <button
            type="button"
            className="item-row__star"
            data-on={item.favorite || undefined}
            disabled={busy}
            aria-pressed={item.favorite}
            onClick={() => run(() => setFavorite(item.id, !item.favorite))}
          >
            {item.favorite ? '★' : '☆'}
            <span className="sr-only">{item.favorite ? 'Retirer des favoris' : 'Mettre en favori'}</span>
          </button>
        )}

        {!readOnly && (
          <>
            <button
              type="button"
              className="item-row__tool"
              data-located={located || undefined}
              disabled={busy}
              onClick={() => setMode(mode === 'locate' ? 'view' : 'locate')}
            >
              {located ? 'Localisé' : 'Localiser'}
            </button>

            <button type="button" className="item-row__tool" disabled={busy} onClick={() => setMode('edit')}>
              Modifier
            </button>

            <button
              type="button"
              className="item-row__tool item-row__tool--danger"
              data-armed={confirmingDelete || undefined}
              disabled={busy}
              onClick={() => {
                if (!confirmingDelete) {
                  setConfirmingDelete(true);
                  return;
                }
                run(() => deleteItem(item.id));
              }}
            >
              {confirmingDelete ? 'Confirmer ?' : 'Supprimer'}
            </button>
          </>
        )}
      </div>

      {mode === 'locate' && (
        <GeocodePicker
          item={item}
          step={step}
          tripTitle={tripTitle}
          onCancel={() => setMode('view')}
          onDone={async () => {
            await onChanged();
            setMode('view');
          }}
        />
      )}

      {error && (
        <p className="item-row__error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
