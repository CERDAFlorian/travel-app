import { describe, expect, it } from 'vitest';
import { forSharing } from './sharedView.js';

const trip = {
  id: 't',
  steps: [{ id: 's', items: [{ id: 'i', title: 'Ryokan', price: 320, currency: 'JPY' }] }],
  flights: [{ id: 'f', flight_no: 'AF276', price: 900, currency: 'EUR' }],
  legs: [{ id: 'l', mode: 'train', price: 80, currency: 'JPY' }],
  experiences: [{ id: 'e', title: 'Onsen', price: 40 }],
};

describe('forSharing — la vue partagée', () => {
  it('ne garde aucun prix', () => {
    const shared = forSharing(trip);
    const rows = [...shared.steps[0].items, ...shared.flights, ...shared.legs];
    for (const row of rows) {
      expect(row).not.toHaveProperty('price');
      expect(row).not.toHaveProperty('currency');
    }
  });

  it('garde tout le reste', () => {
    const shared = forSharing(trip);
    expect(shared.steps[0].items[0].title).toBe('Ryokan');
    expect(shared.flights[0].flight_no).toBe('AF276');
    expect(shared.legs[0].mode).toBe('train');
  });

  it('retire les expériences à vivre', () => {
    expect(forSharing(trip).experiences).toEqual([]);
  });

  it('ne touche pas au voyage reçu', () => {
    forSharing(trip);
    expect(trip.steps[0].items[0].price).toBe(320);
  });

  it('laisse passer un voyage absent', () => {
    expect(forSharing(null)).toBeNull();
  });
});
