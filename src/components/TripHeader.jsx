import { CATEGORIES } from '@/lib/categories.js';
import { formatTripRange } from '@/lib/dates.js';
import { countdown } from '@/lib/lovenotes.js';
import './TripHeader.scss';

const GEOGRAPHIC = new Set(CATEGORIES.filter((c) => c.onMap).map((c) => c.key));

// « 1 lieu », pas « 1 lieux ». Un pluriel en dur se voit dès le premier
// singulier, et le premier singulier arrive toujours.
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

// En-tête du voyage — titre, chiffres.
//
// La frise n'est PAS ici : elle doit pouvoir rester collée en haut de l'écran
// pendant qu'on fait défiler les étapes, et `position: sticky` ne fonctionne
// pas dans un ancêtre en `overflow: hidden` — or l'en-tête en a besoin pour
// rogner le décor qui déborde. Elle vit donc juste en dessous, dans TripView.
//
// Le décor déborde volontairement du cadre : le momiji mord sur le bord gauche
// (-18px, -14px), le Fuji occupe le coin droit. Le bloc de titre réserve la
// place par ses marges internes, très asymétriques, pour ne jamais passer
// dessous.
export default function TripHeader({ trip, back }) {
  const steps = trip.steps;
  const nights = steps.reduce((total, step) => total + (step.nights ?? 0), 0);
  const places = steps.reduce(
    (total, step) => total + step.items.filter((item) => GEOGRAPHIC.has(item.category)).length,
    0,
  );

  return (
    <header className="trip-header">
      <img className="trip-header__momiji" src="/img/deco-momiji.webp" alt="" aria-hidden="true" />
      <img className="trip-header__fuji" src="/img/deco-fuji.webp" alt="" aria-hidden="true" />

      <div className="trip-header__bar">
        <h1 className="trip-header__title">{trip.title}</h1>

        <div className="trip-header__subtitle">
          {/* Le compte a rebours prend la place du sous-titre : c'est un
              voyage de noces, et c'est la premiere chose qu'on veut lire en
              ouvrant la page. Le sous-titre de la base reprend la main une
              fois le depart passe, quand compter n'a plus de sens. */}
          <div className="trip-header__tagline">
            {countdown(trip.startDate) ?? trip.subtitle}
          </div>
          <div className="trip-header__dates">{formatTripRange(trip.startDate, trip.endDate)}</div>
        </div>
      </div>

      {/* Le retour et les chiffres partagent une ligne, SOUS le titre et les
          dates : on lit d'abord où l'on va, ensuite de quoi c'est fait. Le
          lien flottait auparavant en position absolue, où il chevauchait le
          décor et volait de la place au titre sur un écran étroit. */}
      <div className="trip-header__summary">
        {back}

        <ul className="trip-header__chips">
          <li className="trip-header__chip">{plural(steps.length, 'étape', 'étapes')}</li>
          <li className="trip-header__chip">{plural(nights, 'nuit', 'nuits')}</li>
          {/* Les notes perso sont exclues : « Récupérer le JR Pass » n'est pas
              un lieu. Le design les comptait, à tort. */}
          <li className="trip-header__chip">{plural(places, 'lieu', 'lieux')}</li>
        </ul>
      </div>
    </header>
  );
}
