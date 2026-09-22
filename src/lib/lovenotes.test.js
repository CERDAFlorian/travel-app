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
    // 72 caracteres, et pas un de plus : LoveNote.scss reserve DEUX lignes
    // sous les commandes pour que le mot doux n'y fasse pas sauter le
    // contenu. Un message plus long passerait sur une troisieme ligne et
    // deborderait de la place reservee — le saut reviendrait.
    for (const [kind, list] of Object.entries(WHISPERS)) {
      // Les mots des nuits s'affichent en petit sous le nom d'une ville, sur
      // UNE ligne reservee : ils ont leur propre plafond, plus bas.
      const max = kind === 'nights' ? 40 : 72;
      for (const whisper of list) expect(whisper.length, whisper).toBeLessThanOrEqual(max);
    }
  });

  describe('countdown', () => {
    const DEPART = '2026-11-07';

    it('compte les jours qui restent', () => {
      expect(countdown(DEPART, new Date(2026, 8, 22)).compte).toBe('Dans 46 jours');
    });

    it('evite « Dans 1 jours » et « Dans 0 jours »', () => {
      // Les deux dernieres tetes de phrase sont ecrites a la main : le gabarit
      // « Dans N jours » ne se decline ni au singulier ni au jour meme.
      expect(countdown(DEPART, new Date(2026, 10, 6)).compte).toBe('Demain');
      expect(countdown(DEPART, new Date(2026, 10, 7)).compte).toBe("Aujourd'hui");
    });

    it('change de phrase chaque matin', () => {
      // C'est tout l'interet : elle ouvre l'app et trouve autre chose qu'hier.
      const suite = [18, 19, 20, 21].map(
        (jour) => countdown(DEPART, new Date(2026, 9, jour)).ligne,
      );
      expect(new Set(suite).size).toBe(suite.length);
    });

    it('a sa propre phrase le jour du depart', () => {
      // Les autres se lisent comme la suite d'un decompte, et il n'y a plus
      // rien a decompter.
      const jourJ = countdown(DEPART, new Date(2026, 10, 7));
      expect(jourJ.ligne).toContain('Prends ma main');
    });

    it('reste la meme toute la journee', () => {
      const matin = countdown(DEPART, new Date(2026, 8, 22, 7, 30));
      const soir = countdown(DEPART, new Date(2026, 8, 22, 23, 45));
      expect(matin).toEqual(soir);
    });

    it('se tait une fois le voyage commence', () => {
      // Compter les jours n'a plus de sens quand on y est.
      expect(countdown(DEPART, new Date(2026, 10, 8))).toBeNull();
    });

    it('se tait sans date de depart', () => {
      expect(countdown(null)).toBeNull();
      expect(countdown('')).toBeNull();
      expect(countdown('pas-une-date')).toBeNull();
    });

    it('tient dans la largeur de l\'en-tete', () => {
      // La phrase s'affiche sous le decompte, en petit, avant les dates du
      // voyage : au-dela d'environ 80 signes elle passerait sur trois lignes
      // et repousserait les dates hors du bloc de titre.
      for (let jours = 0; jours <= 400; jours += 1) {
        const jour = new Date(2026, 10, 7);
        jour.setDate(jour.getDate() - jours);
        const { compte, ligne } = countdown(DEPART, jour);
        expect(compte.length, `J-${jours}`).toBeLessThanOrEqual(16);
        expect(ligne.length, `J-${jours}`).toBeLessThanOrEqual(80);
      }
    });
  });
});
