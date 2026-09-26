import { describe, expect, it } from 'vitest';
import { hideExpired, isExpired, placesToRefresh } from './placeFreshness.js';

const NOW = new Date('2026-11-10T12:00:00Z').getTime();
const daysAgo = (n) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

const google = (id, age) => ({ id, place_id: `pid-${id}`, place_synced_at: daysAgo(age), lat: 35, lng: 135 });
const ours = (id) => ({ id, place_id: null, place_synced_at: null, lat: 35, lng: 135 });

describe('isExpired', () => {
  it('expire une coordonnée Google de plus de 30 jours', () => {
    expect(isExpired(google('a', 31), NOW)).toBe(true);
    expect(isExpired(google('a', 29), NOW)).toBe(false);
  });

  // Seed, saisie à la main, Nominatim : ces coordonnées sont à nous.
  it("n'expire jamais une coordonnée qui ne vient pas de Google", () => {
    expect(isExpired(ours('a'), NOW)).toBe(false);
  });
});

describe('hideExpired', () => {
  it('masque les coordonnées expirées, étapes et items', () => {
    const trip = { steps: [{ ...google('kyoto', 40), items: [google('kinkaku', 31), google('fushimi', 2), ours('manuel')] }] };
    const shown = hideExpired(trip, NOW);
    expect([shown.steps[0].lat, shown.steps[0].lng]).toEqual([null, null]);
    expect(shown.steps[0].items.map((item) => item.lat)).toEqual([null, 35, 35]);
    // Le place_id reste : c'est avec lui qu'on redemandera la position.
    expect(shown.steps[0].items[0].place_id).toBe('pid-kinkaku');
  });

  // Un nouvel objet à chaque rendu relancerait tous les effets qui en dépendent.
  it('rend le même voyage quand rien n’a expiré', () => {
    const trip = { steps: [{ ...google('kyoto', 3), items: [google('kinkaku', 3), ours('manuel')] }] };
    expect(hideExpired(trip, NOW)).toBe(trip);
  });

  it('tolère un voyage absent', () => {
    expect(hideExpired(null, NOW)).toBeNull();
  });
});

describe('placesToRefresh', () => {
  const trip = {
    steps: [
      { ...google('kyoto', 26), items: [google('vieux', 26), google('frais', 3), ours('manuel'), { ...google('purge', 0), lat: null, lng: null, place_synced_at: null }] },
    ],
  };

  it('redemande les lieux Google de plus de 25 jours, et ceux purgés', () => {
    expect(placesToRefresh(trip, NOW).map((p) => p.id)).toEqual(['kyoto', 'vieux', 'purge']);
  });

  it("ne redemande jamais un lieu qui n'est pas relié à Google", () => {
    expect(placesToRefresh(trip, NOW).some((p) => p.id === 'manuel')).toBe(false);
  });

  // Avant le départ, on rafraîchit tout pour tenir 30 jours sur place.
  it('rafraîchit presque tout en préparant le départ', () => {
    expect(placesToRefresh(trip, NOW, { olderThanDays: 1 }).map((p) => p.id)).toEqual(['kyoto', 'vieux', 'frais', 'purge']);
  });

  it('met les étapes avant les items', () => {
    expect(placesToRefresh(trip, NOW)[0]).toMatchObject({ kind: 'step', placeId: 'pid-kyoto' });
  });
});
