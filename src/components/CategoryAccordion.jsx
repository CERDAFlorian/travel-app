import { useId, useState } from 'react';
import ItemRow from './ItemRow.jsx';
import './CategoryAccordion.scss';

// Une catégorie d'une étape, repliable.
//
// Tout est replié au départ, y compris ce qui contient des items : on prépare
// un voyage en ouvrant la catégorie qu'on cherche, pas en faisant défiler les
// six. Sur les 48 items du Japon, tout déplier d'emblée ferait de Tokyo un mur
// de texte à 375 px.
//
// Une catégorie vide n'est pas un bouton : elle reste affichée — son absence
// ferait douter de l'existence de la catégorie — mais ne s'ouvre pas.
export default function CategoryAccordion({ category, items }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const empty = items.length === 0;

  if (empty) {
    return (
      <div className="accordion accordion--empty">
        <span className="accordion__label">{category.label}</span>
        <span className="accordion__count">0</span>
      </div>
    );
  }

  return (
    <div className="accordion">
      <button
        type="button"
        className="accordion__head"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span className="accordion__dot" data-cat={category.key} aria-hidden="true" />
        <span className="accordion__label">{category.label}</span>
        <span className="accordion__count">{items.length}</span>
        <span className="accordion__chevron" data-open={open || undefined} aria-hidden="true">
          ›
        </span>
      </button>

      {/* Démonté quand replié plutôt que masqué en CSS : sept étapes × six
          catégories, c'est 48 lignes qu'on évite de garder dans le DOM. */}
      {open && (
        <ul className="accordion__panel" id={panelId}>
          {items.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}
