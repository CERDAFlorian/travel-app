import { describe, expect, it } from 'vitest';
import { PROVERBS, WHISPERS, proverbFor, whisperFor } from './lovenotes.js';

describe('lovenotes', () => {
  it('rend le même proverbe pour une même graine', () => {
    // C'est la propriété qui compte : un proverbe qui change à chaque rendu
    // clignoterait à la moindre frappe au clavier.
    expect(proverbFor('voyage-42')).toBe(proverbFor('voyage-42'));
  });

  it('ne rend pas le même proverbe à tous les voyages', () => {
    const tirages = new Set(
      Array.from({ length: 40 }, (_, index) => proverbFor(`voyage-${index}`).ja),
    );
    expect(tirages.size).toBeGreaterThan(1);
  });

  it('rend toujours un proverbe complet, quelle que soit la graine', () => {
    for (const seed of ['', null, undefined, 0, 'Île-de-Ré', '日本']) {
      const proverb = proverbFor(seed);
      expect(proverb.ja).toBeTruthy();
      expect(proverb.romaji).toBeTruthy();
      expect(proverb.fr).toBeTruthy();
    }
  });

  it('tire un mot doux dans la bonne catégorie', () => {
    for (const kind of Object.keys(WHISPERS)) {
      expect(WHISPERS[kind]).toContain(whisperFor(kind, 'graine'));
    }
  });

  it('se tait plutôt que de lever sur une catégorie inconnue', () => {
    // Un mot doux qui manque ne doit jamais empêcher une ville de s'ajouter.
    expect(whisperFor('inexistant', 'x')).toBeNull();
    expect(whisperFor(undefined, 'x')).toBeNull();
  });

  it('garde des textes affichables', () => {
    for (const proverb of PROVERBS) {
      expect(proverb.fr.length).toBeLessThan(140);
    }
    for (const list of Object.values(WHISPERS)) {
      for (const whisper of list) expect(whisper.length).toBeLessThan(90);
    }
  });
});
