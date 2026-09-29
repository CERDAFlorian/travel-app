import { categoryOf } from './categories.js';
import { chosenHotel } from './lodging.js';

// Le bandeau de 3 tuiles d'une étape.
//
// Il n'y a plus de photos : la bibliothèque d'images appariées par mots-clés
// servait la démo et a été retirée (septembre 2026). Elle mettait la photo du
// Kenrokuen sur un item introuvable, et celle de Higashi Chaya (Kanazawa) sur
// un hôtel à Higashiyama (Kyoto). Reste le choix des items qui occupent les
// trois places — il vaudra pour la source de photos qui viendra ensuite.

// Les 3 items mis en avant dans le bandeau d'une étape : les favoris d'abord —
// à condition d'être d'une catégorie géographique, ce qui écarte les notes —
// puis on complète avec des lieux, des activités, l'hôtel, dans cet ordre.
//
// L'HÔTEL EST ÉCARTÉ DE LA PASSE DES FAVORIS. Son étoile ne dit pas « ce lieu
// illustre la ville » mais « c'est le logement retenu » (voir lib/lodging.js).
// Sans cette exclusion, chaque étape pousserait une photo de chambre devant
// Fushimi Inari.
//
// Il reste en complément de fin de liste — une étape sans lieu ni activité
// vaut mieux avec son hôtel qu'avec un trou —, mais alors UN SEUL : celui
// qu'on a retenu. Trois adresses en lice ne sont pas trois séjours, et montrer
// la photo d'un candidat qu'on n'a pas choisi donnerait le change.
export function featured(items) {
  const chosen = items.filter(
    (item) => item.favorite && item.category !== 'hotel' && categoryOf(item.category)?.onMap,
  );

  for (const category of ['lieu', 'activite']) {
    for (const item of items) {
      if (chosen.length >= 3) break;
      if (item.category === category && !chosen.includes(item)) chosen.push(item);
    }
  }

  const hotel = chosenHotel({ items });
  if (chosen.length < 3 && hotel) chosen.push(hotel);

  return chosen.slice(0, 3);
}
