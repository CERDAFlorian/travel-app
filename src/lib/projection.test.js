import { describe, expect, it } from 'vitest';
import { MAP_HEIGHT, MAP_WIDTH, isInsideMap, projectPoint } from './projection.js';

// Les 7 étapes du seed. Si la projection dérivait du chemin tracé par
// scripts/build-map.mjs, les épingles quitteraient le trait de côte sans que
// rien ne le signale à l'écran.
const STEPS = {
  Tokyo: [35.68, 139.69],
  Matsumoto: [36.24, 137.97],
  'Shirakawa-go': [36.26, 136.9],
  Kyoto: [35.01, 135.77],
  Hiroshima: [34.39, 132.46],
  Osaka: [34.69, 135.5],
};

describe('projectPoint', () => {
  it.each(Object.entries(STEPS))('place %s dans le cadre', (_name, [lat, lng]) => {
    const point = projectPoint(lat, lng);
    expect(point.x).toBeGreaterThanOrEqual(0);
    expect(point.x).toBeLessThanOrEqual(MAP_WIDTH);
    expect(point.y).toBeGreaterThanOrEqual(0);
    expect(point.y).toBeLessThanOrEqual(MAP_HEIGHT);
  });

  it("respecte l'ordre ouest → est", () => {
    const byX = Object.entries(STEPS)
      .sort(([, a], [, b]) => projectPoint(a[0], a[1]).x - projectPoint(b[0], b[1]).x)
      .map(([name]) => name);

    expect(byX).toEqual(['Hiroshima', 'Osaka', 'Kyoto', 'Shirakawa-go', 'Matsumoto', 'Tokyo']);
  });

  // L'axe écran descend quand la latitude monte. Une inversion de signe est
  // l'erreur classique, et elle donne une carte à l'envers qu'on peut trouver
  // plausible au premier coup d'œil.
  it('place le nord plus haut que le sud', () => {
    expect(projectPoint(36.26, 136.9).y).toBeLessThan(projectPoint(34.39, 132.46).y);
  });

  it('rend null sans coordonnées', () => {
    expect(projectPoint(null, 135)).toBeNull();
    expect(projectPoint(35, null)).toBeNull();
  });
});

describe('isInsideMap', () => {
  it('reconnaît un point hors cadre', () => {
    // Sapporo : au nord du cadre, qui coupe Hokkaidō.
    expect(isInsideMap(projectPoint(43.06, 141.35))).toBe(false);
  });

  it('accepte une marge', () => {
    const point = { x: -10, y: 10 };
    expect(isInsideMap(point)).toBe(false);
    expect(isInsideMap(point, 20)).toBe(true);
  });
});
