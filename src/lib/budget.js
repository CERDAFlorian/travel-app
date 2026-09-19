import { CATEGORIES } from '@/lib/categories.js';
import { formatPrice } from '@/lib/dates.js';

// Catégories qui entrent au budget. Reprise du drapeau `budget` du design :
// restaurants et shopping en sont exclus — ils se décident sur place et
// fausseraient une prévision.
const BUDGETED = new Set(['hotel', 'activite', 'lieu']);

export const BUDGET_HINT =
  'vols, hôtels, activités et visites — restaurants et shopping restent hors budget';

// Le design additionne `flightsSum + totaux items` en un seul nombre. C'est
// faux : un vol se paie en euros et un item en yens. Le total serait un chiffre
// sans unité que rien ne signalerait. On totalise donc PAR DEVISE.
// C'est la raison pour laquelle `currency` a été ajoutée sur `flights` en L1.
function addTo(totals, currency, amount) {
  totals.set(currency, (totals.get(currency) ?? 0) + amount);
}

export function buildBudget(trip) {
  const rows = [];
  const totals = new Map();
  let blanks = 0;

  const flightSums = new Map();
  for (const flight of trip.flights) {
    const price = Number(flight.price ?? 0);
    if (!price) blanks += 1;
    else {
      addTo(flightSums, flight.currency ?? 'EUR', price);
      addTo(totals, flight.currency ?? 'EUR', price);
    }
  }
  rows.push({
    key: 'vols',
    label: 'Vols',
    count: trip.flights.length,
    sums: flightSums,
  });

  for (const category of CATEGORIES) {
    if (!BUDGETED.has(category.key)) continue;

    const sums = new Map();
    let count = 0;

    for (const step of trip.steps) {
      for (const item of step.items) {
        if (item.category !== category.key) continue;
        count += 1;
        const price = Number(item.price ?? 0);
        if (!price) blanks += 1;
        else {
          addTo(sums, item.currency ?? 'JPY', price);
          addTo(totals, item.currency ?? 'JPY', price);
        }
      }
    }

    rows.push({ key: category.key, label: category.label, count, sums });
  }

  const nights = trip.steps.reduce((total, step) => total + (step.nights ?? 0), 0);

  return {
    rows,
    totals,
    blanks,
    nights,
    note: blanks
      ? `${blanks} ligne${blanks > 1 ? 's' : ''} encore sans prix — le total ne les compte pas.`
      : 'Toutes les lignes ont un prix : le total est complet.',
  };
}

// « 370 800 ¥ », ou « 370 800 ¥ + 890 € » quand deux devises cohabitent.
// Aucune conversion : il faudrait un taux, donc un appel réseau et une décision
// sur sa fraîcheur. Afficher les deux dit la vérité sans rien inventer.
export function formatTotals(sums) {
  if (sums.size === 0) return '—';
  return [...sums.entries()]
    .map(([currency, amount]) => formatPrice(amount, currency))
    .join(' + ');
}

export function divideTotals(sums, divisor) {
  if (divisor <= 0) return new Map();
  return new Map([...sums.entries()].map(([currency, amount]) => [currency, amount / divisor]));
}

// Largeur de chaque tranche dans la jauge. On compare en monnaie « nombre
// brut » faute de taux : c'est une proportion indicative, pas une conversion.
export function gaugeShares(rows) {
  const weights = rows.map((row) => [...row.sums.values()].reduce((a, b) => a + b, 0));
  const total = weights.reduce((a, b) => a + b, 0);
  return rows.map((row, index) => ({
    key: row.key,
    share: total > 0 ? weights[index] / total : 0,
  }));
}
