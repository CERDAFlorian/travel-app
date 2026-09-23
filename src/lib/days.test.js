import { describe, expect, it } from 'vitest';
import {
  SLOTS,
  daysOf,
  positionsToUpdate,
  releasedBy,
  reorderInDay,
  scheduleOf,
  tripSchedule,
  unplacedOf,
} from './days.js';

// Kyoto du seed : 4 nuits à partir du 11 novembre.
const kyoto = (items = []) => ({
  name: 'Kyoto',
  nights: 4,
  date_start: '2026-11-11',
  date_end: '2026-11-15',
  items,
});

const item = (id, overrides = {}) => ({
  id,
  category: 'activite',
  title: id,
  position: 0,
  day_offset: null,
  day_position: 0,
  ...overrides,
});

describe('daysOf', () => {
  // Quatre nuits, quatre jours. Le 15 est le jour de trajet : il appartient à
  // Hiroshima, la ville où l'on dort ce soir-là.
  it('donne autant de jours que de nuits', () => {
    expect(daysOf(kyoto()).map((day) => day.date)).toEqual([
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
    ]);
  });

  // La dernière étape a un jour de plus : celui du vol retour. On y fait
  // encore quelque chose — check-out, train pour l'aéroport — mais on n'y dort
  // pas, d'où le drapeau.
  it('ajoute le jour du départ à la dernière étape', () => {
    const days = daysOf(kyoto(), { isLast: true });
    expect(days).toHaveLength(5);
    expect(days.at(-1)).toMatchObject({ offset: 4, date: '2026-11-15', departure: true });
    expect(days.slice(0, 4).every((day) => day.departure === false)).toBe(true);
  });

  it('numérote à partir de zéro', () => {
    expect(daysOf(kyoto()).map((day) => day.offset)).toEqual([0, 1, 2, 3]);
  });

  // Une étape ajoutée dans l'app peut n'avoir pas encore de date résolue.
  // Mieux vaut des jours sans date qu'une exception au premier rendu.
  it('survit à une étape sans date', () => {
    const days = daysOf({ nights: 2, items: [] });
    expect(days.map((day) => day.date)).toEqual([null, null]);
  });
});

describe('scheduleOf', () => {
  it('range chaque item dans son jour', () => {
    const step = kyoto([
      item('fushimi', { day_offset: 0 }),
      item('kinkakuji', { day_offset: 2 }),
      item('arashiyama', { day_offset: 0 }),
    ]);

    const byDay = scheduleOf(step).map((day) => day.items.map((i) => i.id));
    expect(byDay).toEqual([['fushimi', 'arashiyama'], [], ['kinkakuji'], []]);
  });

  it('ordonne un jour par day_position', () => {
    const step = kyoto([
      item('soir', { day_offset: 1, day_position: 3 }),
      item('matin', { day_offset: 1, day_position: 1 }),
      item('midi', { day_offset: 1, day_position: 2 }),
    ]);

    expect(scheduleOf(step)[1].items.map((i) => i.id)).toEqual(['matin', 'midi', 'soir']);
  });

  // Deux items jamais réordonnés valent 0 tous les deux : sans départage, leur
  // ordre dépendrait du hasard de la réponse et pourrait changer d'un rendu à
  // l'autre sous les yeux.
  it('départage deux items de même rang par ordre de saisie', () => {
    const step = kyoto([
      item('second', { day_offset: 0, position: 2 }),
      item('premier', { day_offset: 0, position: 1 }),
    ]);

    expect(scheduleOf(step)[0].items.map((i) => i.id)).toEqual(['premier', 'second']);
  });

  it('laisse les items en réserve hors du programme', () => {
    const step = kyoto([item('un jour peut-être'), item('posé', { day_offset: 3 })]);
    expect(scheduleOf(step).flatMap((day) => day.items).map((i) => i.id)).toEqual(['posé']);
  });
});

