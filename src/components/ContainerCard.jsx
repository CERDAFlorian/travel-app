import { useState } from 'react';
import { CATEGORIES } from '@/lib/categories.js';
import { childrenOf, isStop } from '@/lib/containers.js';
import ItemRow from './ItemRow.jsx';
import CategoryAccordion from './CategoryAccordion.jsx';
import './ContainerCard.scss';

// Un lieu qui en contient d'autres, dans la vue Villes : là où on le SAISIT.
// Un arrêt en chemin sur la route (L11, F5), une excursion dans sa ville (F6).
//
// UNE PETITE CARTE D'EMBLÉE (Florian, 15 octobre 2026) : le lieu, puis ses
// catégories remplies, puis des raccourcis pour les autres — « + Activités »,
// « + Restaurants ». Il y avait avant une étape « + y ajouter quelque chose »
// qui ouvrait la carte : un clic de plus pour arriver au même endroit.
//
// En lecture seule, un lieu vide reste une ligne : il n'y a rien à y ajouter.
//
// Pas de logement : on n'y dort pas — c'est ce qui le distingue d'une ville.
const INNER_CATEGORIES = CATEGORIES.filter((category) => category.key !== 'hotel');

// `home` : la ville qui porte le lieu — celle qu'on quitte pour un arrêt,
// celle d'où l'on part pour une excursion. `to` : la ville d'arrivée d'un
// arrêt.
export default function ContainerCard({ container, home, to = null, autoLocate, readOnly, onChanged }) {
  // Les catégories vides ouvertes à la demande, comme sur une carte de ville.
  const [opened, setOpened] = useState([]);
  const children = childrenOf(home, container.id);
  const asCard = children.length > 0 || !readOnly;
  const stop = isStop(container);

  // Le lieu vu comme une ville, pour ce qu'il contient : son nom, sa position
  // — la recherche Google s'oriente autour de lui, et un temple à 2 km de
  // Shirakawa-gō n'est pas « loin de Takayama ».
  const asPlace = { ...home, name: container.title, lat: container.lat, lng: container.lng, items: children };

  // Le lieu lui-même. Un arrêt est sur la route : pas de « distance au
  // centre » de la ville qu'on quitte — Hakushu est à 150 km de Tokyo, c'est
  // le principe. Une excursion reste mesurée depuis sa ville : Miyajima à
  // 20 km d'Hiroshima, oui ; à 300 km, c'est une erreur de lieu.
  const rowStep = stop ? { ...home, name: `la route vers ${to?.name ?? ''}`, lat: null, lng: null } : home;

  const byCategory = new Map(INNER_CATEGORIES.map(({ key }) => [key, []]));
  for (const child of children) byCategory.get(child.category)?.push(child);

  return (
    <div className="ccard" data-card={asCard || undefined} data-kind={container.kind}>
      <ul className="ccard__line">
        <ItemRow
          item={container}
          step={rowStep}
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
        <div className="ccard__cats">
          {/* Comme une ville : les catégories remplies en accordéon, les
              vides en raccourcis (passe UX du 15 octobre 2026). */}
          {INNER_CATEGORIES.filter(
            (category) => byCategory.get(category.key).length > 0 || opened.includes(category.key),
          ).map((category) => (
            <CategoryAccordion
              key={category.key}
              category={category}
              items={byCategory.get(category.key)}
              step={asPlace}
              parentId={container.id}
              defaultOpen={opened.includes(category.key)}
              readOnly={readOnly}
              onChanged={onChanged}
            />
          ))}

          {!readOnly && (
            <p className="ccard__add-cats">
              {INNER_CATEGORIES.filter(
                (category) => byCategory.get(category.key).length === 0 && !opened.includes(category.key),
              ).map((category) => (
                <button
                  key={category.key}
                  type="button"
                  className="ccard__add-cat"
                  onClick={() => setOpened((keys) => [...keys, category.key])}
                >
                  + {category.label}
                </button>
              ))}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
