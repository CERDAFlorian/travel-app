// Corbeille, en SVG plutôt qu'en emoji.
//
// 🗑 se colore tout seul selon la plateforme et change de dessin d'un système
// à l'autre. Un tracé monochrome suit `currentColor`, donc le rouge au survol
// et l'état désactivé, et reste net à toutes les tailles.
//
// Dimensionnée en `em` : elle grandit avec le texte du bouton qui la porte.
export default function TrashIcon() {
  return (
    <svg
      className="trash"
      viewBox="0 0 16 16"
      width="1.15em"
      height="1.15em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2.6 4.1h10.8" />
      <path d="M6.2 4.1V2.7h3.6v1.4" />
      <path d="M4.1 4.1l.6 8.5a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9l.6-8.5" />
      <path d="M6.6 6.6v4.4M9.4 6.6v4.4" />
    </svg>
  );
}
