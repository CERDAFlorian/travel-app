import { describe, expect, it } from 'vitest';
import {
  addDays,
  chainDates,
  datesToUpdate,
  flightArrival,
  resolveItinerary,
  tripEndDate,
  tripEndFromFlights,
  tripStartFromFlights,
} from './itinerary.js';

// L'itinéraire du seed : 2, 1, 1, 4, 2, 3, 6 nuits à partir du 7 novembre.
const SEED = [
  { id: 'a', nights: 2, date_start: '2026-11-07', date_end: '2026-11-09' },
  { id: 'b', nights: 1, date_start: '2026-11-09', date_end: '2026-11-10' },
  { id: 'c', nights: 1, date_start: '2026-11-10', date_end: '2026-11-11' },
  { id: 'd', nights: 4, date_start: '2026-11-11', date_end: '2026-11-15' },
  { id: 'e', nights: 2, date_start: '2026-11-15', date_end: '2026-11-17' },
  { id: 'f', nights: 3, date_start: '2026-11-17', date_end: '2026-11-20' },
  { id: 'g', nights: 6, date_start: '2026-11-20', date_end: '2026-11-26' },
];

describe('addDays', () => {
  it('avance sans décaler sous un fuseau négatif', () => {
    const tz = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';
    try {
      expect(addDays('2026-11-07', 2)).toBe('2026-11-09');
    } finally {
      process.env.TZ = tz;
    }
  });

  it('franchit les fins de mois', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
  });

  it("franchit le changement d'année", () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });
});

describe('chainDates', () => {
  // Le seed est déjà cohérent : le recalcul doit le laisser intact. Si ce test
  // casse, c'est que le modèle de dates a changé sans que le seed suive.
  it('reproduit exactement les dates du seed', () => {
    const chained = chainDates('2026-11-07', SEED);
    for (const [index, step] of SEED.entries()) {
      expect(chained[index].date_start).toBe(step.date_start);
      expect(chained[index].date_end).toBe(step.date_end);
    }
  });

  it('enchaîne sans trou : chaque début est la fin du précédent', () => {
    const chained = chainDates('2026-11-07', SEED);
    for (let i = 1; i < chained.length; i++) {
      expect(chained[i].date_start).toBe(chained[i - 1].date_end);
    }
  });

  it('accepte une étape sans nuit', () => {
    const chained = chainDates('2026-11-07', [{ id: 'x', nights: 0 }, { id: 'y', nights: 2 }]);
    expect(chained[0]).toEqual({ id: 'x', date_start: '2026-11-07', date_end: '2026-11-07' });
    expect(chained[1].date_end).toBe('2026-11-09');
  });
});

describe('datesToUpdate', () => {
  it("n'écrit rien quand tout est déjà en place", () => {
    expect(datesToUpdate('2026-11-07', SEED)).toEqual([]);
  });

  // Une nuit ajoutée au milieu décale la suite, pas le début. Écrire les sept
  // étapes ferait sept requêtes là où quatre suffisent.
  it('ne déplace que les étapes situées après le changement', () => {
    const changed = SEED.map((s) => (s.id === 'd' ? { ...s, nights: 5 } : s));
    const updates = datesToUpdate('2026-11-07', changed);
    expect(updates.map((u) => u.id)).toEqual(['d', 'e', 'f', 'g']);
    expect(updates[0].date_end).toBe('2026-11-16');
  });

  // Le cas qui motivait tout : retirer une étape ne doit pas laisser de trou.
  it('recolle la chaîne après le retrait d’une étape', () => {
    const without = SEED.filter((s) => s.id !== 'e');
    const updates = datesToUpdate('2026-11-07', without);
    expect(updates.map((u) => u.id)).toEqual(['f', 'g']);
    expect(updates[0].date_start).toBe('2026-11-15');
  });
});

describe('tripEndDate', () => {
  it('suit la fin de la dernière étape', () => {
    expect(tripEndDate('2026-11-07', SEED)).toBe('2026-11-26');
  });

  it('retombe sur le départ quand il n’y a plus d’étape', () => {
    expect(tripEndDate('2026-11-07', [])).toBe('2026-11-07');
  });
});

