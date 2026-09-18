import { photoStripFor } from '@/lib/photos.js';
import './PhotoStrip.scss';

// Bandeau de 3 photos d'une étape.
//
// Les photos ne sont pas portées par l'étape : elles viennent de ses items, par
// appariement de mots-clés (voir lib/photos.js). Une étape sans item mis en
// avant n'affiche pas de bandeau vide, elle n'en affiche pas du tout.
export default function PhotoStrip({ items }) {
  const tiles = photoStripFor(items);
  if (tiles.length === 0) return null;

  return (
    <ul className="photo-strip">
      {tiles.map((tile) => (
        <li key={tile.id} className="photo-strip__tile" data-empty={!tile.src || undefined}>
          {tile.src ? (
            // loading="lazy" : sept étapes font vingt-et-une images, dont la
            // plupart sous la ligne de flottaison.
            <img
              className="photo-strip__img"
              src={tile.src}
              alt={tile.title}
              loading="lazy"
              decoding="async"
            />
          ) : (
            // Repli quand aucune image ne correspond, ou qu'elle n'est pas
            // encore exportée du canvas. Le titre reste lisible : la tuile
            // informe au lieu de laisser un trou.
            <span className="photo-strip__fallback">{tile.title}</span>
          )}
          <span className="photo-strip__caption">{tile.title}</span>
        </li>
      ))}
    </ul>
  );
}
