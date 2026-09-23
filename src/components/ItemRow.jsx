import { useRef, useState } from 'react';
import { eurosInput, fromEuros, priceInEuros, toEuros } from '@/lib/currency.js';
import { haversine, formatDistance, MAX_DISTANCE_FROM_STEP_KM } from '@/lib/geo.js';
import { imageFor } from '@/lib/photos.js';
import {
  deleteItem,
  sealHotel,
  setChosenHotel,
  setCoordinates,
  setFavorite,
  unsealHotel,
  updateItem,
} from '@/lib/mutations.js';
import { isChosenHotel, otherHotels } from '@/lib/lodging.js';
import GeocodePicker from './GeocodePicker.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import TrashIcon from './TrashIcon.jsx';
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
// nom, note, pilule Plan, puis à droite l'étoile, LOCALISER, le prix et la
// corbeille.
export default function ItemRow({ item, step, tripTitle, readOnly, autoLocate, onChanged }) {
  // `autoLocate` n'est vrai qu'au montage de la ligne créée à l'instant : la
  // recherche part sans qu'on ait à cliquer « Localiser ».
  const [locating, setLocating] = useState(Boolean(autoLocate));
  const [editing, setEditing] = useState(false);
  const [asking, setAsking] = useState(false);
  const [sealing, setSealing] = useState(false);
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

  // Un hôtel ne se manipule pas comme le reste : son étoile désigne le
  // logement retenu de l'étape, pas une photo de bandeau. Voir lib/lodging.js.
  const isHotel = item.category === 'hotel';
  // Le retenu ne se lit pas dans `item.favorite` : sans choix explicite, c'est
  // le premier hôtel saisi qui l'est. Son étoile doit donc être allumée alors
  // que la colonne vaut false — sinon le budget compterait une nuit dont la
  // ligne n'affiche rien.
  const retained = isChosenHotel(step, item);
  // Ce que sceller ce choix emporterait. Calculé ici pour que le dialogue
  // puisse les NOMMER : « supprimer 2 candidats » sans dire lesquels ne
  // permet pas de décider.
  const candidates = isHotel ? otherHotels(step, item) : [];

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
              {(isHotel ? retained : item.favorite) && (
                <span
                  className="item__star"
                  data-on="true"
                  title={isHotel ? 'Logement retenu' : 'Mis en avant'}
                >
                  ★<span className="sr-only"> {isHotel ? 'logement retenu' : 'mis en avant'}</span>
                </span>
              )}
              {isHotel && item.booked && <span className="item__booked">réservé</span>}
              {price && <span className="item__price-read">{price}</span>}
            </>
          ) : (
            <>
              {/* L'étoile d'un hôtel se comporte comme un bouton radio : on en
                  retient un AUTRE, on ne déretient pas celui-ci — une étape a
                  toujours un logement. Celle du retenu n'est donc pas un
                  bouton, juste une marque : un bouton qui ne fait rien quand on
                  le presse est pire qu'un repère qui n'en est pas un. */}
              {isHotel && retained ? (
                <span
                  className="item__star"
                  data-on="true"
                  title="Le logement retenu de l'étape — c'est lui qui compte au budget"
                >
                  ★<span className="sr-only"> logement retenu</span>
                </span>
              ) : (
                <button
                  type="button"
                  className="item__star"
                  data-on={(isHotel ? false : item.favorite) || undefined}
                  disabled={busy}
                  aria-pressed={isHotel ? false : item.favorite}
                  title={
                    isHotel
                      ? 'Retenir ce logement — il remplacera celui de l’étape au budget'
                      : 'Mettre en avant : ce lieu illustre la ville (3 maximum)'
                  }
                  onClick={() =>
                    run(() =>
                      isHotel
                        ? setChosenHotel(step, item.id)
                        : setFavorite(item.id, !item.favorite),
                    )
                  }
                >
                  {!isHotel && item.favorite ? '★' : '☆'}
                  <span className="sr-only">
                    {isHotel
                      ? 'Retenir ce logement'
                      : item.favorite
                        ? 'Retirer de la mise en avant'
                        : 'Mettre en avant'}
                  </span>
                </button>
              )}

              {/* Réserver est un geste de fin de préparation : il scelle et il
                  supprime. Il vit donc à côté de l'étoile, mais il en diffère
                  franchement — l'un se coche et se décoche, l'autre se
                  confirme. */}
              {isHotel &&
                (item.booked ? (
                  <button
                    type="button"
                    className="item__booked"
                    data-on="true"
                    disabled={busy}
                    title="Réservé — cliquer pour annuler la réservation"
                    onClick={() => run(() => unsealHotel(item.id))}
                  >
                    ✓ réservé
                    <span className="sr-only"> — annuler la réservation</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="item__seal"
                    disabled={busy}
                    title={
                      candidates.length > 0
                        ? `Réservé : scelle le choix et supprime ${candidates.length} candidat${candidates.length > 1 ? 's' : ''}`
                        : 'Marquer ce logement comme réservé'
                    }
                    onClick={() => setSealing(true)}
                  >
                    Réserver
                    <span className="sr-only"> {item.title}</span>
                  </button>
                ))}

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
                // Le champ parle la même langue que l'affichage : des euros.
                // Taper des yens dans une interface qui montre des euros
                // n'avait aucun sens.
                defaultValue={eurosInput(item.price, item.currency)}
                placeholder="prix €"
                aria-label={`Prix de ${item.title}, en euros`}
                onBlur={(event) => {
                  const parsed = parsePrice(event.target.value);
                  if (parsed.error) {
                    setError('Prix invalide.');
                    return;
                  }
                  // On compare EN EUROS, pas en devise d'origine : sinon
                  // quitter un champ sans y toucher réécrirait la ligne, la
                  // conversion aller-retour ne retombant pas au yen près.
                  const current = item.price == null ? null : Math.round(toEuros(item.price, item.currency));
                  if (parsed.value !== current) {
                    run(() =>
                      updateItem(item.id, {
                        // La devise d'origine est préservée : un hôtel réservé
                        // en yens reste en yens, c'est le montant qu'on
                        // présentera au comptoir.
                        price: parsed.value === null ? null : fromEuros(parsed.value, item.currency),
                      }),
                    );
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
                <TrashIcon />
                <span className="sr-only">Supprimer {item.title}</span>
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

      {isHotel && (
        <ConfirmDialog
          open={sealing}
          title={`Réserver ${item.title} ?`}
          confirmLabel={candidates.length > 0 ? 'Réserver et faire le ménage' : 'Marquer comme réservé'}
          busy={busy}
          onCancel={() => setSealing(false)}
          onConfirm={async () => {
            await run(() => sealHotel(step, item.id));
            setSealing(false);
          }}
        >
          <p>
            <strong>{item.title}</strong> devient le logement de {step.name}.
          </p>

          {candidates.length > 0 && (
            <>
              <p>
                Les {candidates.length === 1 ? 'autre candidat sera supprimé' : 'autres candidats seront supprimés'} :
              </p>
              <ul>
                {candidates.map((hotel) => (
                  <li key={hotel.id}>{hotel.title}</li>
                ))}
              </ul>
              <p>Cette action est définitive — leurs prix et leurs adresses partent avec eux.</p>
            </>
          )}
        </ConfirmDialog>
      )}

      {error && (
        <p className="item__error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
