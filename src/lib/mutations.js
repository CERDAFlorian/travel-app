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

// Lien de partage.
//
// Un UUID tiré par le navigateur : 122 bits, on ne tombe pas dessus par
// hasard. Le régénérer révoque le lien précédent — c'est le seul moyen de
// reprendre la main sur une URL déjà envoyée.
export async function createShareToken(tripId) {
  const token = crypto.randomUUID();
  const { error } = await supabase.from('trips').update({ share_token: token }).eq('id', tripId);
  if (error) fail(error, 'Création du lien de partage');
  return token;
}

export async function revokeShareToken(tripId) {
  const { error } = await supabase.from('trips').update({ share_token: null }).eq('id', tripId);
  if (error) fail(error, 'Révocation du lien de partage');
}

// Retire une étape de l'itinéraire.
//
// La suppression emporte en cascade les items de l'étape et les liaisons qui
// la touchent — c'est le schéma qui s'en charge (`on delete cascade`), pas ce
// code. Conséquence à connaître : retirer une étape du milieu supprime les
// DEUX liaisons qui l'encadraient, sans en créer une entre ses voisines. On ne
// peut pas deviner la durée d'un trajet qui n'a jamais été fait.
//
// Les dates des étapes restantes ne sont pas recalculées non plus : elles sont
// saisies, pas dérivées, et rien dans l'app ne permet encore de les modifier.
// Un trou apparaîtra donc dans l'enchaînement. À reprendre le jour où l'édition
// des dates existera.
export async function removeStep(stepId, orderedSteps) {
  const { error } = await supabase.from('steps').delete().eq('id', stepId);
  if (error) fail(error, "Suppression de l'étape");

  // Renumérotation : sans elle, les étapes s'afficheraient 1, 2, 4, 5. Aucune
  // contrainte d'unicité sur (trip_id, position), donc pas de collision
  // possible pendant la mise à jour.
  const remaining = orderedSteps.filter((step) => step.id !== stepId);

  for (const [index, step] of remaining.entries()) {
    const position = index + 1;
    if (step.position === position) continue;

    const { error: renumber } = await supabase
      .from('steps')
      .update({ position })
      .eq('id', step.id);
    if (renumber) fail(renumber, 'Renumérotation des étapes');
  }
}
