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

describe('DayPicker — le jour d’une excursion (F6)', () => {
  const miyajima = { id: 'miyajima', title: 'Miyajima', kind: 'excursion', day_slot: 'journee' };
  const day = {
    offset: 1,
    date: '2026-11-18',
    excursions: [{ item: miyajima, window: { from: '09:10', until: '17:40' } }],
  };
  const render = (props = {}) =>
    renderToString(
      <DayPicker days={[day]} current={null} currentSlot={null} cityName="Hiroshima" label="Placer le" onPick={() => {}} onCancel={() => {}} {...props} />,
    ).replaceAll('<!-- -->', '');

  it('propose la ville et l’excursion', () => {
    const html = render();
    expect(html).toContain('À Hiroshima');
    expect(html).toContain('◆ Miyajima');
  });

  // En ville, seulement avant ou après : le matin (avant 9 h 10), le soir.
  it('ne propose en ville que les moments hors de l’excursion', () => {
    const html = render();
    const city = html.slice(html.indexOf('À Hiroshima'), html.indexOf('◆ Miyajima'));
    expect(city).toContain('Matin');
    expect(city).toContain('Soir');
    expect(city).not.toContain('Midi');
  });

  it('s’en tient à la ville sur demande', () => {
    expect(render({ withExcursions: false })).not.toContain('Miyajima');
  });
});