describe('flightArrival', () => {
  it('reporte le décalage de jour', () => {
    expect(flightArrival({ date: '2026-11-07', arrival_offset_days: 1 })).toBe('2026-11-08');
  });

  it('vaut le jour du départ sans décalage', () => {
    expect(flightArrival({ date: '2026-11-07' })).toBe('2026-11-07');
  });

  it('recule d’un jour à la ligne de changement de date', () => {
    expect(flightArrival({ date: '2026-11-07', arrival_offset_days: -1 })).toBe('2026-11-06');
  });

  it('rend null sans date', () => {
    expect(flightArrival({ arrival_offset_days: 1 })).toBeNull();
  });
});

describe('tripStartFromFlights', () => {
  // Le cas qui motive tout : on décolle le 7, on atterrit le 8, la première
  // nuit d'hôtel est celle du 8.
  it("cale le depart sur l'ARRIVEE du vol aller", () => {
    const flights = [
      { direction: 'aller', date: '2026-11-07', arrival_offset_days: 1 },
      { direction: 'retour', date: '2026-11-26', arrival_offset_days: 0 },
    ];
    expect(tripStartFromFlights(flights, '2026-11-07')).toBe('2026-11-08');
  });

  it('ignore les vols intérieurs et le retour', () => {
    const flights = [
      { direction: 'interieur', date: '2026-11-01' },
      { direction: 'retour', date: '2026-10-01' },
    ];
    expect(tripStartFromFlights(flights, '2026-11-07')).toBe('2026-11-07');
  });

  it('retient le premier aller quand il y en a plusieurs', () => {
    const flights = [
      { direction: 'aller', date: '2026-11-09' },
      { direction: 'aller', date: '2026-11-07', arrival_offset_days: 1 },
    ];
    expect(tripStartFromFlights(flights, '2026-01-01')).toBe('2026-11-08');
  });

  // Sans vol daté, on ne devine rien : la date saisie fait foi.
  it('retombe sur la date fournie sans vol aller', () => {
    expect(tripStartFromFlights([], '2026-11-07')).toBe('2026-11-07');
  });
});

describe('resolveItinerary', () => {
  const steps = [
    { id: 'a', nights: 2, date_start: '2026-11-07', date_end: '2026-11-09' },
    { id: 'b', nights: 3, date_start: '2026-11-09', date_end: '2026-11-12' },
  ];

  // Le cas signalé : le vol atterrit le 8, la première nuit est celle du 8.
  // Les colonnes en base disent encore le 7 — elles sont ignorées.
  it("fait commencer la premiere etape a l'arrivee du vol, pas au decollage", () => {
    const trip = {
      startDate: '2026-11-07',
      steps,
      flights: [{ direction: 'aller', date: '2026-11-07', arrival_offset_days: 1 }],
    };
    const resolved = resolveItinerary(trip);
    expect(resolved.start).toBe('2026-11-08');
    expect(resolved.steps[0].date_start).toBe('2026-11-08');
    expect(resolved.steps[0].date_end).toBe('2026-11-10');
    expect(resolved.steps[1].date_start).toBe('2026-11-10');
  });

  it('ignore les dates stockees, meme incoherentes', () => {
    const trip = {
      startDate: '2026-11-08',
      steps: [{ id: 'a', nights: 2, date_start: '1999-01-01', date_end: '1999-01-02' }],
      flights: [],
    };
    expect(resolveItinerary(trip).steps[0].date_start).toBe('2026-11-08');
  });

  // Le retour borne le sejour : on dort jusqu'au matin du decollage.
  it('compte les nuits disponibles jusqu’au depart du vol retour', () => {
    const trip = {
      startDate: '2026-11-07',
      steps,
      flights: [
        { direction: 'aller', date: '2026-11-07', arrival_offset_days: 1 },
        { direction: 'retour', date: '2026-11-14' },
      ],
    };
    const resolved = resolveItinerary(trip);
    expect(resolved.availableNights).toBe(6);
    expect(resolved.plannedNights).toBe(5);
    expect(resolved.nightsGap).toBe(1);
  });

  it('signale un sejour qui deborde le vol retour', () => {
    const trip = {
      startDate: '2026-11-08',
      steps,
      flights: [{ direction: 'retour', date: '2026-11-11' }],
    };
    expect(resolveItinerary(trip).nightsGap).toBe(-2);
  });

  // Sans vol retour date, il n'y a rien a comparer : on ne fabrique pas
  // d'avertissement a partir de rien.
  it('ne compare rien sans vol retour', () => {
    const resolved = resolveItinerary({ startDate: '2026-11-07', steps, flights: [] });
    expect(resolved.availableNights).toBeNull();
    expect(resolved.nightsGap).toBeNull();
  });
});
