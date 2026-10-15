import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import DayPicker from './DayPicker.jsx';

// Le sélecteur ne propose que les moments possibles le jour choisi (0016).

const render = (day) =>
  renderToString(
    <DayPicker days={[day]} current={null} currentSlot={null} label="Placer le" onPick={() => {}} onCancel={() => {}} />,
  );

describe('DayPicker — les heures de la ville', () => {
  it('propose tous les moments un jour sans heure', () => {
    const html = render({ offset: 0, date: '2026-11-13' });
    expect(html).toContain('Journée entière');
    expect(html).toContain('Soir');
  });

  // On quitte la ville à 10 h : le matin seulement.
  it('ne propose que les moments avant le départ', () => {
    const html = render({ offset: 2, date: '2026-11-13', departure: true, until: '10:00:00' });
    expect(html).toContain('Matin');
    expect(html).not.toContain('Après-midi');
    expect(html).not.toContain('Journée entière');
  });

  it('ne propose que les moments après l’arrivée', () => {
    const html = render({ offset: 0, date: '2026-11-13', from: '15:40:00' });
    expect(html).not.toContain('Matin');
    expect(html).toContain('Après-midi');
  });
});
