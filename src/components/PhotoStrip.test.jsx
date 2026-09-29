import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import PhotoStrip from './PhotoStrip.jsx';

// Le bandeau n'affiche que des photos enregistrées — Wikimedia ou collées par
// l'utilisateur —, jamais de photo Google (27 septembre 2026).
describe('PhotoStrip', () => {
  const items = [
    { id: 'a', title: 'Fushimi Inari', category: 'lieu', place_id: 'ChIJ-fushimi' },
    { id: 'b', title: 'Temple inconnu', category: 'lieu', place_id: null },
    { id: 'c', title: 'Pavillon d’or', category: 'lieu', place_id: 'ChIJ-kinkaku', photo_url: 'https://upload.wikimedia.org/k.jpg', photo_credit: 'Jaycangel', photo_license: 'CC BY-SA 3.0', photo_page: 'https://commons.wikimedia.org/wiki/File:k.jpg' },
  ];
  const html = renderToString(<PhotoStrip items={items} />);

  it('ne propose jamais de photo Google', () => {
    expect(html).not.toContain('Voir les photos');
    expect(html).not.toContain('googleapis');
  });

  it('garde une tuile par lieu mis en avant', () => {
    expect(html).toContain('Fushimi Inari');
    expect(html).toContain('Temple inconnu');
  });

  // Crédits masqués pour le moment (SHOW_PHOTO_CREDITS) : l'image mène à sa
  // page Commons, qui porte l'auteur et la licence.
  it('affiche la photo enregistrée, reliée à sa page, sans crédit affiché', () => {
    expect(html).toContain('src="https://upload.wikimedia.org/k.jpg"');
    expect(html).toContain('href="https://commons.wikimedia.org/wiki/File:k.jpg"');
    expect(html).not.toContain('Jaycangel');
  });

  // Ajouter une photo se fait au « + » de la liste, plus dans le bandeau
  // (29 septembre 2026) : une tuile sans photo garde seulement son nom.
  it('ne propose pas d’ajouter une photo dans le bandeau', () => {
    expect(html).not.toContain('Une photo ?');
    expect(html).not.toContain('<button');
  });
});
