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
  // Un seul : le départ d'une ville vers la suivante se lit dans le trajet.
  it('signale le jour du vol retour, et lui seul', () => {
    expect(render().match(/pday__rank/g)).toHaveLength(1);
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
  // vient de lire les trous, pas en fin de voyage. Le dernier jour de Kyoto
  // est celui où l'on part pour Osaka.
  it('pose la réserve après le jour du départ de la ville', () => {
    const html = render();

    const leavingDay = html.indexOf('ven. 13 nov.');
    const reserve = html.indexOf('À placer à Kyoto');
    const nextDay = html.indexOf('sam. 14 nov.');

    expect(leavingDay).toBeGreaterThan(-1);
    expect(reserve).toBeGreaterThan(leavingDay);
    expect(nextDay).toBeGreaterThan(reserve);
  });

  // Huit blocs « tout est casé » alourdiraient le programme pour ne rien dire.
  it('ne montre pas de réserve pour une ville où tout est casé', () => {
    expect(render()).not.toContain('À placer à Osaka');
  });

  // Une journée remplie montre aussi ses moments vides : un après-midi libre
  // est une place à prendre.
  // Passe UX du 15 octobre 2026 : seuls les moments remplis s'affichent, en
  // construction comme en lecture. Fushimi est le matin du 11 : pas d'« Après-
  // midi — » vide à côté.
  it('tait les moments vides, même en construction', () => {
    const html = render();
    expect(html).toContain('>Matin<');
    expect(html).not.toContain('Après-midi');
  });

  // Les commandes d'un item sont repliées derrière un « ⋯ » : présentes, mais
  // masquées tant qu'on ne les déplie pas.
  it('replie les commandes d’un item derrière « ⋯ »', () => {
    const html = render();
    expect(html).toContain('class="planned__more"');
    expect(html).toMatch(/class="planned__bar" hidden=""/);
  });

  // La réserve tient sur une ligne avec son compteur, et se déplie au clic.
  it('replie la réserve d’une ville', () => {
    const html = render();
    expect(html).toMatch(/class="reserve__toggle" aria-expanded="false"/);
    expect(html).toMatch(/class="reserve__groups" hidden=""/);
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

  // Un trajet manquant est une chose à faire : en construction, la ligne
  // invite à le saisir ; en lecture, elle dit ce qui manque.
  it('invite à saisir un trajet manquant', () => {
    expect(render({ trip: trip({ legs: [] }) })).toContain('+ ajouter le transport');
    expect(render({ trip: trip({ legs: [] }), readOnly: true })).toContain('durée non renseignée');
  });

  // L11 F3 : le trajet se saisit ICI, sur le jour où l'on change de ville.
  it('rend la ligne du trajet modifiable en construction', () => {
    const html = render();
    expect(html).toMatch(/<button[^>]*class="pday__move"[^>]*title="Modifier ce trajet"/);
  });

  it('laisse la ligne du trajet inerte en lecture', () => {
    const html = render({ readOnly: true });
    expect(html).not.toContain('Modifier ce trajet');
    expect(html).toContain('Kyoto → Osaka');
  });

  it('montre le prix et la note du trajet', () => {
    const legs = [{ ...trip().legs[0], price: 15, currency: 'EUR', note: 'JR Pass' }];
    const html = render({ trip: trip({ legs }) });

    expect(html).toContain('JR Pass');
    expect(html).toMatch(/15\s?€/);
  });
});

describe('TripProgram — le jour du départ (F2)', () => {
  const leaving = trip();
  leaving.steps[0].items.push(
    item('Nishiki', { day_offset: 2, day_slot: 'matin', day_position: 1 }),
  );
  leaving.steps[1].items.push(
    item('Dōtonbori', { category: 'restaurant', day_offset: 0, day_slot: 'soir', day_position: 1 }),
  );

  // Le 13 se lit en trois temps : Kyoto avant de partir, le trajet, Osaka en
  // arrivant.
  it('lit le jour du changement de ville dans l’ordre où on le vit', () => {
    const html = render({ trip: leaving });

    const before = html.indexOf('Nishiki');
    const road = html.indexOf('Kyoto → Osaka');
    const after = html.indexOf('Dōtonbori');

    expect(before).toBeGreaterThan(-1);
    expect(road).toBeGreaterThan(before);
    expect(after).toBeGreaterThan(road);
  });

  it('nomme les deux parties de la journée', () => {
    const html = render({ trip: leaving });

    expect(html).toContain('À Kyoto, avant de partir');
    expect(html).toContain('À Osaka');
  });

  // En construction, une partie vide reste une place à prendre.
  // Passe UX du 15 octobre 2026 : une partie vide ne dit rien, en
  // construction non plus. On place le matin du départ depuis la réserve.
  it('tait les parties vides, même en construction', () => {
    const html = render();

    expect(html).not.toContain('avant de partir');
    expect(html).not.toContain('Rien de prévu en arrivant');
    expect(html).toContain('Kyoto → Osaka');
  });

  // En lecture, on suit la route : rien à dire d'une partie vide.
  it('tait les parties vides en lecture', () => {
    const html = render({ readOnly: true });

    expect(html).not.toContain('avant de partir');
    expect(html).toContain('Rien de plus que la route.');
  });

  // Le jour où l'on part se place depuis Kyoto : le sélecteur le propose.
  it('propose le jour du départ dans les jours de la ville', () => {
    const html = render({ trip: leaving });
    // Trois jours à Kyoto : 11, 12 et 13 — le dernier porte Nishiki.
    expect(html.indexOf('Nishiki')).toBeGreaterThan(html.indexOf('ven. 13 nov.'));
  });
});

describe('TripProgram — le transport d’une activité (F4)', () => {
  // Fushimi Inari, le 11 au matin : un train pour y aller, un bus pour revenir.
  const withTransports = trip({
    legs: [
      ...trip().legs,
      { id: 'bus', item_id: 'Fushimi Inari', direction: 'retour', position: 1, mode: 'bus', duration_min: 20 },
      { id: 'jr', item_id: 'Fushimi Inari', direction: 'aller', position: 1, mode: 'train', duration_min: 5, note: 'JR Nara' },
    ],
  });

  // L'aller au-dessus de l'activité, le retour en dessous : l'ordre où on le vit.
  it('encadre l’activité de son aller et de son retour', () => {
    const html = render({ trip: withTransports });

    const aller = html.indexOf('JR Nara');
    const activity = html.search(/class="planned__name"[^>]*>Fushimi Inari/);
    const retour = html.indexOf('>retour<');

    expect(aller).toBeGreaterThan(-1);
    expect(activity).toBeGreaterThan(aller);
    expect(retour).toBeGreaterThan(activity);
  });

  it('propose d’ajouter un transport en construction', () => {
    expect(render()).toContain('+ trajet');
  });

  it('montre les transports sans commande en lecture', () => {
    const html = render({ trip: withTransports, readOnly: true });

    expect(html).toContain('JR Nara');
    expect(html).not.toContain('+ trajet');
    expect(html).not.toContain('Modifier ce transport');
  });

  // Un trajet d'activité n'est pas un trajet entre villes : il ne doit pas se
  // glisser dans la ligne Kyoto → Osaka.
  it('ne confond pas un transport d’activité avec le trajet entre villes', () => {
    const html = render({ trip: trip({ legs: [withTransports.legs[1]] }) });
    expect(html).toContain('+ ajouter le transport');
  });
});

describe('TripProgram — les horaires qui se chevauchent', () => {
  // Le 13, on prend le Shinkansen de 9 h 12 vers Osaka… et on a noté un bus
  // de 9 h pour aller à Nishiki, à Kyoto, le même matin.
  const clashing = trip();
  clashing.steps[0].items.push(item('Nishiki', { day_offset: 2, day_slot: 'matin', day_position: 1 }));
  clashing.legs.push({
    id: 'bus',
    item_id: 'Nishiki',
    direction: 'aller',
    position: 1,
    mode: 'bus',
    dep: '09:00:00',
    arr: '09:20:00',
    duration_min: 20,
  });

  it('avertit sur les deux transports en conflit', () => {
    const html = render({ trip: clashing });
    expect(html.match(/⚠ chevauche/g)).toHaveLength(2);
  });

  // L'avertissement nomme l'autre transport : sans lui, on chercherait
  // lequel corriger.
  it('nomme le transport en cause', () => {
    expect(render({ trip: clashing })).toContain('Chevauche : Shinkansen · 09:12 → 09:27');
  });

  it('ne dit rien quand les horaires se suivent', () => {
    expect(render()).not.toContain('chevauche');
  });
});

describe('TripProgram — les arrêts en chemin (F5)', () => {
  // Entre Kyoto et Osaka, un arrêt à Fushimi : une brasserie de saké le
  // matin, un déjeuner, et un sanctuaire pas encore placé.
  const withStop = () => {
    const t = trip();
    t.steps[0].items.push(
      item('Nishiki', { day_offset: 2, day_slot: 'matin', day_position: 1 }),
      item('Fushimi', { kind: 'arret', position: 1 }),
      item('Gekkeikan', { parent_id: 'Fushimi', day_slot: 'apres-midi', day_position: 1 }),
      item('Torisei', { category: 'restaurant', parent_id: 'Fushimi', day_slot: 'midi', day_position: 1 }),
      item('Goko-gu', { parent_id: 'Fushimi' }),
    );
    t.legs.push({ id: 'keihan', item_id: 'Fushimi', direction: 'aller', position: 1, mode: 'train', duration_min: 20 });
    return t;
  };

  // Le 13 se lit dans l'ordre où on le vit : Kyoto avant de partir, le train
  // vers Fushimi, Fushimi, puis le trajet vers Osaka.
  it('pose l’arrêt entre la ville quittée et le dernier tronçon', () => {
    const html = render({ trip: withStop() });

    const kyoto = html.indexOf('Nishiki');
    const toStop = html.indexOf('20 min');
    const stop = html.indexOf('stopplan__name">Fushimi');
    const lastLeg = html.indexOf('Fushimi → Osaka');

    expect(kyoto).toBeGreaterThan(-1);
    expect(toStop).toBeGreaterThan(kyoto);
    expect(stop).toBeGreaterThan(toStop);
    expect(lastLeg).toBeGreaterThan(stop);
  });

  // Avec un arrêt, le trajet entre villes devient le dernier tronçon : il part
  // de l'arrêt.
  it('fait partir le dernier tronçon du dernier arrêt', () => {
    const html = render({ trip: withStop() });
    expect(html).toContain('Fushimi → Osaka');
    expect(html).not.toContain('Kyoto → Osaka');
  });

  it('range le contenu de l’arrêt par moments', () => {
    const html = render({ trip: withStop() });
    expect(html.indexOf('Torisei')).toBeLessThan(html.indexOf('Gekkeikan'));
  });

  it('montre la réserve de l’arrêt', () => {
    const html = render({ trip: withStop() });
    expect(html).toContain('À placer à Fushimi');
    expect(html).toContain('Goko-gu');
  });

  // Dans un arrêt, on change de moment, pas de jour, et on ne refait pas
  // ailleurs ce qui n'existe qu'en passant par là.
  it('propose « Moment » plutôt que « Jour » dans un arrêt', () => {
    const html = render({ trip: withStop() });
    const stopBlock = html.slice(html.indexOf('class="stopplan"'));
    expect(stopBlock).toContain('>Moment<');
  });

  it('garde l’arrêt hors de la réserve de la ville', () => {
    const html = render({ trip: withStop() });
    const reserve = html.slice(html.indexOf('À placer à Kyoto'), html.indexOf('sam. 14 nov.'));
    expect(reserve).not.toContain('Goko-gu');
    expect(reserve).not.toContain('>Fushimi<');
  });

  // Le trajet vers l'arrêt se réclame comme celui entre deux villes.
  it('réclame le trajet qui mène à l’arrêt tant qu’il manque', () => {
    const t = withStop();
    t.legs = t.legs.filter((leg) => leg.id !== 'keihan');
    const html = render({ trip: t });

    expect(html).toContain('Kyoto → Fushimi');
    expect(html.indexOf('Kyoto → Fushimi')).toBeLessThan(html.indexOf('stopplan__name'));
    expect(html.match(/\+ ajouter le transport/g).length).toBeGreaterThanOrEqual(1);
  });

  it('nomme le tronçon vers l’arrêt quand il est saisi', () => {
    expect(render({ trip: withStop() })).toContain('Kyoto → Fushimi');
  });

  it('montre l’arrêt sans commande en lecture', () => {
    const html = render({ trip: withStop(), readOnly: true });
    expect(html).toContain('Fushimi');
    expect(html).not.toContain('À placer à Fushimi');
    expect(html).not.toContain('+ trajet');
  });
});

describe('TripProgram — les heures de la ville (0016)', () => {
  // On quitte Kyoto le 13 à 10 h, on arrive à Osaka à 15 h 40. Nishiki est
  // posé l'après-midi du 13 à Kyoto : après le départ.
  const timed = () => {
    const t = trip();
    t.steps[0].departure_time = '10:00:00';
    t.steps[1].arrival_time = '15:40:00';
    t.steps[0].items.push(item('Nishiki', { day_offset: 2, day_slot: 'apres-midi', day_position: 1 }));
    t.steps[1].items.push(item('Dōtonbori', { day_offset: 0, day_slot: 'soir', day_position: 1 }));
    return t;
  };

  const shared = (html) => html.slice(html.indexOf('ven. 13 nov.'), html.indexOf('sam. 14 nov.'));

  // Les heures se lisent à côté des villes, dans l'en-tête du jour :
  // « Kyoto 10:00 → Osaka 15:40 ».
  it('affiche l’heure de départ et l’heure d’arrivée à côté des villes', () => {
    const day = shared(render({ trip: timed() }));
    const head = day.slice(0, day.indexOf('</header>'));
    expect(head).toMatch(/Kyoto<\/button><span class="pday__clock">10:00/);
    expect(head).toMatch(/Osaka<\/button><span class="pday__clock">15:40/);
  });

  // Un item placé après le départ ne disparaît pas : il se signale.
  it('signale un item placé après le départ', () => {
    expect(shared(render({ trip: timed() }))).toContain('après le départ');
  });

  // Un moment rempli dans la fenêtre ne se signale pas : Dōtonbori le soir,
  // après l'arrivée de 15 h 40.
  it('ne signale pas un moment rempli dans la fenêtre', () => {
    const day = shared(render({ trip: timed() }));
    const osaka = day.slice(day.indexOf('À Osaka'));
    expect(osaka).toContain('>Soir<');
    expect(osaka).not.toContain('avant l’arrivée');
  });

  it('ne signale rien sans heure', () => {
    const t = timed();
    t.steps[0].departure_time = null;
    t.steps[1].arrival_time = null;
    const day = shared(render({ trip: t }));
    expect(day).not.toContain('pday__clock');
    expect(day).not.toContain('après le départ');
  });
});

describe('TripProgram — les excursions (F6)', () => {
  // Le 12, l'après-midi à Nara depuis Kyoto : Tōdai-ji, puis le parc, et le
  // Kasuga-taisha encore à placer.
  const withExcursion = () => {
    const t = trip();
    t.steps[0].items.push(
      item('Nara', { kind: 'excursion', day_offset: 1, day_slot: 'apres-midi', day_position: 1 }),
      item('Tōdai-ji', { parent_id: 'Nara', day_slot: 'apres-midi', day_position: 1 }),
      item('Parc aux daims', { parent_id: 'Nara', day_slot: 'soir', day_position: 1 }),
      item('Kasuga-taisha', { parent_id: 'Nara' }),
    );
    t.legs.push(
      { id: 'kintetsu', item_id: 'Nara', direction: 'aller', position: 1, mode: 'train', duration_min: 45 },
      { id: 'kintetsu-retour', item_id: 'Nara', direction: 'retour', position: 1, mode: 'train', duration_min: 46 },
    );
    return t;
  };

  // L'aller, l'excursion, ce qu'on y fait, le retour : dans l'ordre où on le vit.
  it('déroule le contenu de l’excursion entre l’aller et le retour', () => {
    const html = render({ trip: withExcursion() });

    const aller = html.indexOf('45 min');
    const nara = html.search(/class="planned__name"[^>]*>Nara/);
    const todaiji = html.indexOf('Tōdai-ji');
    const parc = html.indexOf('Parc aux daims');
    const retour = html.indexOf('46 min');

    expect(aller).toBeGreaterThan(-1);
    expect(nara).toBeGreaterThan(aller);
    expect(todaiji).toBeGreaterThan(nara);
    expect(parc).toBeGreaterThan(todaiji);
    expect(retour).toBeGreaterThan(parc);
  });

  it('montre la réserve de l’excursion', () => {
    const html = render({ trip: withExcursion() });
    expect(html).toContain('À placer à Nara');
    expect(html).toContain('Kasuga-taisha');
  });

  // Une copie partirait sans son contenu : une excursion se déplace, elle ne
  // se refait pas.
  it('ne propose pas de refaire une excursion', () => {
    const html = render({ trip: withExcursion() });
    const row = html.slice(html.indexOf('data-kind="excursion"'), html.indexOf('Tōdai-ji'));
    expect(row).toContain('>Jour<');
    expect(row).not.toContain('Refaire');
  });

  it('se lit sans commande en lecture', () => {
    const html = render({ trip: withExcursion(), readOnly: true });
    expect(html).toContain('Tōdai-ji');
    expect(html).not.toContain('À placer à Nara');
  });
});

describe('TripProgram — l’excursion d’une journée entière (F6)', () => {
  // Le 12 à Miyajima depuis Kyoto : le ferry, le torii le matin, le mont Misen
  // l'après-midi, le dernier ferry, puis un dîner de retour en ville.
  const fullDay = () => {
    const t = trip();
    t.steps[0].items.push(
      item('Miyajima', { kind: 'excursion', day_offset: 1, day_slot: 'journee', day_position: 1 }),
      item('Otorii', { parent_id: 'Miyajima', day_slot: 'matin', day_position: 1 }),
      item('Mont Misen', { parent_id: 'Miyajima', day_slot: 'apres-midi', day_position: 1 }),
      item('Henjo Cave', { parent_id: 'Miyajima' }),
      item('Okonomiyaki', { category: 'restaurant', day_offset: 1, day_slot: 'soir', day_position: 1 }),
    );
    t.legs.push(
      { id: 'ferry', item_id: 'Miyajima', direction: 'aller', position: 1, mode: 'ferry', duration_min: 10, note: 'JR Pass' },
      { id: 'ferry-r', item_id: 'Miyajima', direction: 'retour', position: 1, mode: 'ferry', duration_min: 11, note: 'dernier ferry' },
    );
    return t;
  };

  const day12 = (html) => html.slice(html.indexOf('jeu. 12 nov.'), html.indexOf('ven. 13 nov.'));

  it('annonce l’excursion dans l’en-tête du jour', () => {
    const day = day12(render({ trip: fullDay() }));
    const head = day.slice(0, day.indexOf('</header>'));
    expect(head).toContain('◆ Miyajima');
  });

  // La journée se lit comme on la vivra.
  it('lit la journée dans l’ordre : aller, matin, après-midi, retour, ville', () => {
    const day = day12(render({ trip: fullDay() }));
    const order = ['JR Pass', 'Otorii', 'Mont Misen', 'dernier ferry', 'De retour à Kyoto', 'Okonomiyaki'].map((text) =>
      day.indexOf(text),
    );
    expect(order.every((at) => at > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  // Plus de « Journée entière » qui contient l'excursion qui contient ses
  // moments : ses moments sont ceux du jour.
  it('n’emboîte plus les moments dans « Journée entière »', () => {
    const day = day12(render({ trip: fullDay() }));
    expect(day).not.toContain('Journée entière');
    expect(day).toContain('>Matin<');
  });

  it('garde la réserve de l’excursion', () => {
    expect(day12(render({ trip: fullDay() }))).toContain('À placer à Miyajima');
  });
});

describe('TripProgram — l’excursion d’une demi-journée (F6)', () => {
  const halfDay = () => {
    const t = trip();
    t.steps[0].items.push(
      item('Nara', { kind: 'excursion', day_offset: 1, day_slot: 'apres-midi', day_position: 1 }),
      item('Tōdai-ji', { parent_id: 'Nara', day_slot: 'apres-midi', day_position: 1 }),
    );
    return t;
  };

  // Le contenu d'une demi-journée vit dans son moment : pas de bouton
  // « Moment » pour en changer.
  it('ne propose pas de changer le moment d’un lieu de la demi-journée', () => {
    const html = render({ trip: halfDay() });
    const inside = html.slice(html.indexOf('class="xlist"'));
    expect(inside).toContain('Tōdai-ji');
    expect(inside).not.toContain('>Moment<');
  });
});

describe('TripProgram — la ville autour d’une excursion (F6)', () => {
  // Le 12 à Miyajima, ferry 09:10, retour 17:40. En ville : un café le matin
  // (avant), un déjeuner à midi (pendant !), un dîner le soir (après).
  const around = () => {
    const t = trip();
    t.steps[0].items.push(
      item('Miyajima', { kind: 'excursion', day_offset: 1, day_slot: 'journee', day_position: 1 }),
      item('Otorii', { parent_id: 'Miyajima', day_slot: 'matin', day_position: 1 }),
      item('Café', { category: 'restaurant', day_offset: 1, day_slot: 'matin', day_position: 1 }),
      item('Déjeuner', { category: 'restaurant', day_offset: 1, day_slot: 'midi', day_position: 1 }),
      item('Dîner', { category: 'restaurant', day_offset: 1, day_slot: 'soir', day_position: 1 }),
    );
    t.legs.push(
      { id: 'ferry', item_id: 'Miyajima', direction: 'aller', position: 1, mode: 'ferry', dep: '09:10:00', arr: '09:20:00', duration_min: 10 },
      { id: 'ferry-r', item_id: 'Miyajima', direction: 'retour', position: 1, mode: 'ferry', dep: '17:30:00', arr: '17:40:00', duration_min: 10 },
    );
    return t;
  };
  const day12 = (html) => html.slice(html.indexOf('jeu. 12 nov.'), html.indexOf('ven. 13 nov.'));

  it('lit la ville avant et après l’excursion', () => {
    const day = day12(render({ trip: around() }));
    const order = ['Avant de partir à Miyajima', 'Café', 'Otorii', 'De retour à Kyoto', 'Dîner'].map((t) => day.indexOf(t));
    expect(order.every((at) => at > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('signale un lieu de la ville posé pendant l’excursion', () => {
    const day = day12(render({ trip: around() }));
    expect(day).toContain('pendant l’excursion');
    expect(day.indexOf('pendant l’excursion')).toBeLessThan(day.indexOf('Déjeuner'));
  });

  // Une demi-journée l'après-midi : un lieu de la ville le même après-midi
  // se signale, le matin non.
  it('signale un lieu posé pendant une demi-journée, pas autour', () => {
    const t = trip();
    t.steps[0].items.push(
      item('Nara', { kind: 'excursion', day_offset: 1, day_slot: 'apres-midi', day_position: 1 }),
      item('Kinkaku-ji', { day_offset: 1, day_slot: 'apres-midi', day_position: 2 }),
      item('Ginkaku-ji', { day_offset: 1, day_slot: 'matin', day_position: 1 }),
    );
    const day = day12(render({ trip: t }));
    expect(day.match(/pendant l’excursion/g)).toHaveLength(1);
    expect(day.indexOf('pendant l’excursion')).toBeGreaterThan(day.indexOf('Ginkaku-ji'));
  });
});

describe('TripProgram — la réserve rangée par catégorie', () => {
  it('range ce qui reste à placer par catégorie, dans l’ordre des catégories', () => {
    const t = trip();
    t.steps[0].items.push(
      item('Ramen', { category: 'restaurant' }),
      item('Atelier matcha', { category: 'activite' }),
    );
    const html = render({ trip: t });
    const reserve = html.slice(html.indexOf('À placer à Kyoto'));
    const order = ['Activités', 'Atelier matcha', 'Restaurants', 'Ramen', 'Lieux touristiques', 'Arashiyama'].map((x) =>
      reserve.indexOf(x),
    );
    expect(order.every((at) => at > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});
