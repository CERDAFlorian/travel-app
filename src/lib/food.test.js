import { describe, expect, it } from 'vitest';
import {
  currentStepId,
  daysFor,
  directionsUrl,
  foodByCity,
  googleSearchUrl,
  restaurantsAround,
  restaurantsOf,
} from './food.js';

// Kyoto, 4 nuits à partir du 11 novembre : jours du 11 au 15.
const item = (id, overrides = {}) => ({
  id,
  category: 'restaurant',
  title: id,
  position: 0,
  favorite: false,
  day_offset: null,
  day_position: 0,
  lat: null,
  lng: null,
  ...overrides,
});

const gion = { lat: 35.0037, lng: 135.7788 };
const kichi = item('Kichi Kichi', { position: 2, lat: 35.0105, lng: 135.7699 }); // ~1 km de Gion
const fushimi = { lat: 34.9671, lng: 135.7727 };

const kyoto = (items) => ({
  id: 'kyoto',
  name: 'Kyoto',
  nights: 4,
  date_start: '2026-11-11',
  date_end: '2026-11-15',
  items,
});
const tokyo = (items = []) => ({
  id: 'tokyo',
  name: 'Tokyo',
  nights: 4,
  date_start: '2026-11-07',
  date_end: '2026-11-11',
  items,
});

describe('restaurantsOf', () => {
  it('ne garde que les restaurants, coups de cœur d’abord', () => {
    const step = kyoto([
      item('Ramen', { position: 1 }),
      item('Temple', { category: 'lieu' }),
      item('Kaiseki', { position: 3, favorite: true }),
    ]);
    expect(restaurantsOf(step).map((r) => r.id)).toEqual(['Kaiseki', 'Ramen']);
  });
});

describe('daysFor', () => {
  it('donne le jour où il est posé', () => {
    const resto = item('Ramen', { day_offset: 1 });
    expect(daysFor(kyoto([resto]), resto)).toEqual({ on: ['2026-11-12'], near: [] });
  });

  it('donne les jours où l’on passe à côté', () => {
    const resto = item('Omen', { lat: gion.lat + 0.003, lng: gion.lng });
    const step = kyoto([
      resto,
      item('Gion', { category: 'lieu', day_offset: 2, ...gion }),
      item('Fushimi Inari', { category: 'lieu', day_offset: 3, ...fushimi }),
    ]);
    expect(daysFor(step, resto)).toEqual({ on: [], near: ['2026-11-13'] });
  });

  it('prend le jour de l’excursion qui le contient', () => {
    const resto = item('Momiji', { parent_id: 'nara' });
    const step = kyoto([resto, item('nara', { category: 'lieu', kind: 'excursion', day_offset: 2 })]);
    expect(daysFor(step, resto).on).toEqual(['2026-11-13']);
  });
});

describe('currentStepId', () => {
  const steps = [tokyo(), kyoto([])];

  it('trouve la ville du jour', () => {
    expect(currentStepId(steps, '2026-11-08')).toBe('tokyo');
  });

  // Le 11, on quitte Tokyo le matin et on dîne à Kyoto.
  it('donne la ville d’arrivée le jour du changement', () => {
    expect(currentStepId(steps, '2026-11-11')).toBe('kyoto');
  });

  it('garde la dernière ville le jour du vol retour', () => {
    expect(currentStepId(steps, '2026-11-15')).toBe('kyoto');
  });

  it('ne rend rien hors du voyage', () => {
    expect(currentStepId(steps, '2026-10-01')).toBeNull();
  });
});

describe('foodByCity', () => {
  it('met la ville du jour en tête et écarte les villes sans restaurant', () => {
    const steps = [tokyo([item('Sushi')]), { ...kyoto([kichi]) }, { id: 'nara', name: 'Nara', nights: 1, items: [] }];
    const cities = foodByCity(steps, '2026-11-12');
    expect(cities.map((c) => c.step.id)).toEqual(['kyoto', 'tokyo']);
    expect(cities[0].current).toBe(true);
  });
});

describe('restaurantsAround', () => {
  it('classe du plus proche au plus loin, sans ceux qui n’ont pas de position', () => {
    const near = item('Près', { ...gion });
    const far = item('Loin', { ...fushimi });
    const around = restaurantsAround([kyoto([far, item('Sans position'), near])], gion);
    expect(around.map((a) => a.restaurant.id)).toEqual(['Près', 'Loin']);
    expect(around[0].km).toBeCloseTo(0);
  });
});

describe('liens', () => {
  const step = kyoto([]);

  it('cherche le nom et la ville sur Google', () => {
    const url = new URL(googleSearchUrl(item('The Legendary Kichi Kichi'), step));
    expect(url.searchParams.get('q')).toBe('The Legendary Kichi Kichi Kyoto');
  });

  it('vise le lieu Google exact quand il est relié', () => {
    const url = new URL(directionsUrl(item('Kichi', { place_id: 'abc' }), step));
    expect(url.pathname).toBe('/maps/dir/');
    expect(url.searchParams.get('destination_place_id')).toBe('abc');
  });

  it('se rabat sur les coordonnées, puis sur le nom dans la ville', () => {
    expect(new URL(directionsUrl(kichi, step)).searchParams.get('destination')).toBe('35.0105,135.7699');
    expect(new URL(directionsUrl(item('Omen'), step)).searchParams.get('destination')).toBe('Omen Kyoto');
  });
});
