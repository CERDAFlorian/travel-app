import { describe, expect, it } from 'vitest';
import { slotFits } from './slots.js';

describe('slotFits', () => {
  it('laisse tout ouvert sans heure', () => {
    for (const key of ['journee', 'matin', 'midi', 'apres-midi', 'soir']) expect(slotFits(key, {})).toBe(true);
  });

  // Partir de Tokyo à 10 h : il reste le matin, pas l'après-midi.
  it('ferme ce qui suit le départ', () => {
    const window = { until: '10:00:00' };
    expect(slotFits('matin', window)).toBe(true);
    expect(slotFits('midi', window)).toBe(false);
    expect(slotFits('apres-midi', window)).toBe(false);
    expect(slotFits('soir', window)).toBe(false);
  });

  // Arriver à Matsumoto à 15 h 40 : il reste l'après-midi et le soir.
  it('ferme ce qui précède l’arrivée', () => {
    const window = { from: '15:40:00' };
    expect(slotFits('matin', window)).toBe(false);
    expect(slotFits('midi', window)).toBe(false);
    expect(slotFits('apres-midi', window)).toBe(true);
    expect(slotFits('soir', window)).toBe(true);
  });

  // Partir à midi pile : le déjeuner n'a pas lieu ici.
  it('ferme un moment qui commence à l’heure du départ', () => {
    expect(slotFits('midi', { until: '12:00:00' })).toBe(false);
    expect(slotFits('matin', { until: '12:00:00' })).toBe(true);
  });

  it('refuse la journée entière un jour d’arrivée ou de départ', () => {
    expect(slotFits('journee', { until: '20:00:00' })).toBe(false);
    expect(slotFits('journee', { from: '08:00:00' })).toBe(false);
  });

  it('accepte les heures sans secondes', () => {
    expect(slotFits('soir', { until: '19:30' })).toBe(true);
  });
});
