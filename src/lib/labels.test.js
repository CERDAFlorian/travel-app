import { describe, expect, it } from 'vitest';
import { boxOf, measureText, placeLabel, zoomTier } from './labels.js';

describe('zoomTier', () => {
  it.each([
    [1, 1],
    [1.9, 1],
    [2, 2],
    [3.9, 2],
    [4, 4],
    [7.9, 4],
    [8, 8],
    [20, 8],
  ])('range k=%s dans le palier %i', (k, tier) => {
    expect(zoomTier(k)).toBe(tier);
  });
});

describe('boxOf', () => {
  it('cale la boîte à gauche, à droite ou au centre selon l’ancrage', () => {
    expect(boxOf(100, 50, 'start', 40, 10).x1).toBe(100);
    expect(boxOf(100, 50, 'end', 40, 10).x1).toBe(60);
    expect(boxOf(100, 50, 'middle', 40, 10).x1).toBe(80);
  });
});

describe('placeLabel', () => {
  it('préfère la droite quand rien ne gêne', () => {
    const placed = placeLabel(100, 100, 10, 'Kyoto', 14);
    expect(placed.anchor).toBe('start');
    expect(placed.x).toBe(118);
    expect(placed.cost).toBe(0);
  });

  it('bascule à gauche quand la droite est occupée', () => {
    const blocked = boxOf(118, 106, 'start', measureText('Kyoto', 14), 14);
    const placed = placeLabel(100, 100, 10, 'Kyoto', 14, [blocked]);
    expect(placed.anchor).toBe('end');
  });

  // Le contrat interdit de masquer un label parce qu'il ne trouve pas de place.
  // Mieux vaut un chevauchement visible qu'une information disparue.
  it('pose quand même le label si toutes les positions sont prises', () => {
    const everywhere = [{ x1: -1e4, x2: 1e4, y1: -1e4, y2: 1e4 }];
    const placed = placeLabel(100, 100, 10, 'Kyoto', 14, everywhere);
    expect(placed).toBeTruthy();
    expect(Number.isFinite(placed.x)).toBe(true);
  });

  // Entre deux positions sans collision dure, on prend celle qui recouvre le
  // moins les obstacles souples.
  it('choisit le moindre recouvrement parmi les obstacles souples', () => {
    const rightSoft = boxOf(118, 106, 'start', 200, 14);
    const placed = placeLabel(100, 100, 10, 'Kyoto', 14, [], [rightSoft]);
    expect(placed.anchor).not.toBe('start');
  });
});
