// Le logement d'une étape.
//
// LE MODÈLE. Une étape est un changement de ville ET de logement : on y dort
// dans un seul hôtel. Mais on en compare souvent trois avant de choisir, et
// c'est précisément ce que l'app doit permettre — interdire le deuxième hôtel
// reviendrait à interdire la préparation.
//
// D'où deux notions distinctes, portées par deux colonnes qui existaient déjà
// sans servir :
//
//   · `favorite` — LE RETENU. Un seul par étape, et c'est lui, et lui seul,
//     qui entre au budget. Les autres restent des candidats, visibles avec
//     leur prix, mais hors du total.
//   · `booked`   — LE CHOIX SCELLÉ. Il vaut retenu, et supprime les candidats
//     non retenus (voir `sealHotel` dans mutations.js).
//
// L'étoile prend donc DEUX sens selon la catégorie : sur un hôtel « c'est
// celui-là », ailleurs « ce lieu illustre la ville » (bandeau photo, 3 max).
// C'est assumé : on ne met pas trois hôtels en avant, et on ne réserve pas un
// temple.

export function hotelsOf(step) {
  return (step.items ?? []).filter((item) => item.category === 'hotel');
}

// Le logement de l'étape. Null seulement quand aucun hôtel n'est saisi.
//
// IL Y A TOUJOURS UN RETENU. Le repli sur le premier hôtel saisi n'est pas un
// pis-aller : c'est ce qui évite un état « des candidats, mais aucun choisi »
// où le budget ne compterait aucune nuit et où le bandeau photo ne saurait
// quelle adresse montrer. Un défaut visible et déplaçable vaut mieux qu'un
// trou qu'il faut penser à combler.
//
// Les items arrivent triés par `position` (voir api.js) : le premier hôtel de
// la liste est donc bien le premier saisi.
export function chosenHotel(step) {
  const hotels = hotelsOf(step);
  if (hotels.length === 0) return null;

  return (
    hotels.find((hotel) => hotel.booked) ??
    hotels.find((hotel) => hotel.favorite) ??
    hotels[0]
  );
}

// Les autres hôtels de l'étape — ceux que sceller celui-ci emporterait.
//
// Comparés par id et pas par référence : la donnée vient d'un JSON qui peut
// être recopié d'un rendu à l'autre.
export function otherHotels(step, item) {
  return hotelsOf(step).filter((hotel) => hotel.id !== item.id);
}

// Le logement retenu de cette étape est-il celui-ci ? L'étoile d'un hôtel
// s'allume sur cette réponse et pas sur `item.favorite` : sans ça, le retenu
// par défaut — celui du seed, celui qu'on vient de saisir — serait compté au
// budget et nommé dans l'en-tête avec une étoile éteinte sur sa ligne.
export function isChosenHotel(step, item) {
  return item.category === 'hotel' && chosenHotel(step)?.id === item.id;
}
