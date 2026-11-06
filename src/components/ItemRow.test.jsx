import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import ItemRow from './ItemRow.jsx';

// Le prix d'un item est facultatif : sans prix, un « + prix » discret plutôt
// qu'un champ vide sur chaque ligne.

const kyoto = { id: 'kyoto', name: 'Kyoto', lat: 35.01, lng: 135.77, items: [] };
const item = (overrides = {}) => ({
  id: 'fushimi',
  category: 'lieu',
  title: 'Fushimi Inari',
  price: null,
  currency: 'EUR',
  lat: null,
  lng: null,
  ...overrides,
});

const render = (props) =>
  renderToString(<ul><ItemRow step={kyoto} onChanged={async () => {}} {...props} /></ul>);

describe('ItemRow — le prix facultatif', () => {
  it('propose « + prix » à un item sans prix', () => {
    const html = render({ item: item() });
    expect(html).toContain('+ prix');
    expect(html).not.toContain('class="item__price"');
  });

  it('montre le champ d’un item qui a un prix', () => {
    const html = render({ item: item({ price: 12 }) });
    expect(html).toContain('class="item__price"');
    expect(html).not.toContain('+ prix');
  });

  it('ne propose rien en lecture seule', () => {
    expect(render({ item: item(), readOnly: true })).not.toContain('+ prix');
  });
});

// Le lien d'un restaurant : la vidéo TikTok, le post Instagram où on l'a trouvé.
describe('ItemRow — le lien d’un restaurant', () => {
  const resto = (overrides = {}) => item({ id: 'kichi', category: 'restaurant', title: 'Kichi Kichi', ...overrides });

  it('propose « + lien » à un restaurant, pas aux autres lieux', () => {
    expect(render({ item: resto() })).toContain('+ lien');
    expect(render({ item: item() })).not.toContain('+ lien');
  });

  it('affiche le lien enregistré sous le nom du réseau', () => {
    const html = render({ item: resto({ url: 'https://www.instagram.com/reel/abc/' }), readOnly: true });
    expect(html).toContain('Instagram ↗');
    expect(html).toContain('href="https://www.instagram.com/reel/abc/"');
  });
});
