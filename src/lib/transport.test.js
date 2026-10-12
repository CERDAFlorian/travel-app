import { describe, expect, it } from 'vitest';
import { TRANSPORT_MODES, durationBetween, formatClock, formatDuration, legSummary, modeLabel } from './transport.js';

describe('durationBetween', () => {
  it('compte les minutes entre deux horaires', () => {
    expect(durationBetween('09:12', '11:52')).toBe(160);
  });

  // Un bus de nuit arrive « avant » d'être parti si on lit les heures bêtement.
  it('traverse minuit sans repartir en arrière', () => {
    expect(durationBetween('23:10', '06:30')).toBe(440);
  });

  it('accepte les secondes que rend Postgres', () => {
    expect(durationBetween('09:12:00', '11:52:00')).toBe(160);
  });

  it('rend null si un horaire manque', () => {
    expect(durationBetween(null, '11:52')).toBeNull();
    expect(durationBetween('09:12', null)).toBeNull();
  });

  it('vaut zéro pour deux horaires identiques', () => {
    expect(durationBetween('09:12', '09:12')).toBe(0);
  });
});

describe('formatDuration', () => {
  it.each([
    [160, '2 h 40'],
    [45, '45 min'],
    [120, '2 h'],
    [0, '0 min'],
  ])('formate %i minutes en %s', (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });

  it('rend null sans durée', () => {
    expect(formatDuration(null)).toBeNull();
  });
});

describe('formatClock', () => {
  it('retire les secondes de Postgres', () => {
    expect(formatClock('09:12:00')).toBe('09:12');
  });

  it('rend null sans horaire', () => {
    expect(formatClock(null)).toBeNull();
  });
});

describe('TRANSPORT_MODES', () => {
  // La liste doit rester alignée sur le CHECK de legs.mode : une valeur
  // ajoutée ici sans migration serait refusée à l'insertion.
  it('correspond au CHECK du schéma', () => {
    expect(TRANSPORT_MODES.map((m) => m.value)).toEqual([
      'shinkansen',
      'train',
      'bus',
      'voiture',
      'ferry',
      'avion',
      'marche',
    ]);
  });

  it('retombe sur la valeur brute pour un mode inconnu', () => {
    expect(modeLabel('fusee')).toBe('fusee');
  });
});

describe('legSummary', () => {
  it('dit le mode, les horaires et la durée', () => {
    expect(
      legSummary({ mode: 'shinkansen', dep: '09:12:00', arr: '11:52:00', duration_min: 160 }),
    ).toBe('Shinkansen · 09:12 → 11:52 · 2 h 40');
  });

  // Beaucoup de trajets ne sont connus que par leur durée.
  it('se contente de la durée sans horaire', () => {
    expect(legSummary({ mode: 'bus', duration_min: 45 })).toBe('Bus · 45 min');
  });

  it('ajoute le prix quand il est connu', () => {
    const text = legSummary({ mode: 'train', duration_min: 60, price: 110, currency: 'EUR' });
    expect(text.startsWith('Train · 1 h · 110')).toBe(true);
    expect(text).toContain('€');
  });

  it('ne dit rien d’un trajet absent', () => {
    expect(legSummary(null)).toBeNull();
  });
});
