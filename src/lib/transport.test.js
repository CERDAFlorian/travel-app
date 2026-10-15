import { describe, expect, it } from 'vitest';
import { TRANSPORT_MODES, cityLegs, durationBetween, formatClock, formatDuration, legSummary, modeLabel, orderTransports, overlappingLegs, transportsByItem } from './transport.js';

describe('durationBetween', () => {
  it('compte les minutes entre deux horaires', () => {
    expect(durationBetween('09:12', '11:52')).toBe(160);
  });

  // Un bus de nuit arrive « avant » d'être parti si on lit les heures bêtement.
  it('traverse minuit sans repartir en arrière', () => {
    expect(durationBetween('23:10', '06:30')).toBe(440);
  });

  it('accepte les secondes que rend Postgres', () => {
    expect(durationBetween('09:12:00', '11:52:00')).toBe(160);
  });

  it('rend null si un horaire manque', () => {
    expect(durationBetween(null, '11:52')).toBeNull();
    expect(durationBetween('09:12', null)).toBeNull();
  });

  it('vaut zéro pour deux horaires identiques', () => {
    expect(durationBetween('09:12', '09:12')).toBe(0);
  });
});

describe('formatDuration', () => {
  it.each([
    [160, '2 h 40'],
    [45, '45 min'],
    [120, '2 h'],
    [0, '0 min'],
  ])('formate %i minutes en %s', (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });

  it('rend null sans durée', () => {
    expect(formatDuration(null)).toBeNull();
  });
});

describe('formatClock', () => {
  it('retire les secondes de Postgres', () => {
    expect(formatClock('09:12:00')).toBe('09:12');
  });

  it('rend null sans horaire', () => {
    expect(formatClock(null)).toBeNull();
  });
});

describe('TRANSPORT_MODES', () => {
  // La liste doit rester alignée sur le CHECK de legs.mode : une valeur
  // ajoutée ici sans migration serait refusée à l'insertion.
  it('correspond au CHECK du schéma', () => {
    expect(TRANSPORT_MODES.map((m) => m.value)).toEqual([
      'shinkansen',
      'train',
      'bus',
      'voiture',
      'ferry',
      'avion',
      'marche',
    ]);
  });

  it('retombe sur la valeur brute pour un mode inconnu', () => {
    expect(modeLabel('fusee')).toBe('fusee');
  });
});

describe('legSummary', () => {
  it('dit le mode, les horaires et la durée', () => {
    expect(
      legSummary({ mode: 'shinkansen', dep: '09:12:00', arr: '11:52:00', duration_min: 160 }),
    ).toBe('Shinkansen · 09:12 → 11:52 · 2 h 40');
  });

  // Beaucoup de trajets ne sont connus que par leur durée.
  it('se contente de la durée sans horaire', () => {
    expect(legSummary({ mode: 'bus', duration_min: 45 })).toBe('Bus · 45 min');
  });

  it('ajoute le prix quand il est connu', () => {
    const text = legSummary({ mode: 'train', duration_min: 60, price: 110, currency: 'EUR' });
    expect(text.startsWith('Train · 1 h · 110')).toBe(true);
    expect(text).toContain('€');
  });

  it('ne dit rien d’un trajet absent', () => {
    expect(legSummary(null)).toBeNull();
  });
});

describe('cityLegs', () => {
  it('ne garde que les trajets entre deux villes', () => {
    const legs = [
      { id: 'tokyo-matsumoto', from_step: 'tokyo', to_step: 'matsumoto' },
      { id: 'ferry', item_id: 'miyajima' },
    ];
    expect(cityLegs(legs).map((leg) => leg.id)).toEqual(['tokyo-matsumoto']);
  });
});

describe('transportsByItem', () => {
  const legs = [
    { id: 'ferry', item_id: 'miyajima', direction: 'aller', position: 2 },
    { id: 'train', item_id: 'miyajima', direction: 'aller', position: 1 },
    { id: 'dernier ferry', item_id: 'miyajima', direction: 'retour', position: 1 },
    { id: 'tokyo-matsumoto', from_step: 'tokyo', to_step: 'matsumoto', direction: 'aller' },
  ];

  // Le train PUIS le ferry : l'ordre où on les prend, pas celui de la saisie.
  it('range l’aller dans l’ordre où on le prend', () => {
    expect(transportsByItem(legs).get('miyajima').aller.map((leg) => leg.id)).toEqual(['train', 'ferry']);
  });

  it('sépare le retour', () => {
    expect(transportsByItem(legs).get('miyajima').retour.map((leg) => leg.id)).toEqual(['dernier ferry']);
  });

  it('ignore les trajets entre villes', () => {
    expect([...transportsByItem(legs).keys()]).toEqual(['miyajima']);
  });

  // Une ligne d'avant F4 n'a pas de sens : c'est un aller.
  it('prend un trajet sans sens pour un aller', () => {
    const map = transportsByItem([{ id: 'bus', item_id: 'koyasan' }]);
    expect(map.get('koyasan').aller.map((leg) => leg.id)).toEqual(['bus']);
  });
});