describe('scheduleOf — les moments', () => {
  const groupsOf = (day) =>
    Object.fromEntries(day.groups.map((group) => [group.key ?? 'null', group.items.map((i) => i.id)]));

  // L'ordre de la journée : la journée entière d'abord — c'est un bandeau,
  // pas un créneau —, puis matin, midi, après-midi, soir.
  it('ordonne la journée par moment', () => {
    const step = kyoto([
      item('soir', { day_offset: 0, day_slot: 'soir' }),
      item('matin', { day_offset: 0, day_slot: 'matin' }),
      item('journee', { day_offset: 0, day_slot: 'journee' }),
      item('aprem', { day_offset: 0, day_slot: 'apres-midi' }),
      item('midi', { day_offset: 0, day_slot: 'midi' }),
    ]);

    expect(scheduleOf(step)[0].items.map((i) => i.id)).toEqual([
      'journee',
      'matin',
      'midi',
      'aprem',
      'soir',
    ]);
  });

  it('range chaque item dans son groupe', () => {
    const step = kyoto([
      item('fushimi', { day_offset: 0, day_slot: 'matin' }),
      item('nishiki', { day_offset: 0, day_slot: 'midi' }),
      item('kaiseki', { day_offset: 0, day_slot: 'soir' }),
    ]);

    expect(groupsOf(scheduleOf(step)[0])).toEqual({
      journee: [],
      matin: ['fushimi'],
      midi: ['nishiki'],
      'apres-midi': [],
      soir: ['kaiseki'],
      null: [],
    });
  });

  // Tous les moments sont rendus, vides compris : c'est la vue qui décide
  // lesquels afficher.
  it('rend tous les groupes même vides', () => {
    const day = scheduleOf(kyoto())[0];
    expect(day.groups.map((group) => group.key)).toEqual([
      ...SLOTS.map((slot) => slot.key),
      null,
    ]);
  });

  // Un item posé avant l'existence des moments ne doit pas atterrir dans un
  // moment arbitraire : il reste à caler, visible.
  it('garde les items sans moment dans leur propre groupe', () => {
    const step = kyoto([item('orphelin', { day_offset: 0 })]);
    const day = scheduleOf(step)[0];

    expect(groupsOf(day).null).toEqual(['orphelin']);
    // Et il passe en dernier dans l'ordre du jour.
    expect(day.items.map((i) => i.id)).toEqual(['orphelin']);
  });

  it('place les sans-moment après les moments connus', () => {
    const step = kyoto([
      item('a caler', { day_offset: 0 }),
      item('soir', { day_offset: 0, day_slot: 'soir' }),
    ]);
    expect(scheduleOf(step)[0].items.map((i) => i.id)).toEqual(['soir', 'a caler']);
  });

  // L'HEURE NE TRIE PAS. On lit l'heure, on ne s'y soumet pas : sinon saisir
  // « 9h » sur la dernière ligne la ferait sauter en tête sous les doigts.
  it('ne laisse pas start_time commander l’ordre', () => {
    const step = kyoto([
      item('premier', { day_offset: 0, day_slot: 'matin', day_position: 1, start_time: '11:00' }),
      item('second', { day_offset: 0, day_slot: 'matin', day_position: 2, start_time: '09:00' }),
    ]);

    expect(scheduleOf(step)[0].items.map((i) => i.id)).toEqual(['premier', 'second']);
  });

  // Deux items au même rang dans le même moment : départagés par l'ordre de
  // saisie, jamais par le hasard de la réponse.
  it('départage deux items du même moment', () => {
    const step = kyoto([
      item('second', { day_offset: 0, day_slot: 'soir', position: 2 }),
      item('premier', { day_offset: 0, day_slot: 'soir', position: 1 }),
    ]);
    expect(scheduleOf(step)[0].items.map((i) => i.id)).toEqual(['premier', 'second']);
  });
});

