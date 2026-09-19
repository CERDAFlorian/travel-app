import { CATEGORIES } from '@/lib/categories.js';
import './TripStats.scss';

const GEOGRAPHIC = new Set(CATEGORIES.filter((c) => c.onMap).map((c) => c.key));

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

// Les trois chiffres du bandeau.
//
// Tous CALCULÉS depuis la donnée, aucun saisi. La création de voyage posera
// peut-être un jour un total de nuits de référence ; en attendant, la somme des
// `steps.nights` fait foi — elle concorde avec les nuits d'hôtel du seed.
//
// « Lieux » écarte les notes perso : « Récupérer le JR Pass » n'est pas un
// lieu, et le compter fausserait la seule mesure qui dise quelque chose sur
// l'étendue géographique du voyage. Le design les comptait, à tort.
export default function TripStats({ steps }) {
  const nights = steps.reduce((total, step) => total + (step.nights ?? 0), 0);
  const places = steps.reduce(
    (total, step) => total + step.items.filter((item) => GEOGRAPHIC.has(item.category)).length,
    0,
  );

  return (
    <ul className="trip-stats">
      <li className="trip-stats__chip">{plural(steps.length, 'étape', 'étapes')}</li>
      <li className="trip-stats__chip">{plural(nights, 'nuit', 'nuits')}</li>
      <li className="trip-stats__chip">{plural(places, 'lieu', 'lieux')}</li>
    </ul>
  );
}
