import './PlaceThumb.scss';

// La vignette d'un lieu ou d'une ville : sa photo — Wikimedia ou collée.
//
// En lecture, elle mène à la page de la photo (auteur et licence, condition de
// la licence libre, sont au survol) ; sans photo, rien.
//
// Avec `onEdit` (qui peut écrire le voyage), c'est un bouton : vide, un « + »
// en pointillés pour ajouter une photo ; pleine, pour la changer ou la retirer.
// L'emplacement vide garde aussi l'alignement de la liste.
export default function PlaceThumb({ place, size = 'sm', onEdit }) {
  const photo = place?.photo_url ?? null;
  const credit = [place?.photo_credit, place?.photo_license].filter(Boolean).join(' · ');

  if (onEdit) {
    const label = photo ? 'Changer la photo' : 'Ajouter une photo';
    return (
      <button
        type="button"
        className="place-thumb"
        data-size={size}
        data-empty={!photo || undefined}
        title={photo && credit ? `${label} — ${credit}` : label}
        onClick={(event) => {
          event.stopPropagation();
          onEdit();
        }}
      >
        {photo ? <img src={photo} alt="" loading="lazy" decoding="async" /> : <span aria-hidden="true">+</span>}
        <span className="sr-only">{label}</span>
      </button>
    );
  }

  if (!photo) return null;
  return (
    <a
      className="place-thumb"
      data-size={size}
      href={place.photo_page ?? photo}
      target="_blank"
      rel="noreferrer"
      title={place.photo_source === 'user' ? 'Photo ajoutée' : `Photo${credit ? ` : ${credit}` : ''} — Wikimedia Commons`}
      onClick={(event) => event.stopPropagation()}
    >
      <img src={photo} alt="" loading="lazy" decoding="async" />
    </a>
  );
}
