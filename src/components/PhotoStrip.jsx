import { photoStripFor } from '@/lib/photos.js';
import './PhotoStrip.scss';

// Bandeau de 3 photos d'une étape.
//
// Les photos ne sont pas portées par l'étape : elles viennent de ses items, par
// appariement de mots-clés (voir lib/photos.js).
//
// Une tuile sans image garde sa place et affiche le nom du lieu, avec un lien
// de recherche. Ce lien n'est pas un gadget : il dit quoi chercher pour combler
// le trou, et l'image déposée ensuite dans design/img/ apparaîtra sans toucher
// au code.
export default function PhotoStrip({ items, stepName }) {
  const tiles = photoStripFor(items);

  if (tiles.length === 0) {
    return (
      <div className="photo-strip__empty">photos de {stepName} à déposer ici</div>
    );
  }

  return (
    <ul className="photo-strip">
      {tiles.map((tile) => (
        <li key={tile.id} className="photo-strip__tile">
          {tile.src ? (
            <div
              className="photo-strip__img"
              role="img"
              aria-label={tile.title}
              style={{ backgroundImage: `url(${tile.src})` }}
            />
          ) : (
            <div className="photo-strip__slot">
              <span className="photo-strip__slot-name">{tile.title}</span>
              <a
                className="photo-strip__search"
                href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${tile.title} ${stepName} Japon`)}`}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
                title="Chercher une photo de ce lieu"
              >
                chercher
              </a>
            </div>
          )}
          <span className="photo-strip__caption">{tile.title}</span>
        </li>
      ))}
    </ul>
  );
}
