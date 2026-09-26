import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import PhotoStrip from './PhotoStrip.jsx';

// Le bandeau sans Google : en CI et dans les tests, la clé est vide
// (vite.config.js). Il ne doit rien proposer qu'il ne peut pas tenir.
describe('PhotoStrip sans clé Google', () => {
  const items = [
    { id: 'a', title: 'Fushimi Inari', category: 'lieu', place_id: 'ChIJ-fushimi' },
    { id: 'b', title: 'Temple inconnu', category: 'lieu', place_id: null },
  ];
  const html = renderToString(<PhotoStrip items={items} stepName="Kyoto" />);

  it('ne propose pas « Voir les photos »', () => {
    expect(html).not.toContain('Voir les photos');
  });

  it('garde une tuile par lieu mis en avant', () => {
    expect(html).toContain('Fushimi Inari');
    expect(html).toContain('Temple inconnu');
  });

  // Relié, un lieu attend ses photos Google : la recherche d'images n'est
  // proposée qu'à celui qui n'en aura pas.
  it('ne propose la recherche d’images qu’au lieu non relié', () => {
    expect(html.match(/Une photo \?/g)).toHaveLength(1);
  });

  // La recherche d'images ne suppose plus que le voyage est au Japon.
  it('ne met plus « Japon » en dur dans la recherche d’images', () => {
    expect(html).not.toContain('Japon');
  });
});
