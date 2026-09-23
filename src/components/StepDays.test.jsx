import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import StepDays from './StepDays.jsx';

// L'onglet « Jour par jour » d'une ville, rendu pour de vrai.
//
// Ce qu'on éprouve ici n'est pas la mise en page mais une règle de contenu :
// un trajet inter-villes doit SE VOIR depuis la ville concernée. L'onglet ne
// montre qu'une ville à la fois ; sans ce rappel, le Shinkansen du matin
// n'apparaîtrait nulle part et on bâtirait une journée pleine par-dessus.

const kyoto = {
  id: 'kyoto',
  name: 'Kyoto',
  nights: 2,
  date_start: '2026-11-11',
  date_end: '2026-11-13',
  items: [
    {
      id: 'fushimi',
      category: 'lieu',
      title: 'Fushimi Inari',
      position: 1,
      day_offset: 0,
      day_slot: 'matin',
      day_position: 1,
      start_time: null,
      booked: false,
      lat: null,
      lng: null,
    },
  ],
};

const hiroshima = { id: 'hiroshima', name: 'Hiroshima', date_start: '2026-11-13' };
const tokyo = { id: 'tokyo', name: 'Tokyo' };

const shinkansen = {
  id: 'l1',
  from_step: 'kyoto',
  to_step: 'hiroshima',
  mode: 'shinkansen',
  duration_min: 105,
  dep: '09:12:00',
  arr: '10:57:00',
};

const render = (neighbours) =>
  renderToString(
    <StepDays step={kyoto} isLast={false} neighbours={neighbours} readOnly onChanged={async () => {}} />,
  );

describe('StepDays — les trajets de la ville', () => {
  it('annonce le départ vers la ville suivante', () => {
    const html = render({ previous: null, next: hiroshima, legIn: null, legOut: shinkansen });

    expect(html).toContain('Départ vers Hiroshima');
    expect(html).toContain('Shinkansen');
    // La durée en clair : c'est elle qui dit ce qu'il reste de la journée.
    expect(html).toContain('1 h 45');
  });

  // Le départ a lieu le LENDEMAIN du dernier jour : on dort ici la dernière
  // nuit et on part au matin. Le bandeau porte donc le 13, pas le 12.
  it('date le départ au jour du trajet, pas au dernier jour sur place', () => {
    const html = render({ previous: null, next: hiroshima, legIn: null, legOut: shinkansen });

    expect(html).toContain('ven. 13 nov.');
    expect(html).not.toContain('jeu. 12 nov.</span><span class="transfer');
  });

  it("annonce l'arrivée depuis la ville précédente", () => {
    const html = render({ previous: tokyo, next: null, legIn: null, legOut: null });
    expect(html).toContain('Arrivée de Tokyo');
  });

  // Un trajet sans horaire est un oubli en puissance : c'est exactement ce que
  // ce bandeau est là pour éviter, il doit donc le dire.
  it('signale un trajet dont l’horaire manque', () => {
    const html = render({ previous: null, next: hiroshima, legIn: null, legOut: null });

    expect(html).toContain('Départ vers Hiroshima');
    expect(html).toContain('horaire à renseigner');
  });

  // Une ville sans voisine — voyage d'une seule étape — n'annonce rien.
  it('ne montre aucun trajet sans voisine', () => {
    const html = render({ previous: null, next: null, legIn: null, legOut: null });
    expect(html).not.toContain('transfer');
  });

  it('se rend sans le bloc des voisines', () => {
    const html = renderToString(
      <StepDays step={kyoto} isLast readOnly onChanged={async () => {}} />,
    );
    expect(html).toContain('Fushimi Inari');
  });
});
