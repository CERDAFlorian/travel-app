import { describe, expect, it } from 'vitest';
import { childrenOf, cityOnly, containerPlan, ownItems, stopsOf } from './containers.js';

// Tokyo, avec un item à elle, et deux arrêts sur la route de Matsumoto :
// Hakushu (vide — l'arrêt EST la visite) puis Suwa (un lac, un déjeuner).
const item = (id, overrides = {}) => ({
  id,
  category: 'lieu',
  title: id,
  position: 0,
  day_offset: null,
  day_slot: null,
  day_position: 0,
  kind: null,
  parent_id: null,
  ...overrides,
});

const tokyo = {
  id: 'tokyo',
  name: 'Tokyo',
  nights: 3,
  items: [
    item('asakusa', { day_offset: 1, day_slot: 'matin' }),
    item('suwa', { kind: 'arret', position: 2 }),
    item('hakushu', { kind: 'arret', position: 1, category: 'activite' }),
    item('lac', { parent_id: 'suwa', day_slot: 'apres-midi', day_position: 1 }),
    item('soba', { category: 'restaurant', parent_id: 'suwa', day_slot: 'midi', day_position: 1 }),
    item('sanctuaire', { parent_id: 'suwa' }),
    item('pense-bête', { category: 'note', parent_id: 'suwa' }),
  ],
};

const ids = (items) => items.map((i) => i.id);

describe('ownItems', () => {
  // Les arrêts et leur contenu vivent sur la route : ils sortent des
  // catégories de la ville.
  it('ne garde que les items de la ville', () => {
    expect(ids(ownItems(tokyo))).toEqual(['asakusa']);
  });

  it('rend une ville sans ses arrêts', () => {
    expect(ids(cityOnly(tokyo).items)).toEqual(['asakusa']);
    expect(cityOnly(tokyo).name).toBe('Tokyo');
  });
});

describe('stopsOf', () => {
  it('rend les arrêts dans l’ordre où on les rencontre', () => {
    expect(ids(stopsOf(tokyo))).toEqual(['hakushu', 'suwa']);
  });

  it('ne rend rien pour une ville sans arrêt', () => {
    expect(stopsOf({ items: [item('a')] })).toEqual([]);
  });
});

describe('childrenOf', () => {
  it('rend ce qu’un lieu contient', () => {
    expect(ids(childrenOf(tokyo, 'suwa'))).toEqual(['lac', 'soba', 'sanctuaire', 'pense-bête']);
  });
});

describe('containerPlan', () => {
  const suwa = tokyo.items.find((i) => i.id === 'suwa');

  // Le contenu se range par moments, comme une journée : le déjeuner avant le
  // lac de l'après-midi.
  it('range le contenu par moments', () => {
    expect(ids(containerPlan(tokyo, suwa).items)).toEqual(['soba', 'lac']);
  });

  // Un arrêt de deux heures ne mange pas la journée : pas de « Journée entière ».
  it('propose les quatre moments, sans journée entière', () => {
    expect(containerPlan(tokyo, suwa).groups.map((g) => g.key)).toEqual([
      'matin',
      'midi',
      'apres-midi',
      'soir',
      null,
    ]);
  });

  // Sans moment, un item planifiable attend dans la réserve du lieu ; une
  // note ne se planifie pas.
  it('met en réserve ce qui n’a pas de moment', () => {
    expect(ids(containerPlan(tokyo, suwa).reserve)).toEqual(['sanctuaire']);
  });

  // Un item posé en « journée » (le moment d'une ville) ne disparaît pas : il
  // reste à caler.
  it('garde à caler un moment que le lieu ne connaît pas', () => {
    const step = { items: [suwa, item('x', { parent_id: 'suwa', day_slot: 'journee' })] };
    expect(ids(containerPlan(step, suwa).groups.at(-1).items)).toEqual(['x']);
  });

  it('rend un plan vide pour un arrêt sans contenu', () => {
    const hakushu = tokyo.items.find((i) => i.id === 'hakushu');
    const plan = containerPlan(tokyo, hakushu);
    expect(plan.items).toEqual([]);
    expect(plan.reserve).toEqual([]);
    expect(plan.count).toBe(0);
  });
});