describe('unplacedOf', () => {
  it('rend ce qui reste à placer', () => {
    const step = kyoto([item('placé', { day_offset: 1 }), item('à placer')]);
    expect(unplacedOf(step).map((i) => i.id)).toEqual(['à placer']);
  });

  // Un hôtel est le décor de l'étape entière, une note perso n'a pas de jour :
  // ni l'un ni l'autre n'a à traîner dans une réserve qu'on doit vider.
  it('ignore les catégories qui ne se planifient pas', () => {
    const step = kyoto([
      item('machiya', { category: 'hotel' }),
      item('JR Pass', { category: 'note' }),
      item('atelier matcha'),
    ]);
    expect(unplacedOf(step).map((i) => i.id)).toEqual(['atelier matcha']);
  });

  // Filet de sécurité : si la libération a échoué — réseau coupé pendant la
  // réduction des nuits —, l'item doit réapparaître dans la réserve plutôt que
  // de sortir de l'écran en restant en base.
  it('récupère un item posé sur un jour qui n’existe plus', () => {
    const step = { ...kyoto([item('orphelin', { day_offset: 7 })]) };
    expect(unplacedOf(step).map((i) => i.id)).toEqual(['orphelin']);
  });
});

describe('releasedBy', () => {
  // Passer Kyoto de 4 à 2 nuits supprime les jours 2 et 3.
  it('libère les items des jours supprimés', () => {
    const step = kyoto([
      item('jour 0', { day_offset: 0 }),
      item('jour 2', { day_offset: 2 }),
      item('jour 3', { day_offset: 3 }),
    ]);

    expect(releasedBy(step, 2)).toEqual(['jour 2', 'jour 3']);
  });

  it('ne libère rien quand on ajoute des nuits', () => {
    const step = kyoto([item('jour 3', { day_offset: 3 })]);
    expect(releasedBy(step, 6)).toEqual([]);
  });

  // La dernière étape garde son jour de départ : le compte n'est pas le même,
  // et libérer le check-out en retirant une nuit serait une surprise.
  it('tient compte du jour de départ de la dernière étape', () => {
    const step = kyoto([item('depart', { day_offset: 2 })]);
    expect(releasedBy(step, 2, { isLast: true })).toEqual([]);
    expect(releasedBy(step, 2, { isLast: false })).toEqual(['depart']);
  });

  it('ne touche pas à la réserve', () => {
    const step = kyoto([item('en réserve')]);
    expect(releasedBy(step, 1)).toEqual([]);
  });
});

