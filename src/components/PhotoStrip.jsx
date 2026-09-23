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
//
// ÉTAPE VIDE : trois emplacements, pas une bannière. Le bandeau annonçait
// « photos de Osaka à déposer ici », ce qui laissait croire qu'on attendait des
// photos DE LA VILLE, à téléverser. Ni l'un ni l'autre : les images viennent
// des activités, restaurants et lieux qu'on ajoute à l'étape, et elles
// apparaissent toutes seules. Trois cases de la même taille que les vraies
// tuiles disent la seule chose utile — la place existe, elle attend du contenu.
export default function PhotoStrip({ items, stepName }) {
  const tiles = photoStripFor(items);

  if (tiles.length === 0) {
    return (
      <div className="photo-strip__waiting">
        <ul className="photo-strip" aria-hidden="true">
          {[0, 1, 2].map((slot) => (
            <li key={slot} className="photo-strip__tile">
              <div className="photo-strip__hole" />
            </li>
          ))}
        </ul>

        <p className="photo-strip__note">
          Les photos viendront des activités, restos et lieux de l'étape.
        </p>
      </div>
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
