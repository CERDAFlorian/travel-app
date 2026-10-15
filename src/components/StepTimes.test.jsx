import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import StepTimes from './StepTimes.jsx';

const kyoto = (overrides = {}) => ({ id: 'kyoto', name: 'Kyoto', arrival_time: null, departure_time: null, ...overrides });
const render = (step, readOnly = false) =>
  renderToString(<StepTimes step={step} readOnly={readOnly} onChanged={async () => {}} />).replaceAll('<!-- -->', '');

describe('StepTimes', () => {
  // Repliées au repos : sans heure, un simple « + heures ».
  it('propose « + heures » sans heure', () => {
    const html = render(kyoto());
    expect(html).toContain('+ heures');
    expect(html).not.toContain('type="time"');
  });

  it('montre les heures connues en texte, modifiables', () => {
    const html = render(kyoto({ arrival_time: '15:40:00' }));
    expect(html).toContain('arrivée 15:40');
    expect(html).toContain('<button');
  });

  it('montre les heures connues en lecture', () => {
    const html = render(kyoto({ arrival_time: '15:40:00', departure_time: '10:00:00' }), true);
    expect(html).toContain('arrivée 15:40');
    expect(html).toContain('départ 10:00');
  });

  it('se tait en lecture sans heure', () => {
    expect(render(kyoto(), true)).toBe('');
  });
});
