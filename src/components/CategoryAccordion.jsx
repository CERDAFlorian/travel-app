import { useId, useState } from 'react';
import { formatEuros } from '@/lib/currency.js';
import { sumInEuros } from '@/lib/budget.js';
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
  // Item tout juste créé : sa ligne ouvre d'elle-même la recherche d'adresse.
  const [justAdded, setJustAdded] = useState(null);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const panelId = useId();

  // Total de la catégorie, en euros. Le design l'affiche à droite de l'en-tête :
  // c'est ce qui permet de voir où part l'argent sans déplier.
  const sum = sumInEuros(items);
  const total = sum > 0 ? formatEuros(sum) : '';

  const nextPosition =
    step.items.reduce((max, current) => Math.max(max, current.position ?? 0), 0) + 1;

  async function submit(event) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    try {
      const id = await addItem({
        stepId: step.id,
        category: category.key,
        position: nextPosition,
        title: trimmed,
        price: parsePrice(price),
      });
      // Une note perso n'a pas de lieu : lui proposer une adresse n'a aucun
      // sens. Les cinq autres catégories, si.
      if (category.onMap) setJustAdded(id);
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
                autoLocate={item.id === justAdded}
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
                  placeholder={category.key === 'hotel' || category.key === 'activite' || category.key === 'lieu' ? 'prix ¥' : 'prix'}
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
