// Les deux lectures du voyage, en pictogrammes.
//
// Même parti que ChevronIcon et TrashIcon : un tracé et pas un glyphe. Les
// emojis 🗓 et 🏙 se colorent tout seuls selon la plateforme et changent de
// dessin d'un système à l'autre ; un tracé monochrome suit `currentColor`,
// donc l'état actif, et reste net à toutes les tailles.
//
// Dimensionnés en `em` : ils grandissent avec le texte qui les accompagne.

const base = {
  viewBox: '0 0 16 16',
  width: '1.05em',
  height: '1.05em',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: 'false',
};

// Les villes : des épingles sur un fil, comme la colonne des étapes.
export function CitiesIcon() {
  return (
    <svg {...base}>
      <circle cx="3.6" cy="4.2" r="1.5" />
      <circle cx="3.6" cy="11.8" r="1.5" />
      <path d="M3.6 5.7v4.6" />
      <path d="M7.6 4.2h5.8M7.6 11.8h5.8" />
    </svg>
  );
}

// Les jours : une grille de calendrier.
export function DaysIcon() {
  return (
    <svg {...base}>
      <rect x="2.2" y="3.4" width="11.6" height="10.4" rx="1.4" />
      <path d="M2.2 6.6h11.6" />
      <path d="M5.4 2.2v2.2M10.6 2.2v2.2" />
      <path d="M5.2 9.4h1.4M9.4 9.4h1.4M5.2 11.6h1.4M9.4 11.6h1.4" />
    </svg>
  );
}
