import { describe, expect, it } from 'vitest';
import { categoryOf } from './categories.js';

describe('categoryOf', () => {
  // Un Airbnb ou une chambre d'hôtes ne sont pas des hôtels. Seul le libellé
  // change : la clé reste celle de la base.
  it('nomme « Logement » la catégorie des nuits, sous sa clé historique', () => {
    expect(categoryOf('hotel').label).toBe('Logement');
    expect(categoryOf('hotel').placeholder).toContain('Airbnb');
  });

  it('ne connaît pas une clé inventée', () => {
    expect(categoryOf('logement')).toBeNull();
  });
});
