// Le lien d'un restaurant : la vidéo TikTok, le post Instagram, le site, la
// fiche Tabelog où on l'a trouvé (Florian, 7 nov. 2026).
//
// On n'en extrait rien — Instagram ne se lit pas sans compte, et TikTok ne
// donne que la légende. Le nom se tape, la recherche Google trouve le lieu ;
// le lien sert à retrouver ce qui a donné envie d'y aller.

// L'adresse telle qu'on l'enregistre, ou null. Un lien copié depuis une appli
// arrive parfois sans « https:// » ; tout autre protocole est refusé — un
// « javascript: » collé deviendrait un lien piégé.
export function normalizeUrl(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;

  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!url.hostname.includes('.')) return null;
    return url.href;
  } catch {
    return null;
  }
}

const SITES = [
  [/(^|\.)tiktok\.com$/, 'TikTok'],
  [/(^|\.)instagram\.com$/, 'Instagram'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'],
  [/(^|\.)tabelog\.com$/, 'Tabelog'],
];

// Ce que dit la pastille : le réseau quand on le connaît, sinon le domaine.
export function linkLabel(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    for (const [pattern, label] of SITES) if (pattern.test(host)) return label;
    return host;
  } catch {
    return 'Lien';
  }
}
