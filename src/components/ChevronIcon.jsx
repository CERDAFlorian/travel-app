// Chevron d'accordéon.
//
// Un tracé, pas un glyphe. « ▸ » et « ▾ » sont des caractères typographiques :
// leur dessin, leur graisse et leur position sur la ligne de base changent
// d'une police et d'un système à l'autre, et ils ne peuvent pas pivoter en
// douceur. Un SVG suit `currentColor`, garde la même épaisseur partout, et la
// rotation se fait en CSS.
//
// Il pointe toujours vers le bas ; c'est la feuille de style qui le tourne
// d'un quart de tour quand le panneau est replié.
export default function ChevronIcon() {
  return (
    <svg
      className="chevron"
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 6.2 8 10.2 12 6.2" />
    </svg>
  );
}
