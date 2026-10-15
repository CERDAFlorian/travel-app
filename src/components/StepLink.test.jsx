import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import StepLink from './StepLink.jsx';
import { transportsByItem } from '@/lib/transport.js';

// La route entre deux villes, dans la vue Villes. Les trajets s'y lisent sans
// s'y modifier (L11 F3) ; les arrêts en chemin s'y saisissent (F5).

const tokyo = (items = []) => ({ id: 'tokyo', name: 'Tokyo', lat: 35.68, lng: 139.76, items });
const matsumoto = { id: 'matsumoto', name: 'Matsumoto', items: [] };

const stop = (id, overrides = {}) => ({
  id,
  category: 'lieu',
  title: id,
  kind: 'arret',
  parent_id: null,
  position: 1,
  lat: null,
  lng: null,
  ...overrides,
});

const render = ({ from = tokyo(), leg = null, legs = [], readOnly = false } = {}) =>
  renderToString(
    <StepLink
      from={from}
      to={matsumoto}
      leg={leg}
      transports={transportsByItem(legs)}
      readOnly={readOnly}
      onChanged={async () => {}}
    />,
  ).replaceAll('<!-- -->', '');

describe('StepLink — la route entre deux villes', () => {
  it('résume le trajet connu', () => {
    const html = render({ leg: { id: 'l', mode: 'train', dep: '09:00:00', arr: '20:10:00', duration_min: 670 } });
    expect(html).toContain('Train · 09:00 → 20:10 · 11 h 10');
  });

  it('montre la note du trajet', () => {
    expect(render({ leg: { id: 'l', mode: 'train', duration_min: 60, note: 'JR Pass' } })).toContain('JR Pass');
  });

  it('rappelle un trajet manquant', () => {
    expect(render()).toContain('trajet à préciser');
  });

  // Le trajet se règle dans le jour par jour : ici, seule la saisie des arrêts.
  it('ne propose rien d’autre que d’ajouter un arrêt', () => {
    const html = render({ leg: { id: 'l', mode: 'train', duration_min: 60 } });
    expect(html).toContain('+ arrêt');
    expect(html).not.toContain('Modifier ce trajet');
  });

  it('ne propose aucune commande en lecture', () => {
    expect(render({ readOnly: true })).not.toContain('<button');
  });
});

describe('StepLink — les arrêts en chemin (F5)', () => {
  // Hakushu, vide : l'arrêt EST la visite. Une ligne, pas une carte.
  it('montre un arrêt vide sur une ligne', () => {
    const html = render({ from: tokyo([stop('Hakushu')]) });

    expect(html).toContain('Hakushu');
    expect(html).not.toContain('data-card');
    expect(html).toContain('+ y ajouter quelque chose');
  });

  // Shirakawa-gō contient un temple : il s'ouvre en petite carte, avec les
  // catégories d'une ville… sauf le logement.
  it('ouvre en carte un arrêt qui contient quelque chose', () => {
    const html = render({
      from: tokyo([
        stop('Shirakawa-gō'),
        { id: 'temple', category: 'lieu', title: 'Myōzen-ji', parent_id: 'Shirakawa-gō', kind: null },
      ]),
    });

    expect(html).toContain('data-card');
    expect(html).toContain('Lieux touristiques');
    expect(html).not.toContain('Logement');
  });

  // Chaque point porte le trajet qui y mène : la voiture vers Hakushu avant
  // l'arrêt, le dernier tronçon après.
  it('lit la route dans l’ordre : tronçon, arrêt, tronçon', () => {
    const html = render({
      from: tokyo([stop('Hakushu')]),
      legs: [{ id: 'v1', item_id: 'Hakushu', direction: 'aller', mode: 'voiture', duration_min: 120 }],
      leg: { id: 'l', mode: 'voiture', duration_min: 90 },
    });

    const toStop = html.indexOf('Voiture · 2 h');
    const atStop = html.indexOf('Hakushu');
    const toCity = html.indexOf('Voiture · 1 h 30');

    expect(toStop).toBeGreaterThan(-1);
    expect(atStop).toBeGreaterThan(toStop);
    expect(toCity).toBeGreaterThan(atStop);
  });

  // Vers un arrêt comme vers une ville, un trajet manquant se voit.
  it('signale le trajet manquant vers un arrêt', () => {
    const html = render({ from: tokyo([stop('Hakushu')]), leg: { id: 'l', mode: 'voiture', duration_min: 90 } });
    expect(html.indexOf('trajet à préciser')).toBeLessThan(html.indexOf('Hakushu'));
  });

  it('range plusieurs arrêts dans l’ordre où on les rencontre', () => {
    const html = render({ from: tokyo([stop('Suwa', { position: 2 }), stop('Hakushu', { position: 1 })]) });
    expect(html.indexOf('Hakushu')).toBeLessThan(html.indexOf('Suwa'));
  });
});
