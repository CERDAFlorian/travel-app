import { describe, expect, it } from 'vitest';
import { citySlotsFor, excursionWindow, excursionsOn, fitsAround, insideSlotsFor, sideOf } from './excursions.js';

const miyajima = { id: 'miyajima', kind: 'excursion', day_offset: 1, day_slot: 'journee' };
const nara = { id: 'nara', kind: 'excursion', day_offset: 1, day_slot: 'apres-midi' };
const keys = (slots) => slots.map((slot) => slot.key);

describe('excursionWindow', () => {
  // Sans horaire, la plage de son moment : du matin à la fin de l'après-midi
  // pour une journée entière, le soir reste en ville.
  it('prend la plage de son moment sans horaire', () => {
    expect(excursionWindow(miyajima)).toEqual({ from: '06:00', until: '18:00' });
    expect(excursionWindow(nara)).toEqual({ from: '14:00', until: '18:00' });
  });

  // Les trajets donnent les heures : le premier départ, la dernière arrivée.
  it('prend les heures de ses trajets', () => {
    const own = {
      aller: [{ dep: '09:40:00' }, { dep: '09:10:00' }],
      retour: [{ dep: '17:30:00', arr: '17:40:00' }],
    };
    expect(excursionWindow(miyajima, own)).toEqual({ from: '09:10', until: '17:40' });
  });

  // Une borne sans horaire garde celle du moment.
  it('mêle trajet et moment quand un seul sens est horodaté', () => {
    expect(excursionWindow(miyajima, { aller: [{ dep: '09:10:00' }], retour: [] })).toEqual({
      from: '09:10',
      until: '18:00',
    });
  });
});

describe('fitsAround et sideOf', () => {
  const window = { from: '09:10', until: '17:40' };

  it('garde le matin avant et le soir après', () => {
    expect(fitsAround('matin', window)).toBe(true);
    expect(fitsAround('soir', window)).toBe(true);
    expect(sideOf('matin', window)).toBe('before');
    expect(sideOf('soir', window)).toBe('after');
  });

  it('refuse le midi, pendant l’excursion', () => {
    expect(fitsAround('midi', window)).toBe(false);
  });

  // Vingt minutes d'après-midi après un retour à 17 h 40 : ce n'est pas un
  // après-midi en ville.
  it('refuse un moment dont il reste moins d’une heure', () => {
    expect(fitsAround('apres-midi', window)).toBe(false);
  });

  it('refuse la journée entière', () => {
    expect(fitsAround('journee', window)).toBe(false);
  });

  it('laisse « à caler » partout', () => {
    expect(fitsAround(null, window)).toBe(true);
  });
});

describe('les choix du jour d’une excursion', () => {
  const hiroshima = { items: [miyajima, { id: 'dome', day_offset: 1 }] };

  it('trouve les excursions d’un jour', () => {
    expect(excursionsOn(hiroshima, 1).map((x) => x.item.id)).toEqual(['miyajima']);
    expect(excursionsOn(hiroshima, 0)).toEqual([]);
  });

  // Journée entière sans horaire : la ville ne garde que le soir.
  it('ne propose en ville que les moments hors de l’excursion', () => {
    const day = { from: null, until: null, excursions: excursionsOn(hiroshima, 1) };
    expect(keys(citySlotsFor(day))).toEqual(['soir']);
  });

  // Une demi-journée l'après-midi laisse le matin, le midi et le soir.
  it('laisse le reste de la journée autour d’une demi-journée', () => {
    const day = { excursions: [{ item: nara, window: excursionWindow(nara) }] };
    expect(keys(citySlotsFor(day))).toEqual(['matin', 'midi', 'soir']);
  });

  it('propose les moments de sa plage dans une journée entière', () => {
    expect(keys(insideSlotsFor({ item: miyajima, window: excursionWindow(miyajima) }))).toEqual([
      'matin',
      'midi',
      'apres-midi',
    ]);
  });

  // Une demi-journée se range en liste, dans son seul moment.
  it('propose le seul moment d’une demi-journée', () => {
    expect(keys(insideSlotsFor({ item: nara, window: excursionWindow(nara) }))).toEqual(['apres-midi']);
  });
});
