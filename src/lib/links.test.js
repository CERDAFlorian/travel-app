import { describe, expect, it } from 'vitest';
import { linkLabel, normalizeUrl } from './links.js';

describe('normalizeUrl', () => {
  it('garde un lien complet tel quel', () => {
    expect(normalizeUrl(' https://www.tiktok.com/@kyoto/video/123 ')).toBe('https://www.tiktok.com/@kyoto/video/123');
  });

  it('ajoute https:// à un lien copié sans', () => {
    expect(normalizeUrl('instagram.com/p/abc')).toBe('https://instagram.com/p/abc');
  });

  it('vide vaut null', () => {
    expect(normalizeUrl('  ')).toBeNull();
  });

  it('refuse ce qui n’est pas une adresse web', () => {
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeUrl('Kichi Kichi')).toBeNull();
  });
});

describe('linkLabel', () => {
  it('nomme les réseaux connus', () => {
    expect(linkLabel('https://vm.tiktok.com/ZM123/')).toBe('TikTok');
    expect(linkLabel('https://www.instagram.com/reel/abc/')).toBe('Instagram');
    expect(linkLabel('https://youtu.be/xyz')).toBe('YouTube');
    expect(linkLabel('https://tabelog.com/en/kyoto/A2601/')).toBe('Tabelog');
  });

  it('donne le domaine pour le reste', () => {
    expect(linkLabel('https://www.kichikichi.com/menu')).toBe('kichikichi.com');
  });
});
