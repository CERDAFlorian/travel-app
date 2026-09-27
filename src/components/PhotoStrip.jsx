import { useState } from 'react';
import { featured } from '@/lib/photos.js';
import { hasGoogleMaps } from '@/lib/googleMaps.js';
import { cachedPhoto, photoOf } from '@/lib/places.js';
import { useOnline } from '@/hooks/useOnline.js';
import './PhotoStrip.scss';

// Bandeau de 3 photos d'une étape.
//
// Les tuiles ne sont pas portées par l'étape : ce sont ses items mis en avant
// (voir lib/photos.js).
//
// D'ABORD WIKIMEDIA, GRATUIT ET ENREGISTRÉ (0012_photos.sql) : la photo
// s'affiche d'elle-même, tout le temps, hors ligne compris.
//
// PUIS GOOGLE, AU GESTE (L10, F4), seulement pour les lieux reliés qui n'ont
// pas de photo libre. Chaque image Google affichée est facturée et ne peut pas
// être stockée : on ne la demande que sur « Voir les photos ». Elle reste en
// mémoire le temps de la visite (lib/places.js). Un lieu sans aucune photo
// garde son emplacement : le nom, puis « Une photo ? », qui ouvre une
// recherche d'images pré-remplie.
//
// Le libellé reste court par contrainte : une tuile fait un tiers de la carte,
// soit ~110px sur mobile, ce qui laisse une dizaine de caractères.
//
// ÉTAPE VIDE : trois emplacements, pas une bannière. Le bandeau annonçait
// « photos de Osaka à déposer ici », ce qui laissait croire qu'on attendait des
// photos DE LA VILLE, à téléverser. Ni l'un ni l'autre : les images viennent
// des items qu'on ajoute à l'étape, et elles apparaissent toutes seules.
//
// Trois cases de la même taille que les vraies tuiles, et une ligne qui nomme
// l'étoile — c'est elle qui décide de ce qui monte dans le bandeau, et le seul
// moyen d'y faire entrer un restaurant ou une boutique.
export default function PhotoStrip({ items, stepName }) {
  const tiles = featured(items);
  const online = useOnline();
  // Photos déjà obtenues pendant la visite : item.id → photo, ou null si Google
  // n'en a pas. Amorcé depuis la mémoire de lib/places.js : un bandeau déjà vu
  // réapparaît sans nouveau clic.
  const [photos, setPhotos] = useState(
    () =>
      new Map(
        tiles
          .filter((tile) => tile.place_id && cachedPhoto(tile.place_id) !== undefined)
          .map((tile) => [tile.id, cachedPhoto(tile.place_id)]),
      ),
  );
  const [loading, setLoading] = useState(false);

  // Google n'est proposé qu'à qui n'a pas déjà sa photo libre.
  const linked = tiles.filter((tile) => tile.place_id && !tile.photo_url);
  const missing = linked.filter((tile) => !photos.has(tile.id));
  const canShow = hasGoogleMaps() && online && missing.length > 0;

  async function show(event) {
    event.stopPropagation();
    setLoading(true);
    const found = await Promise.all(
      missing.map(async (tile) => [tile.id, await photoOf(tile.place_id).catch(() => null)]),
    );
    setPhotos((current) => new Map([...current, ...found]));
    setLoading(false);
  }

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

        {/* On nomme l'ÉTOILE, parce que c'est le geste qui décide. Les trois
            places reviennent d'abord aux items mis en avant — c'est d'ailleurs
            le seul moyen d'y faire entrer un restaurant ou une boutique. Sans
            étoile, le bandeau se remplit tout seul avec les lieux puis les
            activités : le dire évite de croire qu'il faut étoiler pour avoir
            la moindre image. */}
        <p className="photo-strip__note">
          Les items mis en avant <span aria-hidden="true">★</span> prendront ces
          trois places — à défaut, les lieux et activités de l'étape.
        </p>
      </div>
    );
  }

  return (
    <div className="photo-strip__wrap">
      <ul className="photo-strip">
        {tiles.map((tile) => {
          // La photo libre enregistrée d'abord, la photo Google du geste ensuite.
          const photo = tile.photo_url
            ? {
                src: tile.photo_url,
                authors: [{ name: [tile.photo_credit, tile.photo_license].filter(Boolean).join(' · ') || 'Wikimedia Commons', uri: tile.photo_page }],
              }
            : photos.get(tile.id);
          return (
            <li key={tile.id} className="photo-strip__tile">
              {photo ? (
                <div className="photo-strip__photo">
                  <img className="photo-strip__img" src={photo.src} alt={tile.title} loading="lazy" />
                  {/* L'auteur est une condition de Google : il reste lisible et
                      cliquable sur la photo elle-même. */}
                  {photo.authors.length > 0 && (
                    <span className="photo-strip__credit">
                      {photo.authors.map((author, index) => (
                        <a
                          key={author.uri ?? index}
                          href={author.uri}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {author.name}
                        </a>
                      ))}
                    </span>
                  )}
                </div>
              ) : (
                <div className="photo-strip__slot">
                  <span className="photo-strip__slot-name">{tile.title}</span>
                  {/* Un lieu relié attend « Voir les photos » : lui proposer
                      aussi une recherche d'images ferait doublon. Le lien reste
                      pour un lieu non relié, ou sans photo chez Google. */}
                  {(!tile.place_id || tile.photo_url || photo === null) && (
                    <a
                      className="photo-strip__add"
                      href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${tile.title} ${stepName}`)}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      title={`Trouver une photo de ${tile.title}`}
                    >
                      Une photo ?
                    </a>
                  )}
                </div>
              )}
              <span className="photo-strip__caption">{tile.title}</span>
            </li>
          );
        })}
      </ul>

      {canShow && (
        <button type="button" className="photo-strip__show" onClick={show} disabled={loading}>
          {loading ? 'Chargement…' : 'Voir les photos'}
        </button>
      )}
    </div>
  );
}
