import { photoStripFor } from '@/lib/photos.js';
import './PhotoStrip.scss';

// Bandeau de 3 photos d'une étape.
//
// Les photos ne sont pas portées par l'étape : elles viennent de ses items, par
// appariement de mots-clés (voir lib/photos.js).
//
// Une tuile sans image garde sa place : le nom du lieu, puis « Une photo ? »
// centré. La question invite au lieu d'ordonner, et surtout elle ne promet pas
// un import de fichier : le clic ouvre une recherche d'images pré-remplie, et
// l'image posée ensuite dans design/img/ apparaîtra sans toucher au code.
//
// Le libellé reste court par contrainte : une tuile fait un tiers de la carte,
// soit ~110px sur mobile, ce qui laisse une dizaine de caractères.
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
                className="photo-strip__add"
                href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${tile.title} ${stepName} Japon`)}`}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
                title={`Trouver une photo de ${tile.title}`}
              >
                Une photo ?
              </a>
            </div>
          )}
          <span className="photo-strip__caption">{tile.title}</span>
        </li>
      ))}
    </ul>
  );
}
