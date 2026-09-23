import { describe, expect, it } from 'vitest';
import { buildBudget, sumInEuros } from './budget.js';
import { formatEuros } from './currency.js';

const plain = (value) => value?.replace(/[  ]/g, ' ');

const tripWith = ({ flights = [], steps = [], legs = [] }) => ({ flights, steps, legs });
const item = (category, price, currency = 'JPY') => ({ category, price, currency });

describe('buildBudget', () => {
  // Le budget est la seule page qui additionne des montants venus de deux
  // devises. C'est aussi celle où une erreur ne se voit pas.
  it('ramène euros et yens sur une même échelle', () => {
    const budget = buildBudget(
      tripWith({
        flights: [{ price: 890, currency: 'EUR' }],
        steps: [{ nights: 2, items: [item('hotel', 16500)] }],
      }),
    );

    // 16 500 ¥ = 100 € au taux fixe, plus 890 € de vol.
    expect(Math.round(budget.total)).toBe(990);
  });

  it('range chaque ligne dans sa catégorie', () => {
    const budget = buildBudget(
      tripWith({
        flights: [{ price: 890, currency: 'EUR' }],
        steps: [
          { nights: 1, items: [item('hotel', 16500), item('activite', 3300), item('lieu', 1650)] },
        ],
      }),
    );

    const byKey = Object.fromEntries(budget.rows.map((row) => [row.key, Math.round(row.amount)]));
    expect(byKey).toEqual({ vols: 890, trajets: 0, hotel: 100, activite: 20, lieu: 10 });
  });

  // Restaurants et shopping se décident sur place : les compter fausserait
  // une prévision. C'est le drapeau `budget` des catégories.
  it('laisse restaurants et shopping hors budget', () => {
    const budget = buildBudget(
      tripWith({ steps: [{ nights: 1, items: [item('restaurant', 99000), item('shopping', 99000)] }] }),
    );

    expect(budget.total).toBe(0);
    expect(budget.rows.map((row) => row.key)).toEqual(['vols', 'trajets', 'hotel', 'activite', 'lieu']);
  });

  // Un prix absent n'est pas zéro. Le total ne doit pas prétendre être complet
  // alors qu'il manque des lignes.
  it('compte les lignes sans prix et le dit', () => {
    // Un hôtel par étape : deux dans la même seraient des CANDIDATS, dont un
    // seul compte — le vide du second ne serait alors pas une ligne manquante
    // mais une ligne écartée. Voir le bloc « hôtels candidats » plus bas.
    const budget = buildBudget(
      tripWith({
        flights: [{ price: null, currency: 'EUR' }],
        steps: [
          { nights: 1, items: [item('hotel', null)] },
          { nights: 1, items: [item('hotel', 16500)] },
        ],
      }),
    );

    expect(budget.blanks).toBe(2);
    expect(budget.note).toMatch(/2 lignes encore sans prix/);
  });

  // On ne signale que ce qui manque : annoncer « le total est complet »
  // occupait une ligne pour dire que rien ne cloche.
  it('ne dit rien quand tout est renseigné', () => {
    const budget = buildBudget(
      tripWith({ steps: [{ nights: 1, items: [item('hotel', 16500)] }] }),
    );
    expect(budget.blanks).toBe(0);
    expect(budget.note).toBeNull();
  });

  // --- Hôtels candidats ----------------------------------------------------
  //
  // On compare trois adresses avant d'en réserver une. Les additionner faisait
  // monter le budget de deux séjours qu'on ne fera pas.

  it("ne compte que l'hôtel retenu quand plusieurs sont en lice", () => {
    const budget = buildBudget(
      tripWith({
        steps: [
          {
            nights: 2,
            items: [
              { ...item('hotel', 16500), id: 'a' },
              { ...item('hotel', 33000), id: 'b', favorite: true },
              { ...item('hotel', 49500), id: 'c' },
            ],
          },
        ],
      }),
    );

    // 33 000 ¥ = 200 €. Sans la règle, le total valait 600 €.
    expect(Math.round(budget.total)).toBe(200);
  });

  it('compte le premier saisi tant que rien n\'est retenu', () => {
    const budget = buildBudget(
      tripWith({
        steps: [
          {
            nights: 2,
            items: [
              { ...item('hotel', 16500), id: 'a' },
              { ...item('hotel', 99000), id: 'b' },
            ],
          },
        ],
      }),
    );
    expect(Math.round(budget.total)).toBe(100);
  });

  it('compte un hôtel seul sans exiger qu\'on le retienne', () => {
    const budget = buildBudget(
      tripWith({ steps: [{ nights: 2, items: [{ ...item('hotel', 16500), id: 'a' }] }] }),
    );
    expect(Math.round(budget.total)).toBe(100);
  });

  // --- Trajets -------------------------------------------------------------
  //
  // Le poste qui manquait : six Shinkansen pèsent plus lourd que toutes les
  // entrées de temples réunies, et le total annonçait un voyage moins cher
  // qu'il ne l'est.

  it('compte les trajets entre étapes', () => {
    const budget = buildBudget(
      tripWith({
        flights: [{ price: 890, currency: 'EUR' }],
        legs: [
          { price: 110, currency: 'EUR' },
          { price: 45, currency: 'EUR' },
        ],
      }),
    );

    const byKey = Object.fromEntries(budget.rows.map((row) => [row.key, Math.round(row.amount)]));
    expect(byKey.trajets).toBe(155);
    expect(Math.round(budget.total)).toBe(1045);
  });

  // Un trajet saisi en yens reste comparable : tout est ramené en euros avant
  // d'être additionné, comme les items.
  it('ramène un trajet en yens sur la même échelle', () => {
    const budget = buildBudget(tripWith({ legs: [{ price: 16500, currency: 'JPY' }] }));
    expect(Math.round(budget.total)).toBe(100);
  });

  // Un trajet sans prix n'est pas gratuit : il manque au total, et ça se dit.
  it('signale un trajet sans prix', () => {
    const budget = buildBudget(tripWith({ legs: [{ price: null, currency: 'EUR' }] }));

    expect(budget.blanks).toBe(1);
    expect(budget.note).toMatch(/1 ligne encore sans prix/);
  });

  // Un voyage lu depuis un cache écrit avant cette version n'a pas de `legs`.
  it('survit à un voyage sans liaisons', () => {
    const budget = buildBudget({ flights: [], steps: [] });
    expect(budget.rows.find((row) => row.key === 'trajets').amount).toBe(0);
  });

  // Les parts servent à la jauge : elles doivent faire 1, sinon la barre ne
  // remplit pas sa largeur.
  it('répartit des parts qui totalisent 1', () => {
    const budget = buildBudget(
      tripWith({
        flights: [{ price: 500, currency: 'EUR' }],
        steps: [{ nights: 1, items: [item('hotel', 82500)] }],
      }),
    );

    const sum = budget.rows.reduce((total, row) => total + row.share, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it('ne divise pas par zéro quand rien n’a de prix', () => {
    const budget = buildBudget(tripWith({ steps: [{ nights: 1, items: [item('hotel', null)] }] }));
    expect(budget.rows.every((row) => row.share === 0)).toBe(true);
  });

  it('additionne les nuits de toutes les étapes', () => {
    const budget = buildBudget(tripWith({ steps: [{ nights: 2, items: [] }, { nights: 5, items: [] }] }));
    expect(budget.nights).toBe(7);
  });

  // Le contrôle qui vaut pour le vrai voyage : 336 000 + 33 000 + 1 800 ¥.
  it('retrouve le total du seed', () => {
    const budget = buildBudget(
      tripWith({
        steps: [
          { nights: 19, items: [item('hotel', 336000), item('activite', 33000), item('lieu', 1800)] },
        ],
      }),
    );
    expect(plain(formatEuros(budget.total))).toBe('2 247 €');
  });
});

describe('sumInEuros', () => {
  it('convertit chaque ligne avant d’additionner', () => {
    expect(sumInEuros([item('hotel', 16500), { category: 'hotel', price: 50, currency: 'EUR' }])).toBeCloseTo(150, 6);
  });

  it('ignore les lignes sans prix', () => {
    expect(sumInEuros([item('hotel', null), item('hotel', 16500)])).toBeCloseTo(100, 6);
  });

  it('vaut zéro sur une liste vide', () => {
    expect(sumInEuros([])).toBe(0);
  });
});
