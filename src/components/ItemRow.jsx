import { useRef, useState } from 'react';
import { priceInEuros } from '@/lib/currency.js';
import { haversine, formatDistance, MAX_DISTANCE_FROM_STEP_KM } from '@/lib/geo.js';
import { imageFor } from '@/lib/photos.js';
import { deleteItem, setCoordinates, setFavorite, updateItem } from '@/lib/mutations.js';
import GeocodePicker from './GeocodePicker.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import './ItemRow.scss';

// « Plan ↗ » sur iOS, « Maps ↗ » ailleurs — repris du design. L'universal link
// ouvre l'app native sur iPhone et la version web ailleurs, sans branche de code.
const IS_IOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
const MAP_LABEL = IS_IOS ? 'Plan ↗' : 'Maps ↗';

function mapUrl(item) {
  if (item.lat === null || item.lng === null) return null;
  return `https://maps.apple.com/?ll=${item.lat},${item.lng}&q=${encodeURIComponent(item.title)}`;
}

// Un prix saisi au clavier français s'écrit « 4 500 » ou « 12,50 ». Vide vaut
// « pas de prix » — pas zéro : un item gratuit et un item dont on ignore le
// prix ne sont pas la même chose.
function parsePrice(raw) {
  const cleaned = String(raw).replace(/\s/g, '').replace(',', '.');
  if (cleaned === '') return { value: null };
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? { value } : { error: true };
}

// Une ligne d'item, sur UNE ligne comme dans le design : vignette, pastille,
// nom, note, pilule Plan, puis à droite l'étoile, LOCALISER, le prix et ✕.
export default function ItemRow({ item, step, tripTitle, readOnly, onChanged }) {
  const [locating, setLocating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const titleRef = useRef(null);

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

  const href = mapUrl(item);
  // Affiché en euros ; la saisie reste dans la devise d'origine — on tape le
  // prix qu'on paiera au comptoir, on lit le budget dans sa propre monnaie.
  const price = priceInEuros(item.price, item.currency);
  const located = item.lat !== null && item.lng !== null;
  const thumb = imageFor(item.title);

  // Le contrôle de cohérence reste visible sur l'item enregistré : un
  // « enregistrer quand même » redeviendrait invisible dès le sélecteur fermé.
  const distance =
    located && step.lat != null && step.lng != null
      ? haversine(
          { lat: Number(step.lat), lng: Number(step.lng) },
          { lat: Number(item.lat), lng: Number(item.lng) },
        )
      : null;
  const farFromStep = distance != null && distance > MAX_DISTANCE_FROM_STEP_KM;

  return (
    <li className="item">
      <div className="item__line">
        {thumb && (
          <span
            className="item__thumb"
            role="img"
            aria-label={item.title}
            style={{ backgroundImage: `url(${thumb})` }}
          />
        )}

        <span className="item__dot" data-cat={item.category} aria-hidden="true" />

        {/* Le design ne propose pas de bouton « modifier » : on clique le nom.
            Un bouton de plus sur une ligne déjà dense la ferait déborder. */}
        {editing ? (
          <input
            ref={titleRef}
            className="item__edit"
            type="text"
            defaultValue={item.title}
            autoFocus
            onClick={(event) => event.stopPropagation()}
            onBlur={(event) => {
              const next = event.target.value.trim();
              setEditing(false);
              if (next && next !== item.title) run(() => updateItem(item.id, { title: next }));
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.target.blur();
              if (event.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <span
            className="item__name"
            data-editable={!readOnly || undefined}
            onClick={() => !readOnly && setEditing(true)}
          >
            {item.title}
          </span>
        )}

        {item.notes && <span className="item__meta">{item.notes}</span>}

        {href && (
          <a className="item__map" href={href} target="_blank" rel="noreferrer">
            {MAP_LABEL}
          </a>
        )}

        {farFromStep && (
          <span
            className="item__far"
            title={`À ${formatDistance(distance)} du centre de ${step.name}`}
          >
            ⚠ {formatDistance(distance)}
          </span>
        )}

        <span className="item__tools">
          {readOnly ? (
            <>
              {item.favorite && (
                <span className="item__star" data-on="true" title="Mis en avant">
                  ★<span className="sr-only"> mis en avant</span>
                </span>
              )}
              {price && <span className="item__price-read">{price}</span>}
            </>
          ) : (
            <>
              <button
                type="button"
                className="item__star"
                data-on={item.favorite || undefined}
                disabled={busy}
                aria-pressed={item.favorite}
                title="Mettre en avant : ce lieu illustre la ville (3 maximum)"
                onClick={() => run(() => setFavorite(item.id, !item.favorite))}
              >
                {item.favorite ? '★' : '☆'}
                <span className="sr-only">
                  {item.favorite ? 'Retirer de la mise en avant' : 'Mettre en avant'}
                </span>
              </button>

              <button
                type="button"
                className="item__locate"
                data-on={located || undefined}
                disabled={busy}
                title="Placer automatiquement sur la carte"
                onClick={() => setLocating((value) => !value)}
              >
                {located ? 'Localisé' : 'Localiser'}
              </button>

              <input
                className="item__price"
                type="text"
                inputMode="numeric"
                defaultValue={item.price ?? ''}
                placeholder={item.currency === 'EUR' ? 'prix €' : 'prix ¥'}
                title={`Saisie en ${item.currency ?? 'JPY'} — l'affichage est converti en euros`}
                aria-label={`Prix de ${item.title} en ${item.currency ?? 'JPY'}`}
                onBlur={(event) => {
                  const parsed = parsePrice(event.target.value);
                  if (parsed.error) {
                    setError('Prix invalide.');
                    return;
                  }
                  if (parsed.value !== (item.price ?? null)) {
                    run(() => updateItem(item.id, { price: parsed.value }));
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.target.blur();
                }}
              />

              <button
                type="button"
                className="item__delete"
                disabled={busy}
                title="Supprimer"
                onClick={() => setAsking(true)}
              >
                ✕<span className="sr-only">Supprimer {item.title}</span>
              </button>
            </>
          )}
        </span>
      </div>

      {locating && (
        <GeocodePicker
          title={item.title}
          stepName={step.name}
          tripTitle={tripTitle}
          reference={
            step.lat != null && step.lng != null
              ? { lat: Number(step.lat), lng: Number(step.lng) }
              : null
          }
          onCancel={() => setLocating(false)}
          onSave={async (point, geocoded) => {
            await setCoordinates(item.id, point, { geocoded });
            await onChanged();
            setLocating(false);
          }}
        />
      )}

      <ConfirmDialog
        open={asking}
        title="Supprimer cet item ?"
        busy={busy}
        onCancel={() => setAsking(false)}
        onConfirm={async () => {
          await run(() => deleteItem(item.id));
          setAsking(false);
        }}
      >
        <p>
          <strong>{item.title}</strong> sera retiré de {step.name}.
        </p>
        <p>Cette action est définitive : il n'y a pas de corbeille.</p>
      </ConfirmDialog>

      {error && (
        <p className="item__error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
