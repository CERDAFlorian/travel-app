import { describe, expect, it } from 'vitest';
import { photosToFind } from './placePhotos.js';

const trip = {
  steps: [
    {
      id: 'kyoto', name: 'Kyoto', lat: 35, lng: 135, photo_checked_at: null,
      items: [
        { id: 'kinkaku', title: 'Pavillon d’or', category: 'lieu', lat: 35.03, lng: 135.72, photo_checked_at: null },
        { id: 'ryokan', title: 'Ryokan', category: 'hotel', lat: 35.0, lng: 135.7, photo_checked_at: null },
        { id: 'matcha', title: 'Atelier matcha', category: 'activite', lat: 35.0, lng: 135.7, photo_checked_at: null },
        { id: 'fait', title: 'Déjà cherché', category: 'lieu', lat: 35.0, lng: 135.7, photo_checked_at: '2026-09-27T10:00:00Z' },
        { id: 'sans-lieu', title: 'Pas situé', category: 'lieu', lat: null, lng: null, photo_checked_at: null },
      ],
    },
    { id: 'vide', name: 'Nulle part', lat: null, lng: null, photo_checked_at: null, items: [] },
  ],
};

describe('photosToFind', () => {
  it('cherche la ville, les lieux touristiques et les hôtels situés, pas encore cherchés', () => {
    expect(photosToFind(trip).map((t) => t.id)).toEqual(['kyoto', 'kinkaku', 'ryokan']);
  });

  // Pour l'instant, pas les activités ni les restaurants (27 septembre 2026).
  it('laisse de côté les autres catégories', () => {
    expect(photosToFind(trip).some((t) => t.id === 'matcha')).toBe(false);
  });

  it('dit quel genre de photo chercher', () => {
    expect(Object.fromEntries(photosToFind(trip).map((t) => [t.id, t.photoKind]))).toEqual({ kyoto: 'city', kinkaku: 'place', ryokan: 'hotel' });
  });

  it('tolère un voyage absent', () => {
    expect(photosToFind(null)).toEqual([]);
  });
});
