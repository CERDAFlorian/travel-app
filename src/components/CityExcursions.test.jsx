import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import CityExcursions from './CityExcursions.jsx';

// La section Excursions d'une ville, dans la vue Villes (L11, F6).

const hiroshima = (items = []) => ({ id: 'hiroshima', name: 'Hiroshima', lat: 34.39, lng: 132.45, items });
const render = (step, readOnly = false) =>
  renderToString(<CityExcursions step={step} readOnly={readOnly} onChanged={async () => {}} />);

describe('CityExcursions', () => {
  it('propose d’ajouter une excursion', () => {
    expect(render(hiroshima())).toContain('+ excursion');
  });

  // Une ville sans excursion ne montre rien de plus en lecture.
  it('se tait en lecture sans excursion', () => {
    expect(render(hiroshima(), true)).toBe('');
  });

  it('montre Miyajima en petite carte dès qu’elle contient quelque chose', () => {
    const html = render(
      hiroshima([
        { id: 'miyajima', title: 'Miyajima', category: 'lieu', kind: 'excursion' },
        { id: 'otorii', title: 'Otorii', category: 'lieu', parent_id: 'miyajima' },
      ]),
    );

    expect(html).toContain('Excursions');
    expect(html).toContain('Miyajima');
    expect(html).toContain('data-card');
    expect(html).not.toContain('Logement');
  });
});
