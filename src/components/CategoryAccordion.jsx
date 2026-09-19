import { useId, useState } from 'react';
import { addItem } from '@/lib/mutations.js';
import ItemRow from './ItemRow.jsx';
import ItemForm from './ItemForm.jsx';
import './CategoryAccordion.scss';

// Une catégorie d'une étape, repliable.
//
// Tout est replié au départ, y compris ce qui contient des items : on prépare
// un voyage en ouvrant la catégorie qu'on cherche, pas en faisant défiler les
// six. Sur les 48 items du Japon, tout déplier d'emblée ferait de Tokyo un mur
// de texte à 375 px.
export default function CategoryAccordion({
  category,
  items,
  step,
  tripTitle,
  readOnly,
  onChanged,
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  // Une catégorie vide reste une catégorie : son absence ferait douter qu'elle
  // existe. En lecture seule elle n'est qu'un libellé ; dès qu'on peut écrire,
  // elle s'ouvre — c'est le seul endroit d'où ajouter le premier item.
  const inert = items.length === 0 && readOnly;

  if (inert) {
    return (
      <div className="accordion accordion--empty">
        <span className="accordion__label">{category.label}</span>
        <span className="accordion__count">0</span>
      </div>
    );
  }

  // Les positions sont propres à l'étape, toutes catégories confondues : on
  // prend la suite de la plus grande plutôt que de recommencer à 1 par
  // catégorie, ce qui créerait des doublons à l'échelle de l'étape.
  const nextPosition =
    step.items.reduce((max, current) => Math.max(max, current.position ?? 0), 0) + 1;

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
        <div className="accordion__panel" id={panelId}>
          <ul className="accordion__items">
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
            <ItemForm
              onSubmit={async (values) => {
                await addItem({
                  stepId: step.id,
                  category: category.key,
                  position: nextPosition,
                  ...values,
                });
                await onChanged();
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
