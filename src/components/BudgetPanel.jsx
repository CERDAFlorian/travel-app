import { useState } from 'react';
import { BUDGET_HINT, buildBudget } from '@/lib/budget.js';
import { RATE_NOTE, formatEuros } from '@/lib/currency.js';
import './BudgetPanel.scss';

// Budget global.
//
// Le nombre de voyageurs n'est pas en base : la table `trips` ne le porte pas,
// et l'ajouter demanderait une migration pour une valeur qui ne sert qu'ici.
// Il vit donc dans l'état local, par défaut 2.
export default function BudgetPanel({ trip }) {
  const [travelers, setTravelers] = useState(2);
  const budget = buildBudget(trip);

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
          {budget.rows.map((row) => (
            <span
              key={row.key}
              className="budget__slice"
              data-cat={row.key}
              style={{ flexGrow: row.share }}
              title={`${row.label} · ${formatEuros(row.amount)}`}
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
              <span className="budget__amount">{formatEuros(row.amount)}</span>
            </div>
          ))}
        </div>

        <div className="budget__totals">
          <div>
            <div className="budget__caption">Total du voyage</div>
            <div className="budget__grand">{formatEuros(budget.total)}</div>
          </div>
          <div>
            <div className="budget__caption">Par voyageur</div>
            <div className="budget__sub">{formatEuros(budget.total / travelers)}</div>
          </div>
          <div>
            <div className="budget__caption">Par nuit</div>
            <div className="budget__sub">
              {budget.nights > 0 ? formatEuros(budget.total / budget.nights) : "—"}
            </div>
          </div>
          <p className="budget__note">
            {budget.note}
            {/* Le taux est affiché en clair : il est fixe, donc il vieillit. */}
            <span className="budget__rate">{RATE_NOTE}</span>
          </p>
        </div>
      </div>
    </section>
  );
}
