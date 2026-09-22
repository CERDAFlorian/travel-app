import { describe, expect, it } from 'vitest';
import { chosenHotel, hotelsOf, isChosenHotel, otherHotels } from './lodging.js';

const hotel = (id, flags = {}) => ({ id, category: 'hotel', title: id, ...flags });
const stepWith = (...items) => ({ name: 'Kyoto', items });

describe('chosenHotel', () => {
  it('ne retient rien quand il n\'y a pas d\'hôtel', () => {
    expect(chosenHotel(stepWith({ id: 'a', category: 'lieu' }))).toBeNull();
  });

  // Le cas du seed : un hôtel par étape, aucun favori. Il doit compter au
  // budget sans qu'on ait à cliquer une étoile sur sept étapes.
  it('retient l\'hôtel unique même sans étoile', () => {
    expect(chosenHotel(stepWith(hotel('machiya'))).id).toBe('machiya');
  });

  it('retient le favori quand plusieurs sont en lice', () => {
    const step = stepWith(hotel('a'), hotel('b', { favorite: true }), hotel('c'));
    expect(chosenHotel(step).id).toBe('b');
  });

  // Il y a TOUJOURS un retenu : sans ce repli, une étape à trois candidats ne
  // compterait aucune nuit au budget et le bandeau ne saurait quoi montrer.
  // Les items arrivent triés par position, donc c'est bien le premier saisi.
  it('retient le premier saisi tant que rien n\'est choisi', () => {
    expect(chosenHotel(stepWith(hotel('a'), hotel('b'))).id).toBe('a');
  });

  // `booked` vaut retenu : sceller pose les deux, mais une donnée saisie
  // ailleurs pourrait n'avoir que booked.
  it('fait primer le réservé sur le favori', () => {
    const step = stepWith(hotel('a', { favorite: true }), hotel('b', { booked: true }));
    expect(chosenHotel(step).id).toBe('b');
  });
});

describe('hotelsOf', () => {
  it('ne garde que les hôtels', () => {
    const step = stepWith(hotel('a'), { id: 'x', category: 'restaurant' }, hotel('b'));
    expect(hotelsOf(step).map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('supporte une étape sans items', () => {
    expect(hotelsOf({ name: 'Nara' })).toEqual([]);
  });
});

describe('otherHotels', () => {
  // Ce que sceller un hôtel emporterait : tous les autres, retenu ou pas.
  it("rend les hôtels que le scellement supprimerait", () => {
    const step = stepWith(hotel('a'), hotel('b', { favorite: true }), hotel('c'));
    expect(otherHotels(step, step.items[1]).map((item) => item.id)).toEqual(['a', 'c']);
  });

  // Rien à supprimer en scellant un hôtel seul : le dialogue doit pouvoir le
  // dire autrement qu'avec une liste vide.
  it('ne rend rien quand l\'hôtel est seul', () => {
    const step = stepWith(hotel('a'));
    expect(otherHotels(step, step.items[0])).toEqual([]);
  });
});

describe('isChosenHotel', () => {
  it('reconnaît le retenu par défaut, sans étoile en base', () => {
    const step = stepWith(hotel('a'), hotel('b'));
    expect(isChosenHotel(step, step.items[0])).toBe(true);
    expect(isChosenHotel(step, step.items[1])).toBe(false);
  });

  it('suit le favori quand il y en a un', () => {
    const step = stepWith(hotel('a'), hotel('b', { favorite: true }));
    expect(isChosenHotel(step, step.items[0])).toBe(false);
    expect(isChosenHotel(step, step.items[1])).toBe(true);
  });

  // L'étoile d'un lieu garde son sens d'origine : elle ne passe jamais par là.
  it('ne dit jamais oui hors catégorie hotel', () => {
    const step = stepWith({ id: 'x', category: 'lieu', favorite: true });
    expect(isChosenHotel(step, step.items[0])).toBe(false);
  });
});
