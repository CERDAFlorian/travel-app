import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MISSING, PHOTO_LIB, featured, imageFor, photoStripFor } from './photos.js';

const item = (title, category, favorite = false) => ({
  id: title,
  title,
  category,
  favorite,
});

describe('imageFor', () => {
  it('apparie sur un mot-clé du titre', () => {
    expect(imageFor('Temple Sensō-ji')).toBe('/img/asakusa.webp');
  });

  // La normalisation retire les accents et la ponctuation : « Pavillon d'or »
  // doit matcher la clé « pavillon d or ».
  it('ignore accents et apostrophes', () => {
    expect(imageFor("Pavillon d'or")).toBe('/img/kinkakuji.webp');
    expect(imageFor('Château de Matsumoto')).toBe('/img/matsumoto-chateau.webp');
  });

  it('rend null sans correspondance', () => {
    expect(imageFor('Distillerie Hakushu')).toBeNull();
  });

  // Une image déclarée absente doit se comporter comme une non-correspondance,
  // pas rendre un chemin qui donnerait une image cassée.
  it('rend null pour une image pas encore exportée', () => {
    expect(imageFor('Sumo à Ryōgoku')).toBeNull();
  });
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
  // fidèle au design, et ça explique que les photos dotonbori et okonomiyaki
  // ne s'affichent jamais avec le seed actuel.
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

describe('photoStripFor', () => {
  // Deux items d'une même étape peuvent matcher la même photo — « Château
  // d'Osaka » et un autre « château ». La seconde tuile tombe en repli plutôt
  // que de dupliquer l'image.
  it('ne répète pas une image dans un bandeau', () => {
    const items = [item('Château de Matsumoto', 'lieu', true), item('Chateau de Matsumoto bis', 'lieu', true)];
    const tiles = photoStripFor(items);
    expect(tiles[0].src).toBe('/img/matsumoto-chateau.webp');
    expect(tiles[1].src).toBeNull();
  });

  // Reproduit l'étape Kyoto du seed : les trois lieux étoilés remplissent le
  // bandeau. C'est l'une des deux étapes complètes sur sept.
  it('remplit le bandeau de Kyoto', () => {
    const kyoto = [
      item('Machiya à Gion', 'hotel'),
      item('Fushimi Inari', 'lieu', true),
      item("Pavillon d'or", 'lieu', true),
      item('Arashiyama & bambouseraie', 'lieu', true),
      item('Atelier matcha', 'activite'),
    ];
    expect(photoStripFor(kyoto).map((t) => t.src)).toEqual([
      '/img/fushimi.webp',
      '/img/kinkakuji.webp',
      '/img/arashiyama.webp',
    ]);
  });
});

// Garde-fou d'intégrité : le jour où les PNG manquants sont exportés, il faut
// retirer leur nom de MISSING. Sans ce test, on l'oublierait et les bandeaux
// resteraient en repli sans que personne ne comprenne pourquoi.
describe('intégrité de la bibliothèque', () => {
  const available = new Set(
    readdirSync('public/img')
      .filter((file) => file.endsWith('.webp'))
      .map((file) => file.replace(/\.webp$/, '')),
  );

  it.each(PHOTO_LIB.map(([, name]) => name))('« %s » existe ou est déclarée absente', (name) => {
    expect(available.has(name) || MISSING.has(name)).toBe(true);
  });

  it('ne déclare absente aucune image qui existe désormais', () => {
    const stale = [...MISSING].filter((name) => available.has(name));
    expect(stale).toEqual([]);
  });
});
