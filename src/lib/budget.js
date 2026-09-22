import { CATEGORIES } from '@/lib/categories.js';
import { toEuros } from '@/lib/currency.js';
import { chosenHotel } from '@/lib/lodging.js';

// Catégories qui entrent au budget. Reprise du drapeau `budget` du design :
// restaurants et shopping en sont exclus — ils se décident sur place et
// fausseraient une prévision.
const BUDGETED = CATEGORIES.filter((category) => category.budget);

// Tout est ramené en euros avant d'être additionné.
//
// Le design cumulait `flightsSum` (euros) et les totaux d'items (yens) en un
// seul nombre, ce qui donnait un chiffre sans unité. La conversion à taux fixe
// règle le problème sans introduire d'appel réseau — c'est ce que prévoyait le
// contrat de L6.
export function buildBudget(trip) {
  const rows = [];
  let total = 0;
  let blanks = 0;

  let flights = 0;
  for (const flight of trip.flights) {
    const euros = toEuros(flight.price, flight.currency ?? 'EUR');
    if (!euros) blanks += 1;
    else flights += euros;
  }
  total += flights;
  rows.push({ key: 'vols', label: 'Vols', count: trip.flights.length, amount: flights });

  for (const category of BUDGETED) {
    let amount = 0;
    let count = 0;

    for (const step of trip.steps) {
      // Les hôtels d'une étape sont des CANDIDATS tant qu'on n'a pas choisi :
      // seul le retenu compte. Les additionner tous triplait le poste logement
      // dès qu'on comparait trois adresses à Kyoto — le total montait sans
      // qu'aucune nuit ne s'ajoute.
      const counted =
        category.key === 'hotel'
          ? [chosenHotel(step)].filter(Boolean)
          : step.items.filter((item) => item.category === category.key);

      for (const item of counted) {
        count += 1;
        const euros = toEuros(item.price, item.currency ?? 'JPY');
        if (!euros) blanks += 1;
        else amount += euros;
      }
    }

    total += amount;
    rows.push({ key: category.key, label: category.label, count, amount });
  }

  const nights = trip.steps.reduce((sum, step) => sum + (step.nights ?? 0), 0);
  const weight = rows.reduce((sum, row) => sum + row.amount, 0);

  return {
    rows: rows.map((row) => ({ ...row, share: weight > 0 ? row.amount / weight : 0 })),
    total,
    nights,
    blanks,
    // Pas de note quand tout est renseigné : « le total est complet » occupait
    // une ligne pour dire que rien ne manque. On ne signale que ce qui manque.
    note: blanks
      ? `${blanks} ligne${blanks > 1 ? 's' : ''} encore sans prix — le total ne les compte pas.`
      : null,
  };
}

// Somme en euros d'une liste d'items — utilisée par l'en-tête d'accordéon.
export function sumInEuros(items) {
  return items.reduce((total, item) => total + (toEuros(item.price, item.currency ?? 'JPY') ?? 0), 0);
}
