import { describe, expect, it } from 'vitest';
import { EUR_PER, formatEuros, priceInEuros, toEuros } from './currency.js';

const plain = (value) => value?.replace(/[  ]/g, ' ');

describe('toEuros', () => {
  it('laisse un montant déjà en euros', () => {
    expect(toEuros(890, 'EUR')).toBe(890);
  });

  it('convertit les yens au taux constant', () => {
    expect(toEuros(16500, 'JPY')).toBeCloseTo(100, 6);
  });

  // Un prix absent n'est pas zéro : un item gratuit et un item dont on ignore
  // le prix ne doivent pas se confondre dans un budget.
  it('distingue absent de zéro', () => {
    expect(toEuros(null)).toBeNull();
    expect(toEuros(undefined)).toBeNull();
    expect(toEuros(0, 'JPY')).toBe(0);
  });

  // Plutôt rien qu'un montant faux : une devise inconnue convertie au taux du
  // yen donnerait un chiffre crédible et erroné.
  it('refuse une devise inconnue', () => {
    expect(toEuros(100, 'USD')).toBeNull();
  });
});

describe('formatEuros', () => {
  it.each([
    [218, '218 €'],
    [0, '0 €'],
    [2247.6, '2 248 €'],
  ])('formate %s', (amount, expected) => {
    expect(plain(formatEuros(amount))).toBe(expected);
  });
});

describe('priceInEuros', () => {
  it('convertit et formate le total du seed', () => {
    // 370 800 ¥ : la somme des lignes budgétées du seed.
    expect(plain(priceInEuros(370800, 'JPY'))).toBe('2 247 €');
  });

  it('garde le taux documenté cohérent avec la constante', () => {
    expect(1 / EUR_PER.JPY).toBe(165);
  });
});
