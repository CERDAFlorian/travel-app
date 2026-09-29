import { describe, expect, it } from 'vitest';
import { decideItem, decideStep, namesMatch } from './placeMatch.js';

// Les cas viennent du vrai voyage rapatrié le 26 septembre 2026 et des
// réponses de Google au test F0.

describe('namesMatch', () => {
  it.each([
    ['JARDIN KENROKUEN', 'Kenroku-en'],
    ['Disney sea', 'Tokyo DisneySea'],
    ['Cimetière okunoin', 'Okuno-in Cemetery'],
    ['Fushimi anari', 'Fushimi Inari-taisha'],
    ['Universal studio', 'Universal Studios Japan'],
    ['DÔME DE GENBAKU', 'Dôme de Genbaku'],
    ['Onyado Yuinosho', 'Onyado Yui no Sho'],
    ['TEMPLE KONGOBU-JI', 'Kongōbu-ji'],
  ])('« %s » désigne « %s »', (title, google) => {
    expect(namesMatch(title, google)).toBe(true);
  });

  it.each([
    ['VUE SUR LA SKYTREE', 'SkyTree View Point'],
    ['ONSEN EN MONTAGNE', 'Honzawa Onsen Unjo no Yu'],
    ['OKONOMIYAKI', 'Nagataya'],
    ['Torii flottante', 'Itsukushima Shrine - Main Sanctuary & Hall of Worship'],
  ])('« %s » ne désigne pas « %s »', (title, google) => {
    expect(namesMatch(title, google)).toBe(false);
  });
});

describe('decideItem', () => {
  const kyoto = { lat: 35.011575, lng: 135.768144 };

  // Coordonnées Nominatim et Google au même endroit : même lieu, quel que
  // soit le nom.
  it('relie un lieu déjà placé au même endroit, même sous un autre nom', () => {
    const item = { title: 'Pavillon d’or', lat: 35.039518, lng: 135.728454 };
    expect(decideItem(item, kyoto, { name: 'Kinkaku-ji', lat: 35.0394, lng: 135.7292, types: ['buddhist_temple'] }).link).toBe(true);
  });

  it('relie un lieu non placé quand le nom concorde, près de l’étape', () => {
    const item = { title: 'Fushimi anari', lat: null, lng: null };
    expect(decideItem(item, kyoto, { name: 'Fushimi Inari-taisha', lat: 34.9677, lng: 135.7792, types: ['shinto_shrine'] }).link).toBe(true);
  });

  // L'étape Shirakawa du vrai voyage est géocodée dans le Fukushima : tout ce
  // qu'on y rattache tombe à plus de 300 km. On ne relie pas en aveugle.
  it('refuse un lieu à plus de 50 km de son étape', () => {
    const shirakawaFaux = { lat: 37.12634, lng: 140.210719 };
    const decision = decideItem({ title: 'JARDIN KENROKUEN', lat: null, lng: null }, shirakawaFaux, { name: 'Kenroku-en', lat: 36.5624, lng: 136.6623, types: ['park'] });
    expect(decision).toMatchObject({ link: false });
    expect(decision.reason).toMatch(/km de l'étape/);
  });

  it('refuse un nom qui ne concorde pas', () => {
    const hiroshima = { lat: 34.391724, lng: 132.451759 };
    const decision = decideItem({ title: 'OKONOMIYAKI', lat: 34.395459, lng: 132.462649 }, hiroshima, { name: 'Nagataya', lat: 34.3955, lng: 132.4531, types: ['restaurant'] });
    expect(decision.link).toBe(false);
  });

  it('refuse un lieu déjà placé qui bougerait de plus d’un kilomètre', () => {
    const item = { title: 'Arashiyama', lat: 35.009047, lng: 135.674496 };
    expect(decideItem(item, kyoto, { name: 'Arashiyama', lat: 35.03, lng: 135.67, types: ['sublocality'] }).link).toBe(false);
  });

  it('ne relie jamais un item à une ville', () => {
    const osaka = { lat: 34.6937, lng: 135.5014 };
    expect(decideItem({ title: 'Château d’osaka', lat: null, lng: null }, osaka, { name: 'Osaka', lat: 34.6937, lng: 135.5023, types: ['locality', 'political'] }).link).toBe(false);
  });

  it('ne relie pas quand Google ne trouve rien', () => {
    expect(decideItem({ title: 'Ryan-j' }, kyoto, null)).toEqual({ link: false, reason: 'Google ne trouve rien' });
  });
});

describe('decideStep', () => {
  it('relie une étape dont la position bouge peu', () => {
    const kyoto = { name: 'Kyoto', lat: 35.011575, lng: 135.768144 };
    expect(decideStep(kyoto, { name: 'Kyoto', lat: 35.0116, lng: 135.7681 }).link).toBe(true);
  });

  // Shirakawa-gō est à 310 km de la Shirakawa du Fukushima : c'est une
  // homonyme, à l'utilisateur de trancher.
  it('refuse une étape qui changerait de ville', () => {
    const shirakawa = { name: 'Shirakawa', lat: 37.12634, lng: 140.210719 };
    expect(decideStep(shirakawa, { name: 'Shirakawa-gō', lat: 36.2573, lng: 136.9068 }).link).toBe(false);
  });

  it('relie une étape pas encore située quand le nom concorde', () => {
    expect(decideStep({ name: 'Kamikochi', lat: null, lng: null }, { name: 'Kamikōchi', lat: 36.25, lng: 137.64 }).link).toBe(true);
  });
});
