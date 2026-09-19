import { useState } from 'react';
import './ItemForm.scss';

// Un prix saisi au clavier français s'écrit « 4 500 » ou « 12,50 ». On accepte
// les deux, et une chaîne vide vaut « pas de prix » — pas zéro : un item
// gratuit et un item dont on ignore le prix ne sont pas la même chose.
function parsePrice(raw) {
  const cleaned = raw.replace(/\s/g, '').replace(',', '.');
  if (cleaned === '') return { value: null };
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return { error: 'Prix invalide.' };
  return { value };
}

// Saisie d'un item — ajout comme édition.
//
// Pas de modale : à 375 px elle masquerait l'étape, la catégorie et les items
// voisins, c'est-à-dire tout ce qui permet de savoir ce qu'on est en train de
// saisir. Le formulaire prend la place de la ligne, ou s'ajoute en bas de la
// catégorie.
export default function ItemForm({ initial, submitLabel = 'Ajouter', onSubmit, onCancel }) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [price, setPrice] = useState(initial?.price != null ? String(initial.price) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;

    const trimmed = title.trim();
    if (!trimmed) {
      setError('Un titre est nécessaire.');
      return;
    }

    const parsed = parsePrice(price);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await onSubmit({ title: trimmed, price: parsed.value });
      // Après un ajout on vide pour enchaîner ; après une édition le
      // composant est démonté, remettre l'état à zéro n'a pas d'effet.
      setTitle('');
      setPrice('');
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="item-form" onSubmit={handleSubmit}>
      <input
        className="item-form__title"
        type="text"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Titre"
        aria-label="Titre de l'item"
        // eslint-disable-next-line jsx-a11y/no-autofocus -- le formulaire
        // n'apparaît que sur une action explicite : le focus y est attendu.
        autoFocus={Boolean(initial)}
      />

      {/* inputMode numeric : ouvre le pavé numérique sur iPhone sans imposer
          type="number", dont les flèches et le rejet de la virgule gênent
          plus qu'ils n'aident. */}
      <input
        className="item-form__price"
        type="text"
        inputMode="numeric"
        value={price}
        onChange={(event) => setPrice(event.target.value)}
        placeholder="Prix"
        aria-label="Prix"
      />

      <button className="item-form__submit" type="submit" disabled={busy}>
        {busy ? '…' : submitLabel}
      </button>

      {onCancel && (
        <button className="item-form__cancel" type="button" onClick={onCancel}>
          Annuler
        </button>
      )}

      {error && (
        <p className="item-form__error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
