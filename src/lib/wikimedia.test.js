import { describe, expect, it } from 'vitest';
import { nameScore, photoFromImageInfo, pickEntity, queriesFor } from './wikimedia.js';

// Un élément Wikidata réduit à ce que lit la sélection.
const entity = ({ label, aliases = [], description = '', image = 'photo.jpg', at = null }) => ({
  labels: { fr: { value: label } },
  aliases: { en: aliases.map((value) => ({ value })) },
  descriptions: { en: { value: description } },
  claims: {
    ...(image ? { P18: [{ mainsnak: { datavalue: { value: image } } }] } : {}),
    ...(at ? { P625: [{ mainsnak: { datavalue: { value: { latitude: at[0], longitude: at[1] } } } }] } : {}),
  },
});

describe('queriesFor', () => {
  it('essaie le titre, puis ses morceaux, puis sans les mots génériques', () => {
    expect(queriesFor('Okonomiyaki à Okonomi-mura')).toEqual([
      'Okonomiyaki à Okonomi-mura',
      'Okonomi-mura',
      'Okonomiyaki',
      'okonomiyaki okonomi mura',
      'okonomi mura',
    ]);
    expect(queriesFor('JARDIN KENROKUEN')).toEqual(['JARDIN KENROKUEN', 'kenrokuen']);
  });

  // Un morceau fait seulement de mots génériques ne désigne aucun lieu.
  it('écarte un morceau qui ne nomme rien', () => {
    expect(queriesFor('Hôtel à Asakusa')).not.toContain('Hôtel');
  });
});

describe('nameScore', () => {
  it('préfère le nom identique au nom seulement concordant', () => {
    expect(nameScore("Château d'Osaka", entity({ label: "château d'Osaka" }))).toBe(2);
    expect(nameScore("Château d'Osaka", entity({ label: "chute du château d'Osaka" }))).toBe(1);
    expect(nameScore('Kenrokuen', entity({ label: 'Kenroku-en' }))).toBe(2);
    expect(nameScore('Kinkaku', entity({ label: 'Arashiyama' }))).toBe(0);
  });
});

describe('pickEntity', () => {
  const osaka = { lat: 34.6873, lng: 135.5259 };

  // Le cas du prototype : la bataille homonyme arrivait en tête.
  it('écarte un événement au profit du lieu', () => {
    const entities = {
      Q1: entity({ label: "chute du château d'Osaka", description: 'part of the Boshin War', at: [34.6873, 135.5259] }),
      Q2: entity({ label: "château d'Osaka", description: 'Japanese castle', at: [34.6873, 135.5259] }),
    };
    expect(pickEntity("Château d'Osaka", ['Q1', 'Q2'], entities, osaka)?.id).toBe('Q2');
  });

  it('écarte une gare homonyme', () => {
    const kyoto = { lat: 34.9677, lng: 135.7792 };
    const entities = {
      Q1: entity({ label: 'Fushimi-Inari', description: 'railway station in Kyoto', at: [34.9688, 135.7692] }),
      Q2: entity({ label: 'Fushimi Inari-taisha', description: 'Shinto shrine in Kyoto', at: [34.9671, 135.7727] }),
    };
    expect(pickEntity('Fushimi Inari', ['Q1', 'Q2'], entities, kyoto)?.id).toBe('Q2');
  });

  it('écarte ce qui est trop loin du lieu', () => {
    const entities = { Q1: entity({ label: "château d'Osaka", at: [35.0, 135.9] }) };
    expect(pickEntity("Château d'Osaka", ['Q1'], entities, osaka)).toBeNull();
  });

  it('écarte un élément sans photo', () => {
    const entities = { Q1: entity({ label: "château d'Osaka", image: null, at: [34.6873, 135.5259] }) };
    expect(pickEntity("Château d'Osaka", ['Q1'], entities, osaka)).toBeNull();
  });

  // Pour un hôtel, la photo de son quartier se lirait comme celle de l'hôtel.
  it('ne donne jamais à un hôtel la photo de son quartier', () => {
    const asakusa = { lat: 35.7148, lng: 139.7967 };
    const entities = { Q1: entity({ label: 'Asakusa', description: 'district of Taitō, Tokyo', at: [35.7148, 139.7967] }) };
    expect(pickEntity('Asakusa', ['Q1'], entities, asakusa, { kind: 'hotel' })).toBeNull();
    expect(pickEntity('Asakusa', ['Q1'], entities, asakusa, { kind: 'place' })?.id).toBe('Q1');
  });

  // Une ville se cherche plus large qu'un lieu.
  it('accepte une ville à 20 km, pas un lieu', () => {
    const entities = { Q1: entity({ label: 'Kyoto', description: 'city in Japan', at: [35.0116, 135.7681] }) };
    const vingtKm = { lat: 35.19, lng: 135.7681 };
    expect(pickEntity('Kyoto', ['Q1'], entities, vingtKm, { kind: 'city' })?.id).toBe('Q1');
    expect(pickEntity('Kyoto', ['Q1'], entities, vingtKm, { kind: 'place' })).toBeNull();
  });
});

describe('photoFromImageInfo', () => {
  it('garde la vignette, l’auteur sans balises, la licence et la page', () => {
    const info = {
      thumburl: 'https://upload.wikimedia.org/x/500px-a.jpg',
      descriptionurl: 'https://commons.wikimedia.org/wiki/File:a.jpg',
      extmetadata: { Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:663highland">663highland</a>' }, LicenseShortName: { value: 'CC BY 2.5' } },
    };
    expect(photoFromImageInfo(info)).toEqual({
      url: 'https://upload.wikimedia.org/x/500px-a.jpg',
      credit: '663highland',
      license: 'CC BY 2.5',
      page: 'https://commons.wikimedia.org/wiki/File:a.jpg',
    });
  });

  it('ne rend rien sans vignette', () => {
    expect(photoFromImageInfo({})).toBeNull();
  });
});
