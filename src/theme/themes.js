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

export const DEFAULT_THEME = 'japan';

export function isKnownTheme(id) {
  return THEMES.some((theme) => theme.id === id);
}

// Applique un thème à <html>. La valeur vient de trips.theme (colonne prévue
// en L1) ; un thème inconnu retombe sur le thème par défaut plutôt que de
// laisser la page sans couleurs.
export function applyTheme(id) {
  const resolved = isKnownTheme(id) ? id : DEFAULT_THEME;
  document.documentElement.dataset.theme = resolved;
  return resolved;
}
