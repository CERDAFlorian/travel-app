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
  // Quatre nuits, cinq jours : les 11, 12, 13 et 14, où l'on dort à Kyoto, puis
  // le 15, jour du départ — partagé avec la ville suivante.
  it('donne les nuits plus le jour du départ', () => {
    expect(daysOf(kyoto()).map((day) => day.date)).toEqual([
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
    ]);
  });

  // Le jour du départ n'est pas une nuit dans la ville : on y fait encore
  // quelque chose, mais pas une journée de visites. Le drapeau permet de le
  // dire, quelle que soit la place de l'étape dans le voyage.
  it('marque le seul jour du départ', () => {
    const days = daysOf(kyoto());
    expect(days.at(-1)).toMatchObject({ offset: 4, date: '2026-11-15', departure: true });
    expect(days.slice(0, 4).every((day) => day.departure === false)).toBe(true);
  });

  it('numérote à partir de zéro', () => {
    expect(daysOf(kyoto()).map((day) => day.offset)).toEqual([0, 1, 2, 3, 4]);
  });

  // Une étape ajoutée dans l'app peut n'avoir pas encore de date résolue.
  // Mieux vaut des jours sans date qu'une exception au premier rendu.
  it('survit à une étape sans date', () => {
    const days = daysOf({ nights: 2, items: [] });
    expect(days.map((day) => day.date)).toEqual([null, null, null]);
  });
});

