import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import StepLink from './StepLink.jsx';

// La route entre deux villes, dans la vue Villes : en lecture seule depuis
// L11 F3. Le trajet se saisit dans le jour par jour.

const render = (leg) => renderToString(<StepLink leg={leg} />).replaceAll('<!-- -->', '');

describe('StepLink — la route entre deux villes', () => {
  it('résume le trajet connu', () => {
    const html = render({ mode: 'train', dep: '09:00:00', arr: '20:10:00', duration_min: 670 });
    expect(html).toContain('Train · 09:00 → 20:10 · 11 h 10');
  });

  it('montre la note du trajet', () => {
    expect(render({ mode: 'train', duration_min: 60, note: 'JR Pass' })).toContain('JR Pass');
  });

  it('rappelle un trajet manquant', () => {
    expect(render(null)).toContain('trajet à préciser');
  });

  // Un seul endroit où modifier : le jour par jour.
  it('ne propose aucune commande', () => {
    const html = render({ mode: 'train', duration_min: 60 });
    expect(html).not.toContain('<button');
  });
});
