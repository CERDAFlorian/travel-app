import { supabase } from '@/lib/supabase.js';
import { fail } from '@/lib/errors.js';

// Écritures.
//
// Aucune ne renvoie la ligne : `.insert(row)` sans `.select()`. Ce n'est pas
// une économie, c'est une contrainte du modèle RLS — voir 0002_rls.sql. Et
// puisque le rendu vient du cache, une ligne renvoyée ne servirait à rien : on
// resynchronise après coup, ce qui garantit que l'écran montre ce que la base
// contient réellement plutôt qu'une supposition locale.
//
// Toutes les écritures sont bloquées en amont quand `readOnly` est vrai : pas
// de réseau, ou pas de session. RLS refuserait de toute façon, mais mieux vaut
// une UI qui n'invite pas au geste qu'un message d'erreur après coup.

export async function addItem({ stepId, category, title, price, position }) {
  const { error } = await supabase.from('items').insert({
    step_id: stepId,
    category,
    title: title.trim(),
    price: price ?? null,
    position,
  });
  if (error) fail(error, "Ajout de l'item");
}

export async function updateItem(id, { title, price, notes }) {
  const patch = {};
  if (title !== undefined) patch.title = title.trim();
  if (price !== undefined) patch.price = price;
  // Une note vidée redevient NULL : une chaîne vide en base se comporte
  // différemment d'une absence à la lecture, et on ne veut pas les deux.
  if (notes !== undefined) patch.notes = notes?.trim() || null;

  const { error } = await supabase.from('items').update(patch).eq('id', id);
  if (error) fail(error, "Modification de l'item");
}

export async function deleteItem(id) {
  const { error } = await supabase.from('items').delete().eq('id', id);
  if (error) fail(error, "Suppression de l'item");
}

export async function setFavorite(id, favorite) {
  const { error } = await supabase.from('items').update({ favorite }).eq('id', id);
  if (error) fail(error, 'Mise à jour du favori');
}

// `geocoded_at` distingue les deux origines, comme le prévoit le schéma :
// renseigné quand Nominatim a répondu, NULL quand les coordonnées ont été
// collées à la main. Utile le jour où l'on voudra re-géocoder en masse sans
// écraser ce qui a été corrigé manuellement.
export async function setCoordinates(id, { lat, lng }, { geocoded }) {
  const { error } = await supabase
    .from('items')
    .update({ lat, lng, geocoded_at: geocoded ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) fail(error, 'Enregistrement des coordonnées');
}

export async function clearCoordinates(id) {
  const { error } = await supabase
    .from('items')
    .update({ lat: null, lng: null, geocoded_at: null })
    .eq('id', id);
  if (error) fail(error, 'Effacement des coordonnées');
}
