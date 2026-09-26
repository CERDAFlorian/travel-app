import { describe, expect, it } from 'vitest';
import { groupSteps, legArc, legArcs, nextSelection, placeItems, ringOffset, placeLabels } from './mapGeometry.js';

const step = (id, lat, lng, items = []) => ({ id, name: id, lat, lng, items });
const item = (id, category, lat = null, lng = null) => ({ id, title: id, category, lat, lng });

describe('groupSteps', () => {
  // Tokyo est l'étape 1 et l'étape 9 : une seule épingle pour les deux.
  it('regroupe deux étapes à la même ville', () => {
    const groups = groupSteps([step('tokyo-1', 35.67686, 139.763895), step('kyoto', 35.01, 135.77), step('tokyo-9', '35.676860', '139.763895')]);
    expect(groups).toHaveLength(2);
    expect(groups[0].steps.map((s) => s.id)).toEqual(['tokyo-1', 'tokyo-9']);
  });

  it('écarte une étape sans coordonnées', () => {
    expect(groupSteps([step('a', null, null), step('b', 35, 135)])).toHaveLength(1);
  });
});

describe('placeItems', () => {
  it('pose un item localisé à sa place, les autres en couronne', () => {
    const steps = [step('kyoto', 35, 135, [item('kinkaku', 'lieu', 35.04, 135.73), item('fushimi', 'lieu'), item('note', 'note')])];
    const placed = placeItems(steps, groupSteps(steps));
    expect(placed.map((p) => [p.id, p.kind])).toEqual([['kinkaku', 'geo'], ['fushimi', 'ring']]);
  });

  // Les notes perso n'ont pas de lieu : ni pastille, ni couronne.
  it('ignore les catégories sans existence géographique', () => {
    const steps = [step('s', 35, 135, [item('n', 'note')])];
    expect(placeItems(steps, groupSteps(steps))).toEqual([]);
  });

  // Deux étapes à la même ville partagent la couronne : leurs items ne doivent
  // pas se superposer.
  it('tient le compteur de couronne par ville, pas par étape', () => {
    const steps = [step('t1', 35.6, 139.7, [item('a', 'lieu')]), step('t9', 35.6, 139.7, [item('b', 'lieu')])];
    const [a, b] = placeItems(steps, groupSteps(steps));
    expect([a.dx, a.dy]).toEqual([ringOffset(0).dx, ringOffset(0).dy]);
    expect([b.dx, b.dy]).toEqual([ringOffset(1).dx, ringOffset(1).dy]);
  });

  it("ne place pas en couronne l'item d'une étape non située", () => {
    const steps = [step('s', null, null, [item('a', 'lieu')])];
    expect(placeItems(steps, groupSteps(steps))).toEqual([]);
  });
});

describe('legArc', () => {
  it('part de la ville de départ et arrive à celle d’arrivée', () => {
    const path = legArc({ lat: 35, lng: 135 }, { lat: 36, lng: 138 }, 0);
    expect(path[0]).toEqual({ lat: 35, lng: 135 });
    expect(path.at(-1)).toEqual({ lat: 36, lng: 138 });
  });

  // Le creux alterne : deux trajets successifs ne se superposent pas.
  it('courbe dans un sens puis dans l’autre', () => {
    const from = { lat: 35, lng: 135 };
    const to = { lat: 35, lng: 139 };
    const mid = (i) => legArc(from, to, i)[16].lat;
    expect(Math.sign(mid(0) - 35)).toBe(-Math.sign(mid(1) - 35));
  });
});

describe('legArcs', () => {
  // Décidé le 26 septembre 2026 : pas d'arc sans trajet saisi.
  it('ne dessine que les trajets saisis', () => {
    const groups = groupSteps([step('a', 35, 135), step('b', 36, 138)]);
    expect(legArcs([], groups)).toEqual([]);
    expect(legArcs([{ id: 'l', from_step: 'a', to_step: 'b' }], groups)).toHaveLength(1);
  });

  it('ignore un trajet vers une étape non située', () => {
    const groups = groupSteps([step('a', 35, 135)]);
    expect(legArcs([{ id: 'l', from_step: 'a', to_step: 'b' }], groups)).toEqual([]);
  });
});

describe('nextSelection', () => {
  const group = { steps: [{ id: 't1' }, { id: 't9' }] };

  it('sélectionne la première étape au premier clic', () => {
    expect(nextSelection(group, null)).toBe('t1');
  });

  it('passe à l’étape suivante de la même ville, puis désélectionne', () => {
    expect(nextSelection(group, 't1')).toBe('t9');
    expect(nextSelection(group, 't9')).toBeNull();
  });
});

describe('placeLabels', () => {
  const label = (id, x, owner = id) => ({ id, x, y: 100, text: 'Kyoto', size: 14, gap: 16, owner });

  const placed = (...args) => Object.fromEntries(placeLabels(...args));

  it('pose deux noms éloignés à droite de leur point', () => {
    expect(placed([label('a', 0), label('b', 400)], [])).toEqual({ a: 'right', b: 'right' });
  });

  // Le premier arrivé garde sa place : c'est l'ordre de priorité. Le second
  // se replie à gauche avant d'être masqué.
  it('passe à gauche quand la droite est prise', () => {
    expect(placed([label('a', 0), label('b', 20)], [])).toEqual({ a: 'right', b: 'left' });
  });

  it('masque un nom pris des deux côtés', () => {
    const wall = (owner, x) => ({ owner, kind: 'pin', x1: x - 15, x2: x + 15, y1: 85, y2: 115 });
    expect(placed([label('a', 0)], [wall('b', 40), wall('c', -40)])).toEqual({});
  });

  // Comme sur la carte SVG : un nom d'étape passe par-dessus les pastilles des
  // lieux ; seul un nom de lieu les évite.
  it("laisse un nom d'étape passer sur une pastille, pas un nom de lieu", () => {
    const dot = { owner: 'lieu', kind: 'dot', x1: 30, x2: 44, y1: 93, y2: 107 };
    expect(placed([{ ...label('etape', 0), against: 'pin' }], [dot])).toEqual({ etape: 'right' });
    expect(placed([label('autre-lieu', 0)], [dot])).toEqual({ 'autre-lieu': 'left' });
  });

  it('masque un nom posé sur une autre épingle, pas sur la sienne', () => {
    const pin = (owner, x) => ({ owner, x1: x - 15, x2: x + 15, y1: 85, y2: 115 });
    expect(placed([label('a', 0)], [pin('a', 0)])).toEqual({ a: 'right' });
    expect(placed([label('a', 0)], [pin('b', 40)])).toEqual({ a: 'left' });
  });
});
