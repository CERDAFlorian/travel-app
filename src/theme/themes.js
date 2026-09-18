// Registre JS des thèmes — pendant de $themes dans _emit.scss.
// Consommé par la bascule ci-dessous et, plus tard, par le sélecteur de thème
// de la page « nouveau voyage » et les pastilles de la liste des voyages.
// Un thème ajouté en SCSS doit être ajouté ici : les deux listes vont de pair.

export const THEMES = [
  {
    id: 'japan',
    label: 'Japon',
    preview: ['#8f1d24', '#f8ecd9'],
  },
  {
    id: 'neutral',
    label: 'Neutre',
    preview: ['#2f5d8c', '#f6f7f8'],
  },
];

// Charte de l'application : connexion, liste des voyages, création d'un voyage.
// Distincte des thèmes pays, qui n'habillent que l'intérieur d'un voyage.
// Sert aussi de repli quand trips.theme porte une valeur inconnue.
export const APP_THEME = 'neutral';

export function isKnownTheme(id) {
  return THEMES.some((theme) => theme.id === id);
}

// Applique un thème à <html>. La valeur vient de trips.theme ; un thème inconnu
// retombe sur la charte de l'app plutôt que de laisser la page sans couleurs.
//
// À n'appeler qu'en entrant dans un voyage, et à rappeler avec APP_THEME en
// sortant : hors d'un voyage, l'app porte sa propre charte.
export function applyTheme(id) {
  const resolved = isKnownTheme(id) ? id : APP_THEME;
  document.documentElement.dataset.theme = resolved;
  return resolved;
}
