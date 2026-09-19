// Tous les tarifs sont AFFICHÉS en euros.
//
// Le taux est une constante, assumée comme indicative : pas d'API de change.
// Une API imposerait un appel réseau, une gestion de panne et une question sur
// la fraîcheur de la valeur en cache — pour un budget prévisionnel dont les
// prix sont eux-mêmes des estimations, c'est hors de proportion.
//
// ⚠️ À REVOIR AVANT LE DÉPART. Un écart de 10 % sur le taux déplace le total
// de plus de 200 €.
export const EUR_PER = {
  EUR: 1,
  JPY: 1 / 165, // 1 € ≈ 165 ¥
};

export const RATE_NOTE = '1 € ≈ 165 ¥ · taux fixe, à revoir avant le départ';

// La donnée reste stockée dans sa devise d'origine : un hôtel se paie en yens,
// et réécrire la base en euros perdrait le montant qu'on présentera au
// comptoir. La conversion n'a lieu qu'à l'affichage.
export function toEuros(amount, currency = 'JPY') {
  if (amount === null || amount === undefined) return null;
  const rate = EUR_PER[currency];
  // Devise inconnue : mieux vaut ne rien afficher qu'un montant faux.
  if (rate === undefined) return null;
  return Number(amount) * rate;
}

const FORMAT = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  currencyDisplay: 'narrowSymbol',
  // Pas de centimes : les prix sont des estimations converties à taux fixe,
  // afficher « 218,42 € » donnerait une précision que le chiffre n'a pas.
  maximumFractionDigits: 0,
});

export function formatEuros(amount) {
  if (amount === null || amount === undefined) return null;
  try {
    return FORMAT.format(amount);
  } catch {
    return `${Math.round(amount)} €`;
  }
}

// Raccourci : convertit puis formate. C'est ce que les composants appellent.
export function priceInEuros(amount, currency = 'JPY') {
  return formatEuros(toEuros(amount, currency));
}
