import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import PlaceThumb from './PlaceThumb.jsx';
import PhotoStrip from './PhotoStrip.jsx';

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
  it('en lecture, mène à la page de la photo et crédite l’auteur', () => {
    const html = renderToString(<PlaceThumb place={wikimedia} />);
    expect(html).toContain('href="https://commons.wikimedia.org/wiki/File:a.jpg"');
    expect(html).toContain('663highland · CC BY 2.5');
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

describe('PhotoStrip', () => {
  const items = [{ ...sansPhoto, category: 'lieu' }];

  it('propose d’ajouter une photo à une tuile vide', () => {
    expect(renderToString(<PhotoStrip items={items} stepName="Kanazawa" />)).toContain('Une photo ?');
  });

  // Coller une photo : lieux touristiques et activités seulement.
  it('ne propose rien pour un restaurant ou une boutique mis en avant', () => {
    for (const category of ['restaurant', 'shopping']) {
      const html = renderToString(<PhotoStrip items={[{ ...sansPhoto, category, favorite: true }]} stepName="Kanazawa" />);
      expect(html).toContain('Hôtel Mystays');
      expect(html).not.toContain('Une photo ?');
    }
  });

  // La vue partagée ne modifie rien.
  it('en lecture seule, garde le nom sans bouton', () => {
    const html = renderToString(<PhotoStrip items={items} stepName="Kanazawa" readOnly />);
    expect(html).toContain('Hôtel Mystays');
    expect(html).not.toContain('Une photo ?');
  });
});
