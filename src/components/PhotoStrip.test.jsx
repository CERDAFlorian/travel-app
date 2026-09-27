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
  const html = renderToString(<PhotoStrip items={items} stepName="Kyoto" />);

  it('ne propose jamais de photo Google', () => {
    expect(html).not.toContain('Voir les photos');
    expect(html).not.toContain('googleapis');
  });

  it('garde une tuile par lieu mis en avant', () => {
    expect(html).toContain('Fushimi Inari');
    expect(html).toContain('Temple inconnu');
  });

  it('affiche la photo enregistrée, avec son auteur et sa licence', () => {
    expect(html).toContain('src="https://upload.wikimedia.org/k.jpg"');
    expect(html).toContain('Jaycangel · CC BY-SA 3.0');
  });

  // Sans photo, relié à Google ou non : la recherche d'images reste l'invite.
  it('propose la recherche d’images à chaque lieu sans photo', () => {
    expect(html.match(/Une photo \?/g)).toHaveLength(2);
  });

  // La recherche d'images ne suppose plus que le voyage est au Japon.
  it('ne met plus « Japon » en dur dans la recherche d’images', () => {
    expect(html).not.toContain('Japon');
  });
});