describe('reorderInDay', () => {
  const items = [item('a'), item('b'), item('c')];

  it('descend un item d’un cran', () => {
    expect(reorderInDay(items, 'a', 1).map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });

  it('monte un item d’un cran', () => {
    expect(reorderInDay(items, 'c', -1).map((i) => i.id)).toEqual(['a', 'c', 'b']);
  });

  // Même contrat que reorderSteps : le tableau d'origine signale « rien à
  // écrire », et l'appelant compare les références.
  it('rend le tableau d’origine quand le mouvement est impossible', () => {
    expect(reorderInDay(items, 'a', -1)).toBe(items);
    expect(reorderInDay(items, 'c', 1)).toBe(items);
    expect(reorderInDay(items, 'inconnu', 1)).toBe(items);
  });
});

describe('positionsToUpdate', () => {
  it('n’écrit que les rangs qui ont bougé', () => {
    const ordered = [
      item('a', { day_position: 1 }),
      item('c', { day_position: 3 }),
      item('b', { day_position: 2 }),
    ];

    expect(positionsToUpdate(ordered)).toEqual([
      { id: 'c', day_position: 2 },
      { id: 'b', day_position: 3 },
    ]);
  });

  it('n’écrit rien quand l’ordre est déjà le bon', () => {
    const ordered = [item('a', { day_position: 1 }), item('b', { day_position: 2 })];
    expect(positionsToUpdate(ordered)).toEqual([]);
  });

  // Les items d'un jour jamais réordonné valent tous 0 : le premier passage
  // doit leur donner un rang, sinon aucun déplacement ne serait jamais écrit.
  it('numérote un jour qui n’a jamais été ordonné', () => {
    const ordered = [item('a'), item('b')];
    expect(positionsToUpdate(ordered)).toEqual([
      { id: 'a', day_position: 1 },
      { id: 'b', day_position: 2 },
    ]);
  });
});

describe('tripSchedule', () => {
  // Deux étapes enchaînées : Kyoto 11→13 (2 nuits), Osaka 13→15 (2 nuits),
  // la seconde étant la dernière du voyage.
  const trip = (overrides = {}) => ({
    steps: [
      {
        id: 'kyoto',
        name: 'Kyoto',
        nights: 2,
        date_start: '2026-11-11',
        items: [{ id: 'fushimi', category: 'lieu', day_offset: 0, day_slot: 'matin' }],
      },
      { id: 'osaka', name: 'Osaka', nights: 2, date_start: '2026-11-13', items: [] },
    ],
    flights: [],
    legs: [],
    ...overrides,
  });

  // Le voyage se lit comme une suite de jours : deux nuits, deux nuits, plus
  // le jour du vol retour porté par la dernière étape.
  it('enchaîne les jours de toutes les étapes', () => {
    const days = tripSchedule(trip());

    expect(days.map((day) => day.date)).toEqual([
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
    ]);
    expect(days.map((day) => day.step.name)).toEqual(['Kyoto', 'Kyoto', 'Osaka', 'Osaka', 'Osaka']);
    expect(days.at(-1).departure).toBe(true);
  });

  // Aucun jour n'est réclamé deux fois : date_end d'une étape EST date_start
  // de la suivante, et c'est la ville d'arrivée qui prend la journée.
  it('ne fait jamais se chevaucher deux étapes', () => {
    const dates = tripSchedule(trip()).map((day) => day.date);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('garde le programme de chaque jour', () => {
    const matin = tripSchedule(trip())[0].groups.find((group) => group.key === 'matin');
    expect(matin.items.map((i) => i.id)).toEqual(['fushimi']);
  });

  // Le trajet se lit le jour où on le fait — donc au premier jour de l'étape
  // d'arrivée, avant le programme du soir.
  it('pose le trajet au premier jour de l’étape d’arrivée', () => {
    const days = tripSchedule(
      trip({ legs: [{ id: 'l1', from_step: 'kyoto', to_step: 'osaka', mode: 'shinkansen' }] }),
    );

    expect(days.find((day) => day.date === '2026-11-13').leg.id).toBe('l1');
    expect(days.filter((day) => day.leg).length).toBe(1);
  });

  // Une liaison entre deux villes devenues non adjacentes reste en base — on
  // ne supprime pas une saisie — mais n'a plus à s'inviter dans une journée.
  it('ignore un trajet entre étapes non adjacentes', () => {
    const days = tripSchedule(
      trip({ legs: [{ id: 'l9', from_step: 'osaka', to_step: 'kyoto', mode: 'train' }] }),
    );
    expect(days.every((day) => day.leg === null)).toBe(true);
  });

  it('range les vols à leur date', () => {
    const days = tripSchedule(
      trip({
        flights: [
          { id: 'aller', direction: 'aller', date: '2026-11-11' },
          { id: 'retour', direction: 'retour', date: '2026-11-15' },
          { id: 'sans date', direction: 'interieur', date: null },
        ],
      }),
    );

    expect(days[0].flights.map((f) => f.id)).toEqual(['aller']);
    expect(days.at(-1).flights.map((f) => f.id)).toEqual(['retour']);
    // Un vol sans date n'a pas de place dans une chronologie : il reste dans
    // son panneau, pas ici.
    expect(days.flatMap((day) => day.flights)).toHaveLength(2);
  });

  it('ne rend rien pour un voyage sans étape', () => {
    expect(tripSchedule({ steps: [], flights: [], legs: [] })).toEqual([]);
  });
});
