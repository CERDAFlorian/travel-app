import { useState } from 'react';
import { CATEGORIES } from '@/lib/categories.js';
import { childrenOf } from '@/lib/containers.js';
import ItemRow from './ItemRow.jsx';
import CategoryAccordion from './CategoryAccordion.jsx';
import './RouteStop.scss';

// Un arrêt en chemin, dans la vue Villes (L11, F5) : là où on le SAISIT.
//
// LE CONTENU DÉCIDE DE LA FORME. Vide, l'arrêt tient sur une ligne — Hakushu,
// la distillerie : l'arrêt est la visite. Dès qu'on y range quelque chose, il
// s'ouvre en petite carte avec les catégories d'une ville — Shirakawa-gō, son
// temple, son déjeuner. Rien à choisir à l'avance, et un arrêt qu'on vide
// redevient une ligne.
//
// Pas de logement : on ne dort pas à un arrêt — c'est ce qui le distingue
// d'une ville.
const STOP_CATEGORIES = CATEGORIES.filter((category) => category.key !== 'hotel');

export default function RouteStop({ stop, from, to, autoLocate, readOnly, onChanged }) {
  const [open, setOpen] = useState(false);
  const children = childrenOf(from, stop.id);
  const asCard = children.length > 0 || open;

  // L'arrêt vu comme une ville, pour ce qu'il contient : son nom, sa position
  // — la recherche Google s'oriente autour de lui, et un temple à 2 km de
  // Shirakawa-gō n'est pas « loin de Takayama ».
  const asPlace = { ...from, name: stop.title, lat: stop.lat, lng: stop.lng, items: children };

  // L'arrêt lui-même, sur la route : pas de « distance au centre » de la
  // ville qu'on quitte — Hakushu est à 150 km de Tokyo, c'est le principe.
  const onRoute = { ...from, name: `la route vers ${to.name}`, lat: null, lng: null };

  const byCategory = new Map(STOP_CATEGORIES.map(({ key }) => [key, []]));
  for (const child of children) byCategory.get(child.category)?.push(child);

  return (
    <div className="rstop" data-card={asCard || undefined}>
      <ul className="rstop__line">
        <ItemRow
          item={stop}
          step={onRoute}
          readOnly={readOnly}
          autoLocate={autoLocate}
          deleteNote={
            children.length > 0
              ? `Ce qu'il contient part avec lui : ${children.map((child) => child.title).join(', ')}.`
              : null
          }
          onChanged={onChanged}
        />
      </ul>

      {asCard ? (
        <div className="rstop__cats">
          {STOP_CATEGORIES.map((category) => (
            <CategoryAccordion
              key={category.key}
              category={category}
              items={byCategory.get(category.key)}
              step={asPlace}
              parentId={stop.id}
              readOnly={readOnly}
              onChanged={onChanged}
            />
          ))}
        </div>
      ) : (
        !readOnly && (
          <button type="button" className="rstop__open" onClick={() => setOpen(true)}>
            + y ajouter quelque chose
          </button>
        )
      )}
    </div>
  );
}
