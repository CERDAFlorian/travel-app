import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import PlaceSearch from './PlaceSearch.jsx';

// La recherche sans Google : en CI, dans les tests, sur un poste sans
// .env.local. Elle ne doit ni planter ni tenter un appel — elle dit ce qui
// manque et garde le repli des coordonnées à la main, qui ne dépend de rien.
describe('PlaceSearch sans clé Google', () => {
  const html = renderToString(
    <PlaceSearch title="JARDIN KENROKUEN" stepName="Kanazawa" near={{ lat: 36.56, lng: 136.65 }} onSave={() => {}} onCancel={() => {}} />,
  );

  it('dit que la recherche Google n’est pas configurée', () => {
    expect(html).toContain('recherche Google n’est pas configurée');
  });

  it('garde le champ des coordonnées à la main', () => {
    expect(html).toContain('aria-label="Coordonnées à la main"');
  });

  it('n’affiche aucun champ de recherche', () => {
    expect(html).not.toContain('type="search"');
  });
});
