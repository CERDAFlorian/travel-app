import './NightsGap.scss';

// Écart entre les nuits planifiées et la fenêtre imposée par les vols.
//
// Sa place est ICI, entre les vols et la première étape : il parle des nuits
// d'hôtel, pas des billets. Dans l'encart des vols il donnait à croire qu'un
// vol était en cause.
//
// On ne corrige rien d'autorité : répartir des nuits est une décision de
// voyage, pas une erreur à redresser.
export default function NightsGap({ gap }) {
  if (gap == null || gap === 0) return null;

  const nights = Math.abs(gap);
  const plural = nights > 1 ? 's' : '';

  return (
    <p className="nights-gap" data-over={gap < 0 || undefined} role="status">
      {gap > 0
        ? `${nights} nuit${plural} encore à placer avant le vol retour`
        : `${nights} nuit${plural} de trop : le séjour dépasse le vol retour`}
    </p>
  );
}
