import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildQuery, geocode, parseCoordinates } from './geocode.js';

afterEach(() => {
  vi.unstubAllGlobals();
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

describe('buildQuery', () => {
  // Le pays vient de la donnée, jamais codé en dur : l'app est multi-voyages
  // et deviendra un créateur d'itinéraires.
  it('enchaîne item, étape et voyage', () => {
    expect(buildQuery('Kinkaku-ji', 'Kyoto', 'Japon')).toBe('Kinkaku-ji, Kyoto, Japon');
  });

  it('ignore les morceaux absents', () => {
    expect(buildQuery('Kinkaku-ji', null, 'Japon')).toBe('Kinkaku-ji, Japon');
  });
});

describe('cadence', () => {
  // La politique de Nominatim impose un appel par seconde. Dépasser fait
  // bannir l'IP — et c'est exactement le genre de règle qu'une refonte casse
  // sans que rien ne le signale avant le blocage.
  it('espace les appels concurrents d’au moins 1,1 s', async () => {
    const stamps = [];
    vi.stubGlobal('fetch', async () => {
      stamps.push(Date.now());
      return { ok: true, json: async () => [] };
    });

    await Promise.all([
      geocode('a', 'Kyoto', 'Japon'),
      geocode('b', 'Kyoto', 'Japon'),
      geocode('c', 'Kyoto', 'Japon'),
    ]);

    const gaps = stamps.slice(1).map((stamp, index) => stamp - stamps[index]);
    expect(gaps).toHaveLength(2);
    for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(1100);
  }, 10000);

  // Un appel qui échoue ne doit pas empoisonner la file : sans cette garantie,
  // une erreur réseau ponctuelle ferait échouer tous les géocodages suivants
  // de la session.
  it('laisse passer les appels suivants après un échec', async () => {
    let call = 0;
    vi.stubGlobal('fetch', async () => {
      call += 1;
      if (call === 1) throw new TypeError('Failed to fetch');
      return { ok: true, json: async () => [{ lat: '35.04', lon: '135.73', display_name: 'X', class: 'amenity', type: 'place_of_worship' }] };
    });

    await expect(geocode('a', 'Kyoto', 'Japon')).rejects.toThrow(/injoignable/);
    await expect(geocode('b', 'Kyoto', 'Japon')).resolves.toHaveLength(1);
  }, 10000);
});

describe('réponses', () => {
  it('convertit lat/lon en nombres et compose le type', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      json: async () => [
        { lat: '35.0395293', lon: '135.7295373', display_name: 'Kinkaku-ji, Kyoto', class: 'amenity', type: 'place_of_worship' },
      ],
    }));

    const [candidate] = await geocode('Kinkaku-ji', 'Kyoto', 'Japon');
    expect(candidate.lat).toBeCloseTo(35.0395, 4);
    expect(candidate.lng).toBeCloseTo(135.7295, 4);
    expect(candidate.kind).toBe('amenity · place_of_worship');
  }, 10000);

  it.each([
    [429, /trop de requêtes/],
    [500, /a répondu 500/],
  ])('signale un statut %i', async (status, pattern) => {
    vi.stubGlobal('fetch', async () => ({ ok: false, status }));
    await expect(geocode('a', 'Kyoto', 'Japon')).rejects.toThrow(pattern);
  }, 10000);
});
