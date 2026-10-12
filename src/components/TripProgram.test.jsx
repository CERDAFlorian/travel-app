import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import TripProgram from './TripProgram.jsx';

// Le programme du voyage, rendu pour de vrai.
//
// Depuis L11 F1, c'est l'écran où l'on CONSTRUIT le programme, plus seulement
// celui où on le suit. On éprouve ici les règles de contenu : les dates à la
// place des rangs, la réserve de chaque ville au bon endroit, les commandes
// présentes en construction et absentes en lecture seule.

const item = (id, overrides = {}) => ({
  id,
  category: 'lieu',
  title: id,
  position: 0,
  day_offset: null,
  day_slot: null,
  day_position: 0,
  start_time: null,
  booked: false,
  lat: null,
  lng: null,
  ...overrides,
});

// Kyoto 11→13 (2 nuits), puis Osaka 13→15 (2 nuits), dernière étape.
const trip = (overrides = {}) => ({
  steps: [
    {
      id: 'kyoto',
      name: 'Kyoto',
      nights: 2,
      date_start: '2026-11-11',
      date_end: '2026-11-13',
      items: [
        item('Fushimi Inari', { day_offset: 0, day_slot: 'matin', day_position: 1 }),
        item('Arashiyama'),
      ],
    },
    {
      id: 'osaka',
      name: 'Osaka',
      nights: 2,
      date_start: '2026-11-13',
      date_end: '2026-11-15',
      items: [],
    },
  ],
  flights: [],
  legs: [
    {
      id: 'l1',
      from_step: 'kyoto',
      to_step: 'osaka',
      mode: 'shinkansen',
      duration_min: 15,
      dep: '09:12:00',
      arr: '09:27:00',
    },
  ],
  ...overrides,
});

// Les marqueurs `<!-- -->` que React glisse entre deux morceaux de texte sont
// retirés : « Kyoto → Osaka » se lit d'un bloc à l'écran, il doit se chercher
// d'un bloc ici.
const render = (props = {}) =>
  renderToString(
    <TripProgram trip={trip()} readOnly={false} onChanged={async () => {}} {...props} />,
  ).replaceAll('<!-- -->', '');

describe('TripProgram — les dates à la place des rangs', () => {
  it('titre chaque jour par sa date', () => {
    const html = render();

    expect(html).toContain('mer. 11 nov.');
    expect(html).toContain('jeu. 12 nov.');
  });

  it('n’affiche plus de J1, J2…', () => {
    expect(render()).not.toMatch(/>J\d+</);
    expect(render({ readOnly: true })).not.toMatch(/>J\d+</);
  });

  // Le jour du vol retour se signale : on n'y tient pas une journée de visites.
  it('signale le jour du départ', () => {
    expect(render()).toContain('départ');
  });
});

describe('TripProgram — construire le programme', () => {
  it('propose les commandes d’un item posé', () => {
    const html = render();

    expect(html).toContain('Fushimi Inari');
    expect(html).toContain('réserver');
    expect(html).toContain('Refaire');
  });

  it('montre ce qui reste à placer dans la ville', () => {
    const html = render();

    expect(html).toContain('À placer à Kyoto');
    expect(html).toContain('Arashiyama');
    expect(html).toContain('Placer');
  });

  // La réserve se lit juste après les jours de SA ville : on pioche là où l'on
  // vient de lire les trous, pas en fin de voyage.
  it('pose la réserve après le dernier jour de la ville, avant la suivante', () => {
    const html = render();

    const lastKyotoDay = html.indexOf('jeu. 12 nov.');
    const reserve = html.indexOf('À placer à Kyoto');
    const firstOsakaDay = html.indexOf('ven. 13 nov.');

    expect(lastKyotoDay).toBeGreaterThan(-1);
    expect(reserve).toBeGreaterThan(lastKyotoDay);
    expect(firstOsakaDay).toBeGreaterThan(reserve);
  });

  // Huit blocs « tout est casé » alourdiraient le programme pour ne rien dire.
  it('ne montre pas de réserve pour une ville où tout est casé', () => {
    expect(render()).not.toContain('À placer à Osaka');
  });

  // Une journée remplie montre aussi ses moments vides : un après-midi libre
  // est une place à prendre.
  it('garde les moments vides visibles en construction', () => {
    expect(render()).toContain('Après-midi');
  });
});

describe('TripProgram — en lecture seule', () => {
  it('ne propose aucune commande', () => {
    const html = render({ readOnly: true });

    expect(html).toContain('Fushimi Inari');
    expect(html).not.toContain('Refaire');
    expect(html).not.toContain('réserver');
    expect(html).not.toContain('Placer');
  });

  it('ne montre pas la réserve', () => {
    expect(render({ readOnly: true })).not.toContain('À placer');
  });

  // On suit un programme : seuls les moments remplis comptent.
  it('tait les moments vides', () => {
    expect(render({ readOnly: true })).not.toContain('Après-midi');
  });
});

describe('TripProgram — les trajets', () => {
  // Le trajet tombe le jour où l'on roule : le premier jour de la ville
  // d'arrivée, avec sa durée en clair.
  it('annonce le transfert entre deux villes', () => {
    const html = render();

    expect(html).toContain('Kyoto → Osaka');
    expect(html).toContain('Shinkansen');
    expect(html).toContain('15 min');
  });

  it('signale un transfert dont la durée manque', () => {
    expect(render({ trip: trip({ legs: [] }) })).toContain('durée non renseignée');
  });
});
