import { useState } from 'react';
import { TRANSPORT_MODES, durationBetween, formatClock, formatDuration, legSummary } from '@/lib/transport.js';
import { deleteLeg, saveLeg } from '@/lib/mutations.js';
import { eurosInput } from '@/lib/currency.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import TrashIcon from './TrashIcon.jsx';
import './LegEditor.scss';

// Un prix saisi au clavier français s'écrit « 110 » ou « 12,50 ». Vide vaut
// « pas de prix » — pas zéro : un trajet inclus dans le JR Pass et un trajet
// dont on ignore le prix ne sont pas la même chose.
function parsePrice(raw) {
  const cleaned = String(raw).replace(/\s/g, '').replace(',', '.');
  if (cleaned === '') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

// La saisie d'un trajet : entre deux villes, ou pour aller à une activité.
//
// Elle vit dans le JOUR PAR JOUR depuis L11 F3 : sur la ligne du trajet du jour
// où l'on change de ville — c'est là qu'on voit ce que le trajet prend à la
// journée —, ou sous une activité (F4) pour le ferry de Miyajima. Un seul
// formulaire pour les deux : un transport reste un transport.
//
// Avec `item`, le trajet dessert l'activité et porte un SENS : l'aller se lit
// avant elle, le retour après.
export default function LegEditor({ tripId, fromStep, toStep, item, leg, onClose, onChanged }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const [mode, setMode] = useState(leg?.mode ?? 'train');
  const [dep, setDep] = useState(formatClock(leg?.dep) ?? '');
  const [arr, setArr] = useState(formatClock(leg?.arr) ?? '');
  const [price, setPrice] = useState(eurosInput(leg?.price, leg?.currency) ?? '');
  const [note, setNote] = useState(leg?.note ?? '');
  const [direction, setDirection] = useState(leg?.direction ?? 'aller');

  // Ce que le trajet relie, pour les libellés et la confirmation.
  const route = item
    ? `${direction === 'retour' ? 'Retour de' : 'Pour aller à'} ${item.title}`
    : `${fromStep.name} → ${toStep.name}`;

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await onChanged();
      setAsking(false);
      onClose();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  // La durée se calcule sous les yeux : on voit tout de suite qu'un bus de
  // nuit fait 7 h 20 et non moins seize heures.
  const preview = formatDuration(durationBetween(dep, arr));

  return (
    <>
      <form
        className="legform"
        aria-label={`Trajet · ${route}`}
        onSubmit={(event) => {
          event.preventDefault();
          run(() =>
            saveLeg({
              id: leg?.id,
              tripId,
              fromStep: fromStep?.id,
              toStep: toStep?.id,
              itemId: item?.id ?? null,
              direction,
              mode,
              dep,
              arr,
              price: parsePrice(price),
              note,
            }),
          );
        }}
      >
        {item && (
          <select
            className="legform__field"
            value={direction}
            aria-label="Sens du trajet"
            onChange={(event) => setDirection(event.target.value)}
          >
            <option value="aller">Aller</option>
            <option value="retour">Retour</option>
          </select>
        )}

        <select
          className="legform__field"
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
          className="legform__time"
          type="time"
          value={dep}
          aria-label="Heure de départ"
          onChange={(event) => setDep(event.target.value)}
        />
        <span className="legform__arrow" aria-hidden="true">→</span>
        <input
          className="legform__time"
          type="time"
          value={arr}
          aria-label="Heure d'arrivée"
          onChange={(event) => setArr(event.target.value)}
        />

        <input
          className="legform__price"
          type="text"
          inputMode="numeric"
          value={price}
          placeholder="prix €"
          aria-label="Prix du trajet, en euros"
          onChange={(event) => setPrice(event.target.value)}
        />

        {preview && <span className="legform__preview">{preview}</span>}

        <input
          className="legform__note"
          type="text"
          value={note}
          placeholder="note : JR Pass, places à réserver…"
          aria-label="Note sur le trajet"
          onChange={(event) => setNote(event.target.value)}
        />

        <span className="legform__actions">
          <button className="legform__save" type="submit" disabled={busy}>
            {busy ? '…' : 'Enregistrer'}
          </button>
          <button className="legform__cancel" type="button" disabled={busy} onClick={onClose}>
            Annuler
          </button>

          {leg && (
            <button
              type="button"
              className="legform__delete"
              disabled={busy}
              title="Supprimer ce trajet"
              onClick={() => setAsking(true)}
            >
              <TrashIcon />
              <span className="sr-only">Supprimer le trajet</span>
            </button>
          )}
        </span>

        {error && (
          <p className="legform__error" role="alert">
            {error}
          </p>
        )}
      </form>

      <ConfirmDialog
        open={asking}
        title="Supprimer ce trajet ?"
        busy={busy}
        onCancel={() => setAsking(false)}
        onConfirm={() => run(() => deleteLeg(leg.id))}
      >
        <p>
          <strong>{route}</strong>
          {leg ? ` · ${legSummary(leg)}` : ''}.
        </p>
        <p>
          {item
            ? 'L’activité reste à sa place : seul ce transport est effacé.'
            : 'Les étapes ne bougent pas : seul le trajet entre elles est effacé.'}
        </p>
      </ConfirmDialog>
    </>
  );
}
