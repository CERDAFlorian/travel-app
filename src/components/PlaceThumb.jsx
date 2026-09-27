import './PlaceThumb.scss';

// La vignette d'un lieu ou d'une ville : sa photo Wikimedia, si elle en a une.
//
// L'auteur et la licence sont une condition de la licence libre : ils sont au
// survol, et la vignette mène à la page du fichier sur Wikimedia Commons, où
// tout est détaillé. Sans photo, rien : pas d'emplacement vide qui décalerait
// la ligne.
export default function PlaceThumb({ place, size = 'sm' }) {
  if (!place?.photo_url) return null;
  const credit = [place.photo_credit, place.photo_license].filter(Boolean).join(' · ');

  return (
    <a
      className="place-thumb"
      data-size={size}
      href={place.photo_page ?? place.photo_url}
      target="_blank"
      rel="noreferrer"
      title={`Photo${credit ? ` : ${credit}` : ''} — Wikimedia Commons`}
      onClick={(event) => event.stopPropagation()}
    >
      <img src={place.photo_url} alt="" loading="lazy" decoding="async" />
    </a>
  );
}
