import { useEffect } from 'react';
import { applyTheme } from '@/theme/themes.js';

// Chaque page déclare la charte qu'elle porte : APP_THEME pour les écrans
// communs, le thème du pays à l'intérieur d'un voyage.
//
// Pourquoi côté page et pas côté routeur : une page qui s'affiche sans passer
// par une route — l'écran de connexion — porterait sinon la charte du dernier
// voyage ouvert. Se déconnecter depuis le Japon laisserait le formulaire en
// rouge. Déclarer la charte là où l'écran est rendu couvre tous les cas sans
// avoir à raisonner sur l'ordre de démontage des composants.
export function useTheme(id) {
  useEffect(() => {
    applyTheme(id);
  }, [id]);
}
