import { describe, expect, it } from 'vitest';
import { featured } from './photos.js';

const item = (title, category, favorite = false) => ({
  id: title,
  title,
  category,
  favorite,
});

describe('featured', () => {
  // Les notes perso n'ont pas d'existence géographique : elles ne peuvent pas
  // illustrer une étape, même étoilées.
  it('écarte les notes même favorites', () => {
    const items = [item('Récupérer le JR Pass', 'note', true), item('Temple', 'lieu')];
    expect(featured(items).map((i) => i.title)).toEqual(['Temple']);
  });

  it('place les favoris avant le reste', () => {
    const items = [
      item('Hôtel', 'hotel'),
      item('Lieu ordinaire', 'lieu'),
      item('Lieu étoilé', 'lieu', true),
    ];
    expect(featured(items)[0].title).toBe('Lieu étoilé');
  });

  // L'ordre de complétion vient du design : lieu, puis activité, puis hôtel.
  it('complète dans l’ordre lieu → activité → hôtel', () => {
    const items = [item('Un hôtel', 'hotel'), item('Une activité', 'activite'), item('Un lieu', 'lieu')];
    expect(featured(items).map((i) => i.title)).toEqual(['Un lieu', 'Une activité', 'Un hôtel']);
  });

  // Trois adresses en lice ne sont pas trois séjours : le bandeau ne montre
  // que celle qu'on a retenue, jamais un candidat écarté.
  it('ne prend que l’hôtel retenu parmi les candidats', () => {
    const items = [
      { ...item('Hôtel écarté', 'hotel'), id: 'a' },
      { ...item('Hôtel retenu', 'hotel', true), id: 'b' },
      { ...item('Hôtel écarté aussi', 'hotel'), id: 'c' },
    ];
    expect(featured(items).map((i) => i.title)).toEqual(['Hôtel retenu']);
  });

  // Sans étoile en base — le cas du seed — le retenu est le premier saisi.
  it('retombe sur le premier hôtel saisi', () => {
    const items = [
      { ...item('Premier', 'hotel'), id: 'a' },
      { ...item('Second', 'hotel'), id: 'b' },
    ];
    expect(featured(items).map((i) => i.title)).toEqual(['Premier']);
  });

  // Restaurants et shopping n'entrent dans le bandeau que par l'étoile : c'est
  // fidèle au design.
  it('n’inclut un restaurant que s’il est étoilé', () => {
    const plain = [item('Izakaya', 'restaurant'), item('Un lieu', 'lieu')];
    expect(featured(plain).map((i) => i.title)).toEqual(['Un lieu']);

    const starred = [item('Izakaya', 'restaurant', true), item('Un lieu', 'lieu')];
    expect(featured(starred).map((i) => i.title)).toEqual(['Izakaya', 'Un lieu']);
  });

  it('ne rend jamais plus de trois items', () => {
    const items = ['a', 'b', 'c', 'd', 'e'].map((t) => item(t, 'lieu', true));
    expect(featured(items)).toHaveLength(3);
  });
});
