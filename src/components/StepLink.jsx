import { useState } from 'react';
import { TRANSPORT_MODES, durationBetween, formatClock, formatDuration, modeLabel } from '@/lib/transport.js';
import { deleteLeg, saveLeg } from '@/lib/mutations.js';
import { eurosInput, priceInEuros } from '@/lib/currency.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import TrashIcon from './TrashIcon.jsx';
import './StepLink.scss';

// Un prix saisi au clavier français s'écrit « 110 » ou « 12,50 ». Vide vaut
// « pas de prix » — pas zéro : un trajet inclus dans le JR Pass et un trajet
// dont on ignore le prix ne sont pas la même chose.
function parsePrice(raw) {
  const cleaned = String(raw).replace(/\s/g, '').replace(',', '.');
  if (cleaned === '') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

// Le trajet entre deux étapes.
//
// Il vit ENTRE les deux cartes, pas au pied de la première : un trajet
// appartient à l'intervalle, pas à la ville qu'on quitte. La ligne fine tient
// le fil de l'itinéraire d'une étape à l'autre, et le libellé s'y pose au
// milieu.
export default function StepLink({ trip, fromStep, toStep, leg, readOnly, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const [mode, setMode] = useState(leg?.mode ?? 'train');
  const [dep, setDep] = useState(formatClock(leg?.dep) ?? '');
  const [arr, setArr] = useState(formatClock(leg?.arr) ?? '');
  const [price, setPrice] = useState(eurosInput(leg?.price, leg?.currency) ?? '');

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await onChanged();
      setEditing(false);
      setAsking(false);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  // Ce qui s'affiche quand le trajet est connu : « Shinkansen · 09:12 → 11:52
  // · 2 h 40 ». La durée reste affichée même sans horaire, pour les trajets
  // dont on ne connaît que ça.
  const summary = leg
    ? [
        modeLabel(leg.mode),
        formatClock(leg.dep) && `${formatClock(leg.dep)} → ${formatClock(leg.arr)}`,
        formatDuration(leg.duration_min),
        // Le prix se lit ici, là où l'œil passe déjà. Six trajets pèsent
        // lourd, et les chercher un par un dans le budget ne dit pas lequel
        // coûte cher.
        priceInEuros(leg.price, leg.currency),
      ]
        .filter(Boolean)
        .join(' · ')
    : null;

  if (editing) {
    const preview = formatDuration(durationBetween(dep, arr));

    return (
      <div className="link link--editing">
        <form
          className="link__form"
          onSubmit={(event) => {
            event.preventDefault();
            run(() =>
              saveLeg({
                id: leg?.id,
                tripId: trip.id,
                fromStep: fromStep.id,
                toStep: toStep.id,
                mode,
                dep,
                arr,
                price: parsePrice(price),
              }),
            );
          }}
        >
          <select
            className="link__field"
            value={mode}
            aria-label="Type de transport"
            onChange={(event) => setMode(event.target.value)}
          >
            {TRANSPORT_MODES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <input
            className="link__time"
            type="time"
            value={dep}
            aria-label="Heure de départ"
            onChange={(event) => setDep(event.target.value)}
          />
          <span className="link__arrow" aria-hidden="true">→</span>
          <input
            className="link__time"
            type="time"
            value={arr}
            aria-label="Heure d'arrivée"
            onChange={(event) => setArr(event.target.value)}
          />

          <input
            className="link__price"
            type="text"
            inputMode="numeric"
            value={price}
            placeholder="prix €"
            aria-label="Prix du trajet, en euros"
            onChange={(event) => setPrice(event.target.value)}
          />

          {/* La durée se calcule sous les yeux : on voit tout de suite qu'un
              bus de nuit fait 7 h 20 et non moins seize heures. */}
          {preview && <span className="link__preview">{preview}</span>}

          <button className="link__save" type="submit" disabled={busy}>
            {busy ? '…' : 'Enregistrer'}
          </button>
          <button className="link__cancel" type="button" onClick={() => setEditing(false)}>
            Annuler
          </button>

          {error && (
            <p className="link__error" role="alert">
              {error}
            </p>
          )}
        </form>
      </div>
    );
  }

  return (
    <div className="link">
      <span className="link__rule" aria-hidden="true" />

      {leg ? (
        <span className="link__summary">
          <button
            type="button"
            className="link__label"
            disabled={readOnly}
            title={readOnly ? undefined : 'Modifier ce trajet'}
            onClick={() => setEditing(true)}
          >
            {summary}
          </button>
          {!readOnly && (
            <button
              type="button"
              className="link__delete"
              title="Supprimer ce trajet"
              onClick={() => setAsking(true)}
            >
              <TrashIcon />
              <span className="sr-only">Supprimer le trajet</span>
            </button>
          )}
        </span>
      ) : (
        !readOnly && (
          <button type="button" className="link__add" onClick={() => setEditing(true)}>
            + Ajouter un transport
          </button>
        )
      )}

      <span className="link__rule" aria-hidden="true" />

      <ConfirmDialog
        open={asking}
        title="Supprimer ce trajet ?"
        busy={busy}
        onCancel={() => setAsking(false)}
        onConfirm={() => run(() => deleteLeg(leg.id))}
      >
        <p>
          <strong>
            {fromStep.name} → {toStep.name}
          </strong>
          {summary ? ` · ${summary}` : ''}.
        </p>
        <p>Les étapes ne bougent pas : seul le trajet entre elles est effacé.</p>
      </ConfirmDialog>
    </div>
  );
}
