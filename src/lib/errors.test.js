import { describe, expect, it } from 'vitest';
import { classifyFailure, fail } from './errors.js';

// La classification décide de ce que l'utilisateur lit et de ce qu'il peut
// faire. Confondre les trois cas a réellement coûté une session de diagnostic
// en production : un jeton périmé s'affichait comme « Hors ligne ».
describe('classifyFailure', () => {
  it.each([
    ['TypeError: Failed to fetch', 'network'],
    ['NetworkError when attempting to fetch resource', 'network'],
    ['Load failed', 'network'],
  ])('classe « %s » en réseau', (message, kind) => {
    expect(classifyFailure({ message })).toBe(kind);
  });

  it.each([
    ['JWT expired', {}],
    ['Invalid API key', {}],
    ['permission denied for table items', {}],
  ])('classe « %s » en authentification', (message) => {
    expect(classifyFailure({ message })).toBe('auth');
  });

  it.each([
    ['PGRST301', 'auth'],
    ['42501', 'auth'],
    ['PGRST116', 'server'],
  ])('classe le code %s en %s', (code, kind) => {
    expect(classifyFailure({ message: 'quelque chose', code })).toBe(kind);
  });

  it('retombe sur server par défaut', () => {
    expect(classifyFailure({ message: 'relation does not exist' })).toBe('server');
    expect(classifyFailure(undefined)).toBe('server');
  });

  // postgrest-js range parfois la cause dans `details` plutôt que `message`.
  it('regarde aussi details', () => {
    expect(classifyFailure({ message: '', details: 'TypeError: Failed to fetch' })).toBe('network');
  });
});

describe('fail', () => {
  it('traduit le message et garde l’original en cause', () => {
    const original = { message: 'JWT expired', code: 'PGRST301' };
    try {
      fail(original, 'Chargement du voyage');
      expect.unreachable('fail doit lever');
    } catch (error) {
      expect(error.kind).toBe('auth');
      expect(error.message).toBe('Chargement du voyage : session expirée, reconnecte-toi');
      expect(error.cause).toBe(original);
    }
  });

  // Une erreur serveur n'a pas de traduction générique utile : on montre le
  // message d'origine, qui nomme la table ou la contrainte.
  it('laisse passer le message brut pour une erreur serveur', () => {
    try {
      fail({ message: 'relation "public.trips" does not exist' }, 'Chargement');
      expect.unreachable('fail doit lever');
    } catch (error) {
      expect(error.kind).toBe('server');
      expect(error.message).toContain('relation "public.trips" does not exist');
    }
  });
});
