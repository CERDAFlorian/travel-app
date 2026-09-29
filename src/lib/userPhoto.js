// Les photos collées par l'utilisateur (L10, 0013_photos_collees.sql).
//
// Quand Wikimedia ne trouve rien, l'utilisateur colle sa propre image — pour
// un lieu touristique ou une activité (placePhotos.js, PASTE_CATEGORIES). Elle
// est réduite dans le navigateur — 1 200 px au plus, JPEG — avant l'envoi :
// quelques centaines de Ko au lieu de plusieurs Mo, un envoi rapide en 4G et un
// stockage qui tient des milliers de photos dans l'offre gratuite de Supabase.

import { supabase } from './supabase.js';

export const MAX_SIDE = 1200;
const QUALITY = 0.82;
const BUCKET = 'photos';

// Les dimensions réduites, sans jamais agrandir.
export function targetSize(width, height, max = MAX_SIDE) {
  const ratio = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

// items/<id>/<aléatoire>.jpg : les règles du stockage remontent au voyage par
// ces deux premiers dossiers.
export function storagePath(itemId, random = crypto.randomUUID()) {
  return `items/${itemId}/${random}.jpg`;
}

// Le chemin d'une photo à nous, retrouvé depuis son adresse publique — pour la
// retirer du stockage quand on la remplace. Rien pour une photo Wikimedia.
export function pathFromUrl(url) {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const at = String(url ?? '').indexOf(marker);
  return at === -1 ? null : decodeURIComponent(String(url).slice(at + marker.length));
}

// Une image dans un événement « coller » (Cmd+V), ou rien.
export function imageFromPaste(event) {
  const files = [...(event.clipboardData?.files ?? [])];
  return files.find((file) => file.type.startsWith('image/')) ?? null;
}

// Lire une image du presse-papier sur un clic. Le navigateur peut refuser —
// Firefox, une permission non accordée — : l'appelant propose alors Cmd+V ou
// le choix d'un fichier.
export async function readClipboardImage() {
  if (!navigator.clipboard?.read) throw Object.assign(new Error('unsupported'), { kind: 'unsupported' });
  let entries;
  try {
    entries = await navigator.clipboard.read();
  } catch {
    throw Object.assign(new Error('denied'), { kind: 'denied' });
  }
  for (const entry of entries) {
    const type = entry.types.find((t) => t.startsWith('image/'));
    if (type) return entry.getType(type);
  }
  return null;
}

async function shrink(blob) {
  const bitmap = await createImageBitmap(blob);
  const { width, height } = targetSize(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const jpeg = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
  if (!jpeg) throw new Error('Cette image ne peut pas être lue.');
  return jpeg;
}

// Réduit, envoie, et rend l'adresse publique. L'ancienne photo collée, s'il y
// en a une, est retirée du stockage (voir removeStoredPhoto).
export async function uploadPhoto({ itemId, blob, previousUrl = null }) {
  const jpeg = await shrink(blob);
  const path = storagePath(itemId);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, jpeg, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
  if (error) throw new Error(`Envoi de la photo refusé : ${error.message}`);

  await removeStoredPhoto(previousUrl, itemId);

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// Retire du stockage la photo collée d'un lieu, quand plus rien ne la montre. « Dupliquer sur un autre jour » copie la photo avec l'item :
// les deux copies partagent alors le même fichier, et le retirer pour l'une
// casserait l'autre. Au mieux : dans le doute, ou si la suppression échoue, le
// fichier reste — un fichier en trop ne se voit pas, une image cassée si.
export async function removeStoredPhoto(url, itemId) {
  const path = pathFromUrl(url);
  if (!path) return;
  const { count, error } = await supabase
    .from('items')
    .select('id', { count: 'exact', head: true })
    .eq('photo_url', url)
    .neq('id', itemId);
  if (error || count !== 0) return;
  await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
}
