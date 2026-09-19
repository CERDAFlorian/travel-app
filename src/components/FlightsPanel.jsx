import { formatPrice, formatStepDates } from '@/lib/dates.js';
import './FlightsPanel.scss';

const DIRECTION = { aller: 'Aller', retour: 'Retour' };

// Billets d'avion.
//
// En lecture : la saisie des vols n'existe pas encore côté données — aucune
// mutation, aucune policy éprouvée. Le design propose ici un formulaire
// d'ajout et une croix de suppression ; je ne les affiche pas plutôt que de
// poser des commandes inertes, pour la même raison qu'en L3 avec le bouton
// supprimer : un geste qui ne fait rien s'apprend quand même.
export default function FlightsPanel({ flights }) {
  if (flights.length === 0) return null;

  const totals = new Map();
  for (const flight of flights) {
    const price = Number(flight.price ?? 0);
    if (price) totals.set(flight.currency ?? 'EUR', (totals.get(flight.currency ?? 'EUR') ?? 0) + price);
  }

  const total =
    totals.size > 0
      ? [...totals].map(([currency, amount]) => formatPrice(amount, currency)).join(' + ')
      : 'à renseigner';

  return (
    <section className="flights">
      <div className="flights__card">
        <div className="flights__head">
          <h2 className="flights__title">Billets d'avion</h2>
          <span className="flights__hint">aller, retour et vols intérieurs</span>
          <span className="flights__total">
            Total vols <em>{total}</em>
          </span>
        </div>

        <div className="flights__grid">
          {flights.map((flight) => (
            <article key={flight.id} className="flight">
              <div className="flight__top">
                <span className="flight__label">{DIRECTION[flight.direction] ?? flight.direction}</span>
                <span className="flight__date">{formatStepDates(flight.date, flight.date)}</span>
              </div>

              <div className="flight__route">
                {flight.from_code} → {flight.to_code}
              </div>

              <div className="flight__bottom">
                <span className="flight__number">
                  {[flight.airline, flight.flight_no].filter(Boolean).join(' ') || 'vol à préciser'}
                </span>
                <span className="flight__rule" aria-hidden="true" />
                <span className="flight__price">
                  {formatPrice(flight.price, flight.currency ?? 'EUR') ?? 'prix à venir'}
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
