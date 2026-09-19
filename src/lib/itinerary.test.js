import { describe, expect, it } from 'vitest';
import { addDays, chainDates, datesToUpdate, tripEndDate } from './itinerary.js';

// L'itinéraire du seed : 2, 1, 1, 4, 2, 3, 6 nuits à partir du 7 novembre.
const SEED = [
  { id: 'a', nights: 2, date_start: '2026-11-07', date_end: '2026-11-09' },
  { id: 'b', nights: 1, date_start: '2026-11-09', date_end: '2026-11-10' },
  { id: 'c', nights: 1, date_start: '2026-11-10', date_end: '2026-11-11' },
  { id: 'd', nights: 4, date_start: '2026-11-11', date_end: '2026-11-15' },
  { id: 'e', nights: 2, date_start: '2026-11-15', date_end: '2026-11-17' },
  { id: 'f', nights: 3, date_start: '2026-11-17', date_end: '2026-11-20' },
  { id: 'g', nights: 6, date_start: '2026-11-20', date_end: '2026-11-26' },
];

describe('addDays', () => {
  it('avance sans décaler sous un fuseau négatif', () => {
    const tz = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';
    try {
      expect(addDays('2026-11-07', 2)).toBe('2026-11-09');
    } finally {
      process.env.TZ = tz;
    }
  });

  it('franchit les fins de mois', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
  });

  it("franchit le changement d'année", () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });
});

describe('chainDates', () => {
  // Le seed est déjà cohérent : le recalcul doit le laisser intact. Si ce test
  // casse, c'est que le modèle de dates a changé sans que le seed suive.
  it('reproduit exactement les dates du seed', () => {
    const chained = chainDates('2026-11-07', SEED);
    for (const [index, step] of SEED.entries()) {
      expect(chained[index].date_start).toBe(step.date_start);
      expect(chained[index].date_end).toBe(step.date_end);
    }
  });

  it('enchaîne sans trou : chaque début est la fin du précédent', () => {
    const chained = chainDates('2026-11-07', SEED);
    for (let i = 1; i < chained.length; i++) {
      expect(chained[i].date_start).toBe(chained[i - 1].date_end);
    }
  });

  it('accepte une étape sans nuit', () => {
    const chained = chainDates('2026-11-07', [{ id: 'x', nights: 0 }, { id: 'y', nights: 2 }]);
    expect(chained[0]).toEqual({ id: 'x', date_start: '2026-11-07', date_end: '2026-11-07' });
    expect(chained[1].date_end).toBe('2026-11-09');
  });
});

describe('datesToUpdate', () => {
  it("n'écrit rien quand tout est déjà en place", () => {
    expect(datesToUpdate('2026-11-07', SEED)).toEqual([]);
  });

  // Une nuit ajoutée au milieu décale la suite, pas le début. Écrire les sept
  // étapes ferait sept requêtes là où quatre suffisent.
  it('ne déplace que les étapes situées après le changement', () => {
    const changed = SEED.map((s) => (s.id === 'd' ? { ...s, nights: 5 } : s));
    const updates = datesToUpdate('2026-11-07', changed);
    expect(updates.map((u) => u.id)).toEqual(['d', 'e', 'f', 'g']);
    expect(updates[0].date_end).toBe('2026-11-16');
  });

  // Le cas qui motivait tout : retirer une étape ne doit pas laisser de trou.
  it('recolle la chaîne après le retrait d’une étape', () => {
    const without = SEED.filter((s) => s.id !== 'e');
    const updates = datesToUpdate('2026-11-07', without);
    expect(updates.map((u) => u.id)).toEqual(['f', 'g']);
    expect(updates[0].date_start).toBe('2026-11-15');
  });
});

describe('tripEndDate', () => {
  it('suit la fin de la dernière étape', () => {
    expect(tripEndDate('2026-11-07', SEED)).toBe('2026-11-26');
  });

  it('retombe sur le départ quand il n’y a plus d’étape', () => {
    expect(tripEndDate('2026-11-07', [])).toBe('2026-11-07');
  });
});
