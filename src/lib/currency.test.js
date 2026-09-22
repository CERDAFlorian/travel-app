import { describe, expect, it } from 'vitest';
import { EUR_PER, eurosInput, formatEuros, fromEuros, priceInEuros, toEuros } from './currency.js';

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

describe('fromEuros', () => {
  it('reconvertit vers la devise d’origine', () => {
    expect(fromEuros(100, 'JPY')).toBeCloseTo(16500, 6);
  });

  it('laisse un montant déjà en euros', () => {
    expect(fromEuros(890, 'EUR')).toBe(890);
  });

  it('refuse une devise inconnue', () => {
    expect(fromEuros(100, 'USD')).toBeNull();
  });
});

describe('eurosInput', () => {
  // Le champ de saisie parle la même langue que l'affichage : on ne tape pas
  // des yens dans une interface qui montre des euros.
  it('convertit les yens en euros entiers', () => {
    expect(eurosInput(34000, 'JPY')).toBe('206');
  });

  it('rend une chaîne vide pour un prix absent', () => {
    expect(eurosInput(null, 'JPY')).toBe('');
    expect(eurosInput(undefined, 'EUR')).toBe('');
  });

  it('garde le zéro, qui est un prix', () => {
    expect(eurosInput(0, 'JPY')).toBe('0');
  });

  // L'aller-retour ne doit pas deriver : rouvrir un champ sans y toucher puis
  // le quitter ne doit rien reecrire en base.
  it('revient sur lui-même à l’euro près', () => {
    const stored = 34000;
    const shown = Number(eurosInput(stored, 'JPY'));
    expect(Math.round(toEuros(fromEuros(shown, 'JPY'), 'JPY'))).toBe(shown);
  });
});
