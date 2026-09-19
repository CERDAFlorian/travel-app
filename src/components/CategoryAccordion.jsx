import { useId, useState } from 'react';
import { formatPrice } from '@/lib/dates.js';
import { addItem } from '@/lib/mutations.js';
import ItemRow from './ItemRow.jsx';
import './CategoryAccordion.scss';

function parsePrice(raw) {
  const cleaned = String(raw).replace(/\s/g, '').replace(',', '.');
  if (cleaned === '') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

// Une catégorie d'une étape, repliable.
//
// Tout est replié au départ : on prépare un voyage en ouvrant la catégorie
// qu'on cherche, pas en faisant défiler les six. Sur 48 items, tout déplier
// d'emblée ferait de Tokyo un mur de texte.
export default function CategoryAccordion({ category, items, step, tripTitle, readOnly, onChanged }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const panelId = useId();

  // Total de la catégorie, par devise. Le design l'affiche à droite de
  // l'en-tête : c'est ce qui permet de voir où part l'argent sans déplier.
  const sums = new Map();
  for (const item of items) {
    const amount = Number(item.price ?? 0);
    if (amount) {
      const currency = item.currency ?? 'JPY';
      sums.set(currency, (sums.get(currency) ?? 0) + amount);
    }
  }
  const total = [...sums.entries()].map(([c, amount]) => formatPrice(amount, c)).join(' + ');

  const nextPosition =
    step.items.reduce((max, current) => Math.max(max, current.position ?? 0), 0) + 1;

  async function submit(event) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    try {
      await addItem({
        stepId: step.id,
        category: category.key,
        position: nextPosition,
        title: trimmed,
        price: parsePrice(price),
      });
      await onChanged();
      setTitle('');
      setPrice('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cat">
      <button
        type="button"
        className="cat__head"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span className="cat__dot" data-cat={category.key} aria-hidden="true" />
        <span className="cat__label">{category.label}</span>
        <span className="cat__count">{items.length}</span>
        <span className="cat__total">{total}</span>
        <span className="cat__caret" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
      </button>

      {/* Démonté quand replié plutôt que masqué : sept étapes × six catégories,
          c'est 48 lignes qu'on évite de garder dans le DOM. */}
      {open && (
        <div className="cat__panel" id={panelId}>
          <ul className="cat__items">
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                step={step}
                tripTitle={tripTitle}
                readOnly={readOnly}
                onChanged={onChanged}
              />
            ))}
          </ul>

          {!readOnly && (
            <form className="cat__add" onSubmit={submit}>
              <input
                className="cat__add-title"
                type="text"
                value={title}
                placeholder={category.placeholder}
                aria-label={`Ajouter dans ${category.label}`}
                onChange={(event) => setTitle(event.target.value)}
              />
              {category.budget && (
                <input
                  className="cat__add-price"
                  type="text"
                  inputMode="numeric"
                  value={price}
                  placeholder="prix"
                  aria-label="Prix"
                  onChange={(event) => setPrice(event.target.value)}
                />
              )}
              <button className="cat__add-submit" type="submit" disabled={busy}>
                +
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