describe('orderTransports', () => {
  const ids = (legs) => orderTransports(legs).map((leg) => leg.id);

  // Le cas de Florian : train à 12 h saisi d'abord, bus corrigé à 11 h ensuite.
  it('range par heure de départ, quel que soit l’ordre de saisie', () => {
    expect(
      ids([
        { id: 'train', position: 1, dep: '12:00:00' },
        { id: 'bus', position: 2, dep: '11:00:00' },
      ]),
    ).toEqual(['bus', 'train']);
  });

  it('garde l’ordre de saisie sans heure', () => {
    expect(
      ids([
        { id: 'ferry', position: 2 },
        { id: 'train', position: 1 },
      ]),
    ).toEqual(['train', 'ferry']);
  });

  // Un transport sans heure ne bouge pas : seuls ceux à l'heure s'échangent,
  // dans les places qu'ils occupent.
  it('laisse un transport sans heure à sa place', () => {
    expect(
      ids([
        { id: 'train', position: 1, dep: '12:00:00' },
        { id: 'marche', position: 2 },
        { id: 'bus', position: 3, dep: '11:00:00' },
      ]),
    ).toEqual(['bus', 'marche', 'train']);
  });

  it('départage deux départs à la même heure par l’ordre de saisie', () => {
    expect(
      ids([
        { id: 'b', position: 2, dep: '09:00:00' },
        { id: 'a', position: 1, dep: '09:00:00' },
      ]),
    ).toEqual(['a', 'b']);
  });

  it('ne modifie pas la liste reçue', () => {
    const legs = [
      { id: 'train', position: 1, dep: '12:00:00' },
      { id: 'bus', position: 2, dep: '11:00:00' },
    ];
    orderTransports(legs);
    expect(legs.map((leg) => leg.id)).toEqual(['train', 'bus']);
  });
});

describe('overlappingLegs', () => {
  const clash = (legs) =>
    Object.fromEntries([...overlappingLegs(legs)].map(([id, others]) => [id, others.map((leg) => leg.id)]));

  it('repère deux transports qui se chevauchent', () => {
    expect(
      clash([
        { id: 'train', dep: '12:00:00', arr: '12:30:00' },
        { id: 'bus', dep: '12:15:00', arr: '12:45:00' },
      ]),
    ).toEqual({ train: ['bus'], bus: ['train'] });
  });

  // On descend du train à 12 h, on monte dans le bus à 12 h : c'est une
  // correspondance, pas un conflit.
  it('accepte une correspondance pile à l’heure', () => {
    expect(
      clash([
        { id: 'train', dep: '11:00:00', arr: '12:00:00' },
        { id: 'bus', dep: '12:00:00', arr: '12:30:00' },
      ]),
    ).toEqual({});
  });

  it('se sert de la durée quand l’arrivée manque', () => {
    expect(
      clash([
        { id: 'ferry', dep: '10:00:00', duration_min: 30 },
        { id: 'bus', dep: '10:20:00', arr: '10:40:00' },
      ]),
    ).toEqual({ ferry: ['bus'], bus: ['ferry'] });
  });

  it('ignore un transport sans heure de départ', () => {
    expect(
      clash([
        { id: 'train', dep: '12:00:00', arr: '13:00:00' },
        { id: 'marche', duration_min: 20 },
      ]),
    ).toEqual({});
  });

  // Le bus de 23 h 10 qui arrive à 6 h 30 occupe la nuit, pas « moins seize
  // heures ».
  it('comprend un trajet de nuit', () => {
    expect(
      clash([
        { id: 'nuit', dep: '23:10:00', arr: '06:30:00' },
        { id: 'tard', dep: '23:30:00', arr: '23:50:00' },
      ]),
    ).toEqual({ nuit: ['tard'], tard: ['nuit'] });
  });

  it('nomme chaque conflit d’un transport qui en a plusieurs', () => {
    expect(
      clash([
        { id: 'long', dep: '09:00:00', arr: '12:00:00' },
        { id: 'a', dep: '09:30:00', arr: '10:00:00' },
        { id: 'b', dep: '11:00:00', arr: '11:30:00' },
      ]).long,
    ).toEqual(['a', 'b']);
  });
});
