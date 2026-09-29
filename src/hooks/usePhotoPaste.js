import { useState } from 'react';
import { readClipboardImage, removeStoredPhoto, uploadPhoto } from '@/lib/userPhoto.js';
import { setItemPhoto } from '@/lib/mutations.js';

// Coller, choisir ou retirer la photo d'un lieu (L10). `item` : la ligne, avec
// sa photo actuelle.
export function usePhotoPaste({ item, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const ours = item?.photo_source === 'user' ? item.photo_url : null;

  async function save(blob) {
    setBusy(true);
    setError(null);
    try {
      const url = await uploadPhoto({ itemId: item.id, blob, previousUrl: ours });
      await setItemPhoto(item.id, { url, credit: null, license: null, page: null }, 'user');
      await onChanged?.();
      return true;
    } catch (failure) {
      setError(failure.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  // Sur un clic : lire le presse-papier. S'il refuse, on dit quoi faire
  // plutôt que d'échouer en silence.
  async function paste() {
    setError(null);
    try {
      const blob = await readClipboardImage();
      if (!blob) {
        setError('Le presse-papier ne contient pas d’image : copie d’abord une image.');
        return false;
      }
      return await save(blob);
    } catch (failure) {
      setError(
        failure.kind
          ? 'Ce navigateur ne laisse pas lire le presse-papier : fais Cmd+V (ou Ctrl+V), ou choisis une image.'
          : failure.message,
      );
      return false;
    }
  }

  // Retirer : le fichier collé quitte le stockage, et la photo est notée comme
  // « cherchée » — Wikimedia ne revient pas la remplacer.
  async function remove() {
    setBusy(true);
    setError(null);
    try {
      if (ours) await removeStoredPhoto(ours, item.id);
      await setItemPhoto(item.id, null);
      await onChanged?.();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, paste, save, remove };
}
