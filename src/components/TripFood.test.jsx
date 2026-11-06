import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import TripFood from './TripFood.jsx';

const resto = (id, overrides = {}) => ({
  id,
  category: 'restaurant',
  title: id,
  position: 0,
  favorite: false,
  day_offset: null,
  ...overrides,
});

const trip = {
  steps: [
    {
      id: 'tokyo',
      name: 'Tokyo',
      nights: 4,
      date_start: '2026-11-07',
      date_end: '2026-11-11',
      items: [resto('Ichiran'), { id: 'senso', category: 'lieu', title: 'Senso-ji' }],
    },
    {
      id: 'kyoto',
      name: 'Kyoto',
      nights: 4,
      date_start: '2026-11-11',
      date_end: '2026-11-15',
      items: [
        resto('Omen', { position: 1 }),
        resto('The Legendary Kichi Kichi', { position: 2, favorite: true, day_offset: 1, url: 'https://www.tiktok.com/@kyotofood/video/1' }),
      ],
    },
  ],
};

const render = (today) => renderToString(<TripFood trip={trip} today={today} />);

describe('TripFood', () => {
  it('range les restaurants par ville, coups de cœur d’abord', () => {
    const html = render('2026-10-01');
    expect(html.indexOf('Tokyo')).toBeLessThan(html.indexOf('Kyoto'));
    expect(html.indexOf('Kichi Kichi')).toBeLessThan(html.indexOf('Omen'));
    expect(html).not.toContain('Senso-ji');
    expect(html).toContain('Autour de moi');
  });

  it('met la ville du jour en tête, ouverte, et replie les autres', () => {
    const html = render('2026-11-12');
    expect(html.indexOf('Kyoto')).toBeLessThan(html.indexOf('Tokyo'));
    expect(html.match(/<details[^>]*open/g)).toHaveLength(1);
  });

  it('donne le jour prévu et les trois liens', () => {
    const html = render('2026-10-01');
    expect(html).toContain('Prévu jeu. 12 nov.');
    expect(html).toContain('TikTok ↗');
    expect(html).toContain('google.com/search');
    expect(html).toContain('google.com/maps/dir/');
  });

  it('invite à saisir quand il n’y a aucun restaurant', () => {
    expect(renderToString(<TripFood trip={{ steps: [] }} />)).toContain('Aucun restaurant');
  });
});
