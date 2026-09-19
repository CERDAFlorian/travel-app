import { useState } from 'react';
import { BUDGET_HINT, buildBudget, divideTotals, formatTotals, gaugeShares } from '@/lib/budget.js';
import './BudgetPanel.scss';

// Budget global.
//
// Le nombre de voyageurs n'est pas en base : la table `trips` ne le porte pas,
// et l'ajouter demanderait une migration pour une valeur qui ne sert qu'ici.
// Il vit donc dans l'état local, par défaut 2.
export default function BudgetPanel({ trip }) {
  const [travelers, setTravelers] = useState(2);
  const budget = buildBudget(trip);
  const shares = gaugeShares(budget.rows);

  return (
    <section className="budget">
      <div className="budget__card">
        <div className="budget__head">
          <h2 className="budget__title">Budget global</h2>
          <span className="budget__hint">{BUDGET_HINT}</span>
          <label className="budget__travelers">
            Voyageurs
            <input
              type="number"
              min="1"
              max="12"
              value={travelers}
              onChange={(event) => setTravelers(Math.max(1, Number(event.target.value) || 1))}
            />
          </label>
        </div>

        {/* Jauge indicative : les parts comparent des montants bruts, sans
            conversion entre devises. C'est une proportion, pas une addition. */}
        <div className="budget__gauge">
          {shares.map((slice) => (
            <span
              key={slice.key}
              className="budget__slice"
              data-cat={slice.key}
              style={{ flexGrow: slice.share }}
            />
          ))}
        </div>

        <div className="budget__rows">
          {budget.rows.map((row) => (
            <div key={row.key} className="budget__row">
              <span className="budget__dot" data-cat={row.key} aria-hidden="true" />
              <span className="budget__label">{row.label}</span>
              <span className="budget__count">
                {row.count} ligne{row.count > 1 ? 's' : ''}
              </span>
              <span className="budget__rule" aria-hidden="true" />
              <span className="budget__amount">{formatTotals(row.sums)}</span>
            </div>
          ))}
        </div>

        <div className="budget__totals">
          <div>
            <div className="budget__caption">Total du voyage</div>
            <div className="budget__grand">{formatTotals(budget.totals)}</div>
          </div>
          <div>
            <div className="budget__caption">Par voyageur</div>
            <div className="budget__sub">{formatTotals(divideTotals(budget.totals, travelers))}</div>
          </div>
          <div>
            <div className="budget__caption">Par nuit</div>
            <div className="budget__sub">{formatTotals(divideTotals(budget.totals, budget.nights))}</div>
          </div>
          <p className="budget__note">{budget.note}</p>
        </div>
      </div>
    </section>
  );
}
