import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import PlaceThumb from './PlaceThumb.jsx';

const wikimedia = {
  id: 'a',
  title: 'Kenrokuen',
  category: 'lieu',
  photo_url: 'https://upload.wikimedia.org/a.jpg',
  photo_credit: '663highland',
  photo_license: 'CC BY 2.5',
  photo_page: 'https://commons.wikimedia.org/wiki/File:a.jpg',
  photo_source: 'wikimedia',
};
const sansPhoto = { id: 'b', title: 'Hôtel Mystays', category: 'hotel', photo_url: null };

describe('PlaceThumb', () => {
  // Crédits masqués pour le moment (SHOW_PHOTO_CREDITS) : le lien vers la page
  // Commons, qui porte l'auteur et la licence, reste.
  it('en lecture, mène à la page de la photo sans afficher le crédit', () => {
    const html = renderToString(<PlaceThumb place={wikimedia} />);
    expect(html).toContain('href="https://commons.wikimedia.org/wiki/File:a.jpg"');
    expect(html).not.toContain('663highland');
  });

  it('en lecture, sans photo, ne montre rien', () => {
    expect(renderToString(<PlaceThumb place={sansPhoto} />)).toBe('');
  });

  // Qui peut modifier le voyage voit où ajouter une photo.
  it('modifiable, sans photo, propose d’en ajouter une', () => {
    const html = renderToString(<PlaceThumb place={sansPhoto} onEdit={() => {}} />);
    expect(html).toContain('<button');
    expect(html).toContain('data-empty="true"');
    expect(html).toContain('Ajouter une photo');
  });

  it('modifiable, avec photo, propose de la changer', () => {
    const html = renderToString(<PlaceThumb place={wikimedia} onEdit={() => {}} />);
    expect(html).toContain('Changer la photo');
    expect(html).not.toContain('data-empty');
  });
});