describe('daysOf — les heures de la ville (0016)', () => {
  const timed = { ...kyoto(), arrival_time: '15:40:00', departure_time: '10:00:00' };

  it('borne le premier jour à l’heure d’arrivée', () => {
    expect(daysOf(timed)[0]).toMatchObject({ from: '15:40:00', until: null });
  });

  it('borne le jour du départ à l’heure de départ', () => {
    expect(daysOf(timed).at(-1)).toMatchObject({ from: null, until: '10:00:00', departure: true });
  });

  it('laisse ouverts les jours du milieu', () => {
    expect(daysOf(timed)[2]).toMatchObject({ from: null, until: null });
  });

  it('laisse tout ouvert sans heure', () => {
    expect(daysOf(kyoto()).every((day) => day.from === null && day.until === null)).toBe(true);
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
    // Le cinquième jour est celui du départ, vide ici.
    expect(byDay).toEqual([['fushimi', 'arashiyama'], [], ['kinkakuji'], [], []]);
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
  // Passer Kyoto de 4 à 2 nuits supprime les jours 3 et 4.
  it('libère les items des jours supprimés', () => {
    const step = kyoto([
      item('jour 0', { day_offset: 0 }),
      item('jour 3', { day_offset: 3 }),
      item('jour 4', { day_offset: 4 }),
    ]);

    expect(releasedBy(step, 2)).toEqual(['jour 3', 'jour 4']);
  });

  it('ne libère rien quand on ajoute des nuits', () => {
    const step = kyoto([item('jour 3', { day_offset: 3 })]);
    expect(releasedBy(step, 6)).toEqual([]);
  });

  // Toute étape garde son jour de départ : passer à 2 nuits laisse les jours
  // 0, 1 et 2 — ce dernier devenant le nouveau jour du départ.
  it('garde le jour du départ de la nouvelle durée', () => {
    const step = kyoto([item('jour 2', { day_offset: 2 }), item('ancien départ', { day_offset: 4 })]);
    expect(releasedBy(step, 2)).toEqual(['ancien départ']);
  });

  // Option A, retenue le 12 octobre 2026 : une nuit ajoutée ne déplace rien.
  // Ce qui était prévu le jour du départ reste à sa date, devenue un jour
  // ordinaire.
  it('laisse le jour du départ à sa date quand on ajoute une nuit', () => {
    const step = kyoto([item('avant le train', { day_offset: 4 })]);
    expect(releasedBy(step, 5)).toEqual([]);

    const longer = { ...step, nights: 5 };
    const days = scheduleOf(longer);
    expect(days[4]).toMatchObject({ date: '2026-11-15', departure: false });
    expect(days[4].items.map((i) => i.id)).toEqual(['avant le train']);
    expect(days[5]).toMatchObject({ date: '2026-11-16', departure: true, items: [] });
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
  // Deux étapes enchaînées : Kyoto 11→13 (2 nuits), Osaka 13→15 (2 nuits).
  // Le 13 est le jour où l'on quitte Kyoto pour Osaka.
  const trip = (overrides = {}) => ({
    steps: [
      {
        id: 'kyoto',
        name: 'Kyoto',
        nights: 2,
        date_start: '2026-11-11',
        items: [
          { id: 'fushimi', category: 'lieu', day_offset: 0, day_slot: 'matin' },
          { id: 'nishiki', category: 'lieu', day_offset: 2, day_slot: 'matin' },
        ],
      },
      {
        id: 'osaka',
        name: 'Osaka',
        nights: 2,
        date_start: '2026-11-13',
        items: [{ id: 'dotonbori', category: 'restaurant', day_offset: 0, day_slot: 'soir' }],
      },
    ],
    flights: [],
    legs: [],
    ...overrides,
  });

  const on = (days, date) => days.find((day) => day.date === date);
  const ids = (part) => part.items.map((i) => i.id);

  // Une entrée par date, du premier jour au vol retour : deux nuits à Kyoto,
  // deux à Osaka, plus le jour du départ.
  it('rend une entrée par date', () => {
    const dates = tripSchedule(trip()).map((day) => day.date);

    expect(dates).toEqual(['2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
  });

  // Le 13 appartient aux deux villes : le matin à Kyoto avant de partir, le
  // soir à Osaka en arrivant. Deux parties, dans cet ordre.
  it('partage le jour du changement de ville', () => {
    const shared = on(tripSchedule(trip()), '2026-11-13');

    expect(shared.parts.map((part) => part.step.id)).toEqual(['kyoto', 'osaka']);
    expect(ids(shared.parts[0])).toEqual(['nishiki']);
    expect(ids(shared.parts[1])).toEqual(['dotonbori']);
  });

  // Chaque partie garde le jour de SON étape : c'est lui qu'on modifie.
  it('garde à chaque partie le rang du jour dans sa ville', () => {
    const shared = on(tripSchedule(trip()), '2026-11-13');

    expect(shared.parts[0]).toMatchObject({ offset: 2, departure: true });
    expect(shared.parts[1]).toMatchObject({ offset: 0, departure: false });
  });

  it('ne partage que les jours de changement de ville', () => {
    const days = tripSchedule(trip());
    expect(days.map((day) => day.parts.length)).toEqual([1, 1, 2, 1, 1]);
  });

  it('garde le programme de chaque jour', () => {
    const matin = tripSchedule(trip())[0].parts[0].groups.find((group) => group.key === 'matin');
    expect(matin.items.map((i) => i.id)).toEqual(['fushimi']);
  });

  // Le trajet se lit entre les deux parties du jour où on le fait.
  it('pose le trajet au jour du changement de ville', () => {
    const days = tripSchedule(
      trip({ legs: [{ id: 'l1', from_step: 'kyoto', to_step: 'osaka', mode: 'shinkansen' }] }),
    );

    expect(on(days, '2026-11-13').transfer.leg.id).toBe('l1');
    expect(days.filter((day) => day.transfer).length).toBe(1);
  });

  // Une liaison entre deux villes devenues non adjacentes reste en base — on
  // ne supprime pas une saisie — mais n'a plus à s'inviter dans une journée.
  it('ignore un trajet entre étapes non adjacentes', () => {
    const days = tripSchedule(
      trip({ legs: [{ id: 'l9', from_step: 'osaka', to_step: 'kyoto', mode: 'train' }] }),
    );
    expect(on(days, '2026-11-13').transfer.leg).toBeNull();
  });

  // Un jour de transfert reste un jour de programme : les deux villes se
  // lisent même quand aucune durée n'a été saisie.
  it('nomme les deux villes, liaison ou pas', () => {
    const days = tripSchedule(trip());
    const { transfer } = on(days, '2026-11-13');

    expect(transfer.from.name).toBe('Kyoto');
    expect(transfer.to.name).toBe('Osaka');
    expect(transfer.leg).toBeNull();
    // Le premier jour du voyage ne vient de nulle part, les autres non plus.
    expect(days.filter((day) => day.transfer)).toHaveLength(1);
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

  // Un vol intérieur le jour d'un changement de ville se range dans ce jour,
  // une seule fois.
  it('range un vol intérieur dans le jour partagé', () => {
    const days = tripSchedule(
      trip({ flights: [{ id: 'itami', direction: 'interieur', date: '2026-11-13' }] }),
    );

    expect(on(days, '2026-11-13').flights.map((f) => f.id)).toEqual(['itami']);
    expect(days.flatMap((day) => day.flights)).toHaveLength(1);
  });

  // La dernière ville n'a pas de suivante : son jour du départ est celui du
  // vol retour, seul dans sa journée.
  it('laisse le jour du vol retour à la dernière ville seule', () => {
    const last = tripSchedule(trip()).at(-1);

    expect(last.parts).toHaveLength(1);
    expect(last.parts[0]).toMatchObject({ departure: true });
    expect(last.transfer).toBeNull();
  });

  // La réserve d'une ville se pose après son dernier jour — le jour du
  // départ, partagé ou non.
  it('marque le dernier jour de chaque ville', () => {
    const flags = tripSchedule(trip()).flatMap((day) =>
      day.parts.map((part) => [part.step.id, part.lastOfStep]),
    );

    expect(flags).toEqual([
      ['kyoto', false],
      ['kyoto', false],
      ['kyoto', true],
      ['osaka', false],
      ['osaka', false],
      ['osaka', true],
    ]);
  });

  // Le ferry d'une activité (F4) n'a pas d'étapes : il ne doit jamais passer
  // pour le trajet entre deux villes.
  it('ignore les transports d’activité', () => {
    const days = tripSchedule(trip({ legs: [{ id: 'ferry', item_id: 'fushimi', mode: 'ferry' }] }));
    expect(on(days, '2026-11-13').transfer.leg).toBeNull();
  });

  // F5 : Kyoto a un arrêt sur la route d'Osaka. Il se lit dans le trajet du
  // 13, pas dans les jours de Kyoto ni dans sa réserve.
  describe('les arrêts en chemin', () => {
    const withStop = () => {
      const t = trip();
      t.steps[0].items.push(
        { id: 'fushimi-sake', category: 'activite', title: 'Fushimi', kind: 'arret', position: 9 },
        { id: 'kura', category: 'lieu', title: 'Kura', parent_id: 'fushimi-sake', day_slot: 'matin' },
      );
      return t;
    };

    it('pose l’arrêt dans le trajet du jour où l’on change de ville', () => {
      const shared = on(tripSchedule(withStop()), '2026-11-13');
      expect(shared.transfer.stops.map((plan) => plan.container.id)).toEqual(['fushimi-sake']);
      expect(shared.transfer.stops[0].items.map((i) => i.id)).toEqual(['kura']);
    });

    it('garde l’arrêt et son contenu hors des jours de la ville', () => {
      const days = tripSchedule(withStop());
      const cityItems = days.flatMap((day) => day.parts.flatMap((part) => part.items.map((i) => i.id)));
      expect(cityItems).not.toContain('fushimi-sake');
      expect(cityItems).not.toContain('kura');
    });

    it('garde l’arrêt hors de la réserve de la ville', () => {
      const kyoto = withStop().steps[0];
      expect(unplacedOf(kyoto).map((i) => i.id)).not.toContain('fushimi-sake');
      expect(unplacedOf(kyoto).map((i) => i.id)).not.toContain('kura');
    });

    // Ajouter une nuit à Kyoto déplace le départ, donc l'arrêt, sans rien
    // écrire : il n'a pas de jour à lui.
    it('suit le jour du départ quand la ville gagne une nuit', () => {
      const t = withStop();
      t.steps[0].nights = 3;
      t.steps[1].date_start = '2026-11-14';
      const days = tripSchedule(t);
      expect(on(days, '2026-11-14').transfer.stops).toHaveLength(1);
      expect(on(days, '2026-11-13').transfer).toBeNull();
    });

    it('rend une route sans arrêt', () => {
      expect(on(tripSchedule(trip()), '2026-11-13').transfer.stops).toEqual([]);
    });
  });

  // F6 : une excursion se place sur un jour de la ville comme une activité ;
  // ce qu'elle contient la suit, hors des jours de la ville.
  describe('les excursions', () => {
    const withExcursion = (placed = true) => {
      const t = trip();
      t.steps[0].items.push(
        {
          id: 'nara',
          category: 'lieu',
          title: 'Nara',
          kind: 'excursion',
          day_offset: placed ? 1 : null,
          day_slot: placed ? 'apres-midi' : null,
        },
        { id: 'todaiji', category: 'lieu', title: 'Tōdai-ji', parent_id: 'nara', day_slot: 'apres-midi' },
      );
      return t;
    };

    it('pose l’excursion sur son jour, en demi-journée', () => {
      const day = on(tripSchedule(withExcursion()), '2026-11-12');
      const afternoon = day.parts[0].groups.find((group) => group.key === 'apres-midi');
      expect(afternoon.items.map((i) => i.id)).toEqual(['nara']);
    });

    it('garde son contenu hors des jours de la ville', () => {
      const ids = tripSchedule(withExcursion()).flatMap((day) => day.parts.flatMap((part) => part.items.map((i) => i.id)));
      expect(ids).not.toContain('todaiji');
    });

    // Pas encore placée, elle attend dans la réserve de la ville — sans son
    // contenu, qui attend avec elle.
    it('attend dans la réserve de la ville, sans son contenu', () => {
      const kyoto = withExcursion(false).steps[0];
      const ids = unplacedOf(kyoto).map((i) => i.id);
      expect(ids).toContain('nara');
      expect(ids).not.toContain('todaiji');
    });
  });

  it('ne rend rien pour un voyage sans étape', () => {
    expect(tripSchedule({ steps: [], flights: [], legs: [] })).toEqual([]);
  });
});
