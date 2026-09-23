import { createContext, useContext } from 'react';

// Les mots doux sont-ils permis ici ?
//
// L'app est parsemée de mots d'amour : le compte à rebours de l'en-tête, les
// deux lignes du bandeau, le titre des temps de trajet, ceux du panneau des
// vols, le proverbe du pied de page. Ils sont écrits pour DEUX personnes, et
// un itinéraire envoyé à la famille ne doit pas les afficher.
//
// UN CONTEXTE PLUTÔT QU'UNE PROP. Sept textes vivent dans six composants, dont
// certains à trois niveaux de profondeur : les atteindre par des props
// obligerait à traverser des composants qui n'ont rien à voir avec la question,
// et le prochain mot doux ajouté ailleurs rouvrirait la fuite sans que personne
// ne s'en aperçoive. Ici, il suffit d'appeler le hook.
//
// LE DÉFAUT EST `true`, et c'est voulu : hors d'un voyage partagé — la liste
// des voyages, l'écran de connexion, la préparation hors ligne — on est chez
// soi, et les mots doivent rester. C'est le partage qui fait exception, pas
// l'inverse.
//
// La coupure se fait sur `shared` et NON sur `readOnly` : hors ligne dans un
// train japonais, l'app est en lecture seule et on est toujours à deux.
const LoveNotesContext = createContext(true);

export const LoveNotesProvider = LoveNotesContext.Provider;

export function useLoveNotes() {
  return useContext(LoveNotesContext);
}
