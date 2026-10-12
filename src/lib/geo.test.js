import { describe, expect, it } from 'vitest';
import { haversine, formatDistance, parseCoordinates, MAX_DISTANCE_FROM_STEP_KM } from './geo.js';

describe('haversine', () => {
  // Le contrat de L4 annonçait ≈ 39 km pour ce couple. C'est faux : 39 km est
  // la distance Kyoto–Shin-Ōsaka PAR LE RAIL. Le vol d'oiseau vaut 42,87 km,
  // valeur confirmée par la loi sphérique des cosinus et l'approximation plane.
  // Ce test fige la bonne valeur pour qu'on ne « corrige » pas le code vers la
  // mauvaise un jour de doute.
  it('donne 42,87 km entre Kyoto et Osaka, pas les 39 km du rail', () => {
    const km = haversine({ lat: 35.0116, lng: 135.7681 }, { lat: 34.6937, lng: 135.5023 });
    expect(km).toBeCloseTo(42.87, 1);
  });

  // Étalon indépendant du Japon : Notre-Dame → St Paul, 343,5 km de référence.
  it('tombe sur la référence Paris → Londres', () => {
    const km = haversine({ lat: 48.853, lng: 2.3499 }, { lat: 51.5138, lng: -0.0984 });
    expect(km).toBeCloseTo(343.5, 0);
  });

  it('vaut zéro entre un point et lui-même', () => {
    expect(haversine({ lat: 35, lng: 135 }, { lat: 35, lng: 135 })).toBe(0);
  });

  it('est symétrique', () => {
    const a = { lat: 35.0116, lng: 135.7681 };
    const b = { lat: 34.6937, lng: 135.5023 };
    expect(haversine(a, b)).toBeCloseTo(haversine(b, a), 10);
  });

  // Un item non géocodé a lat/lng à NULL : la fonction doit rendre null, pas
  // NaN. Un NaN se propagerait silencieusement jusqu'à une comparaison de
  // seuil qui vaut toujours false — l'avertissement des 50 km ne sortirait
  // jamais.
  it.each([
    ['les deux points absents', null, null],
    ['le second absent', { lat: 35, lng: 135 }, null],
    ['une latitude nulle', { lat: null, lng: 135 }, { lat: 35, lng: 135 }],
  ])('rend null quand %s', (_label, a, b) => {
    expect(haversine(a, b)).toBeNull();
  });
});

describe('formatDistance', () => {
  // Une décimale sous 10 km, aucune au-delà : « 43 km » suffit à décider d'y
  // aller, « 42,9 km » donne une précision que la marche ne respecte pas.
  it.each([
    [0.42, '420 m'],
    [4.9, '4.9 km'],
    [42.87, '43 km'],
    [125.4, '125 km'],
  ])('formate %s km en %s', (km, expected) => {
    expect(formatDistance(km)).toBe(expected);
  });
});

it('garde le seuil de cohérence à 50 km', () => {
  expect(MAX_DISTANCE_FROM_STEP_KM).toBe(50);
});

describe('parseCoordinates', () => {
  // Le format qu'on obtient d'un clic droit sur Google Maps, et ses variantes
  // plausibles au clavier. La virgule décimale compte : un clavier français la
  // produit naturellement, et « 35,0394, 135,7292 » est ambigu à l'œil mais
  // doit passer.
  it.each([
    ['35.0394, 135.7292', 35.0394, 135.7292],
    ['35.0394,135.7292', 35.0394, 135.7292],
    ['35.0394 135.7292', 35.0394, 135.7292],
    ['35,0394, 135,7292', 35.0394, 135.7292],
    ['  34.21 135.58  ', 34.21, 135.58],
    ['-33.8688, 151.2093', -33.8688, 151.2093],
  ])('lit « %s »', (input, lat, lng) => {
    expect(parseCoordinates(input)).toEqual({ lat, lng });
  });

  it.each([
    ['un nom de lieu', 'Kinkaku-ji'],
    ['une latitude hors plage', '91.0, 10.0'],
    ['une longitude hors plage', '35.0, 181.0'],
    ['une chaîne vide', ''],
    ['un seul nombre', '35.0394'],
  ])('rejette %s', (_label, input) => {
    expect(parseCoordinates(input)).toBeNull();
  });
});
