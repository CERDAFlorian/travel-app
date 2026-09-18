import { formatPrice } from '@/lib/dates.js';
import './ItemRow.scss';

// Lien « PLAN » vers Apple Plans. L'universal link ouvre l'app native sur
// iPhone et retombe sur la version web ailleurs, sans détection de plateforme.
// `q` est le libellé de l'épingle, `ll` sa position.
function mapUrl(item) {
  if (item.lat === null || item.lng === null) return null;
  return `https://maps.apple.com/?ll=${item.lat},${item.lng}&q=${encodeURIComponent(item.title)}`;
}

// Une ligne d'item.
//
// Lecture seule : l'étoile est un indicateur, pas un interrupteur, et il n'y a
// pas de bouton supprimer. Un bouton inerte apprendrait au doigt un geste qui
// deviendra destructeur en L4 — autant qu'il arrive avec l'action qu'il
// déclenche.
export default function ItemRow({ item }) {
  const href = mapUrl(item);
  const price = formatPrice(item.price, item.currency);

  return (
    <li className="item-row">
      <span className="item-row__dot" data-cat={item.category} aria-hidden="true" />

      <span className="item-row__body">
        <span className="item-row__title">
          {item.title}
          {item.favorite && (
            <span className="item-row__star" title="Favori">
              ★<span className="sr-only"> favori</span>
            </span>
          )}
        </span>
        {item.notes && <span className="item-row__notes">{item.notes}</span>}
      </span>

      {price && <span className="item-row__price">{price}</span>}

      {/* Pas de bouton désactivé quand les coordonnées manquent : un bouton
          grisé occupe la place et n'apprend rien. Le lien apparaît quand il
          mène quelque part — le géocodage des autres items, c'est L4. */}
      {href && (
        <a
          className="item-row__plan"
          href={href}
          target="_blank"
          rel="noreferrer"
        >
          Plan
        </a>
      )}
    </li>
  );
}
