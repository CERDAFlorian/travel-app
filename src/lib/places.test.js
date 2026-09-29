import { describe, expect, it } from 'vitest';
import { BIAS_RADIUS_M, mapsUrl, placeToSave, suggestionRequest, toSuggestion } from './places.js';

describe('suggestionRequest', () => {
  it('porte le jeton de session et la langue', () => {
    const session = { token: 't' };
    expect(suggestionRequest('Kenrokuen', { session })).toEqual({ input: 'Kenrokuen', sessionToken: session, language: 'fr' });
  });

  // Le biais oriente sans filtrer : un lieu plus loin reste proposable.
  it('biaise autour de l’étape et mesure la distance depuis elle', () => {
    const request = suggestionRequest('Kenrokuen', { bias: { lat: '36.56', lng: '136.65' } });
    expect(request.locationBias).toEqual({ center: { lat: 36.56, lng: 136.65 }, radius: BIAS_RADIUS_M });
    expect(request.origin).toEqual({ lat: 36.56, lng: 136.65 });
  });

  // Le filtre « villes » écartait Miyajima, Kōyasan, Kamikōchi : une étape
  // n'est pas toujours une ville au sens de Google.
  it('ne filtre jamais par type', () => {
    expect(suggestionRequest('Miyajima', { bias: { lat: 34.39, lng: 132.45 } })).not.toHaveProperty('includedPrimaryTypes');
  });
});

describe('toSuggestion', () => {
  it('garde le nom, le complément et la distance en km', () => {
    const prediction = { placeId: 'p', mainText: { text: 'Kenroku-en' }, secondaryText: { text: 'Kanazawa, Ishikawa' }, distanceMeters: 1500 };
    expect(toSuggestion(prediction)).toMatchObject({ placeId: 'p', main: 'Kenroku-en', secondary: 'Kanazawa, Ishikawa', km: 1.5 });
  });

  it('se passe de complément et de distance', () => {
    expect(toSuggestion({ placeId: 'p', text: { text: 'Kyoto' } })).toMatchObject({ main: 'Kyoto', secondary: '', km: null });
  });
});

describe('mapsUrl', () => {
  // Relié à Google : la fiche exacte du lieu, pas une recherche approximative.
  it('ouvre la fiche Google du lieu relié', () => {
    const url = new URL(mapsUrl({ title: 'Jardin Kenrokuen', place_id: 'ChIJ123', lat: 36.5, lng: 136.6 }));
    expect(url.origin + url.pathname).toBe('https://www.google.com/maps/search/');
    expect(url.searchParams.get('query_place_id')).toBe('ChIJ123');
    expect(url.searchParams.get('query')).toBe('Jardin Kenrokuen');
  });

  it('ouvre les coordonnées d’un lieu non relié', () => {
    expect(mapsUrl({ title: 'x', place_id: null, lat: '35.03', lng: '135.72' })).toBe(
      'https://www.google.com/maps/search/?api=1&query=35.03,135.72',
    );
  });

  it('ne rend rien sans lieu ni coordonnées', () => {
    expect(mapsUrl({ title: 'x', place_id: null, lat: null, lng: null })).toBeNull();
  });
});

describe('placeToSave', () => {
  const chosen = { lat: 35.0394, lng: 135.7292, placeId: 'ChIJ-kinkaku', name: ' Kinkaku-ji ' };

  // Le nom Google s'impose à l'item (29 septembre 2026) : on le retrouve tel
  // quel dans Maps.
  it('donne le nom Google à un item', () => {
    expect(placeToSave(chosen, { adoptName: true })).toEqual({ lat: 35.0394, lng: 135.7292, placeId: 'ChIJ-kinkaku', title: 'Kinkaku-ji' });
  });

  it('laisse le nom d’une étape', () => {
    expect(placeToSave(chosen)).toEqual({ lat: 35.0394, lng: 135.7292, placeId: 'ChIJ-kinkaku' });
  });

  it('ne renomme rien pour des coordonnées collées à la main', () => {
    expect(placeToSave({ lat: 35, lng: 135, placeId: null }, { adoptName: true })).toEqual({ lat: 35, lng: 135, placeId: null });
  });
});
