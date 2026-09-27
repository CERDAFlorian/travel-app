import { describe, expect, it } from 'vitest';
import { imageFromPaste, pathFromUrl, storagePath, targetSize } from './userPhoto.js';

describe('targetSize', () => {
  it('réduit le plus grand côté à 1 200 px, en gardant les proportions', () => {
    expect(targetSize(4032, 3024)).toEqual({ width: 1200, height: 900 });
    expect(targetSize(1080, 1920)).toEqual({ width: 675, height: 1200 });
  });

  it("n'agrandit jamais une petite image", () => {
    expect(targetSize(640, 480)).toEqual({ width: 640, height: 480 });
  });
});

describe('storagePath', () => {
  // Les règles du stockage remontent au voyage par ces deux dossiers.
  it('range une photo sous son genre et son identifiant', () => {
    expect(storagePath('item', 'abc', 'r')).toBe('items/abc/r.jpg');
    expect(storagePath('step', 'kyoto', 'r')).toBe('steps/kyoto/r.jpg');
  });
});

describe('pathFromUrl', () => {
  it('retrouve le chemin d’une photo collée', () => {
    expect(pathFromUrl('https://x.supabase.co/storage/v1/object/public/photos/items/abc/r.jpg')).toBe('items/abc/r.jpg');
  });

  // On ne retire jamais du stockage ce qui n'y est pas.
  it('ne rend rien pour une photo Wikimedia', () => {
    expect(pathFromUrl('https://upload.wikimedia.org/wikipedia/commons/a.jpg')).toBeNull();
    expect(pathFromUrl(null)).toBeNull();
  });
});

describe('imageFromPaste', () => {
  const event = (...files) => ({ clipboardData: { files } });

  it('rend l’image collée', () => {
    const image = { type: 'image/png' };
    expect(imageFromPaste(event({ type: 'text/plain' }, image))).toBe(image);
  });

  it('ne rend rien sans image', () => {
    expect(imageFromPaste(event({ type: 'text/plain' }))).toBeNull();
    expect(imageFromPaste({})).toBeNull();
  });
});
