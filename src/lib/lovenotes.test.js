import { describe, expect, it } from 'vitest';
import { PROVERBS, WHISPERS, countdown, proverbFor, whisperFor } from './lovenotes.js';

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

  it('porte surtout des mots d\'amour', () => {
    // C'est le coeur de la fonctionnalite : les proverbes accompagnent, ils ne
    // remplacent pas. Si un jour les listes maigrissent, ce test le dira.
    const total = Object.values(WHISPERS).reduce((sum, list) => sum + list.length, 0);
    expect(total).toBeGreaterThan(PROVERBS.length * 2);
  });

  it('ne repete pas deux fois le meme mot dans une categorie', () => {
    for (const [kind, list] of Object.entries(WHISPERS)) {
      expect(new Set(list).size, kind).toBe(list.length);
    }
  });

  it('garde des textes affichables', () => {
    for (const proverb of PROVERBS) {
      expect(proverb.fr.length).toBeLessThan(140);
    }
    for (const list of Object.values(WHISPERS)) {
      for (const whisper of list) expect(whisper.length).toBeLessThan(90);
    }
  });

  describe('countdown', () => {
    const DEPART = '2026-11-07';

    it('compte les jours qui restent', () => {
      expect(countdown(DEPART, new Date(2026, 8, 22))).toContain('46 jours');
    });

    it('change de ton à mesure qu\'on approche', () => {
      const veille = countdown(DEPART, new Date(2026, 10, 6));
      const jourJ = countdown(DEPART, new Date(2026, 10, 7));
      expect(veille).toBe('Demain. Demain, on y est.');
      expect(jourJ).toContain("aujourd'hui");
    });

    it('se tait une fois le voyage commencé', () => {
      // Compter les jours n'a plus de sens quand on y est.
      expect(countdown(DEPART, new Date(2026, 10, 8))).toBeNull();
    });

    it('ne bascule pas selon l\'heure de la journée', () => {
      // Une date nue comparée à un instant ferait passer « 46 jours » à 45
      // selon qu'on ouvre l'app le matin ou le soir.
      const matin = countdown(DEPART, new Date(2026, 8, 22, 7, 30));
      const soir = countdown(DEPART, new Date(2026, 8, 22, 23, 45));
      expect(matin).toBe(soir);
    });

    it('se tait sans date de départ', () => {
      expect(countdown(null)).toBeNull();
      expect(countdown('')).toBeNull();
      expect(countdown('pas-une-date')).toBeNull();
    });
  });
});
