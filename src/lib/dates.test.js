import { describe, expect, it, vi } from 'vitest';
import { formatPeriod, formatSince, formatStepDates, formatTripRange } from './dates.js';

// fr-FR sépare les milliers par une espace fine insécable (U+202F) et colle
// l'unité avec une insécable (U+00A0). On normalise pour que les assertions
// restent lisibles — et pour ne pas casser si l'ICU change de variante.
const plain = (value) => value?.replace(/[  ]/g, ' ');

describe('formatPeriod', () => {
  it('ne répète pas le mois quand le voyage y tient', () => {
    expect(plain(formatPeriod('2026-11-07', '2026-11-26'))).toBe('7 → 26 novembre 2026');
  });

  it('donne les deux mois quand le voyage les déborde', () => {
    expect(plain(formatPeriod('2026-10-28', '2026-11-03'))).toBe(
      '28 octobre 2026 → 3 novembre 2026',
    );
  });

  it('accepte une date manquante', () => {
    expect(plain(formatPeriod('2026-11-07', null))).toBe('7 novembre 2026');
    expect(formatPeriod(null, null)).toBe('');
  });

  // Les colonnes date de Postgres arrivent en 'YYYY-MM-DD'. Passées à
  // `new Date(iso)` elles sont lues comme UTC minuit, et l'affichage local peut
  // reculer d'un jour à l'ouest de Greenwich. Ce test fige le découpage manuel.
  it('ne décale pas la date sous un fuseau négatif', () => {
    const tz = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';
    try {
      expect(plain(formatPeriod('2026-11-07', '2026-11-07'))).toContain('7 novembre');
    } finally {
      process.env.TZ = tz;
    }
  });
});

describe('formatStepDates', () => {
  it('abrège dans le mois', () => {
    expect(plain(formatStepDates('2026-11-07', '2026-11-09'))).toBe('7 – 9 nov.');
  });

  it('donne les deux mois à cheval', () => {
    expect(plain(formatStepDates('2026-10-30', '2026-11-02'))).toBe('30 oct. – 2 nov.');
  });
});

describe('formatSince', () => {
  it.each([
    [30 * 1000, "à l'instant"],
    [3 * 60 * 1000, 'il y a 3 min'],
    [2 * 3600 * 1000, 'il y a 2 h'],
    [26 * 3600 * 1000, 'hier'],
    [5 * 24 * 3600 * 1000, 'il y a 5 jours'],
  ])('rend « %s » en texte', (ago, expected) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-19T12:00:00Z'));
    try {
      expect(formatSince(Date.now() - ago)).toBe(expected);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rend null sans horodatage', () => {
    expect(formatSince(null)).toBeNull();
  });
});

describe('formatTripRange', () => {
  it("n'écrit l'année qu'une fois, à la fin", () => {
    expect(plain(formatTripRange('2026-11-07', '2026-11-26'))).toBe('Du 7 nov. au 26 nov. 2026');
  });

  it('retombe sur formatPeriod si une date manque', () => {
    expect(plain(formatTripRange(null, '2026-11-26'))).toBe(plain(formatPeriod(null, '2026-11-26')));
  });
});
