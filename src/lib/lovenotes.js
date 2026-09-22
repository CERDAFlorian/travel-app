// Mots doux et proverbes glissés dans l'app.
//
// L'app a deux utilisateurs. Celle qui construit le voyage tombe dessus au
// fil de ses actions : poser une ville, situer un lieu, partager l'itinéraire.
// Ce ne sont pas des notifications — rien n'a échoué, rien n'attend de réponse.
//
// Tout est ici, en un seul endroit : changer un texte ne demande de toucher à
// aucun composant. Les proverbes sont japonais parce que ce voyage l'est, mais
// ils parlent d'amour, pas du Japon — ils n'ont donc rien à faire dans un thème
// de pays, qui ne vaut qu'à l'intérieur d'un voyage.

// Proverbes et expressions authentiques. La traduction est libre : « en » ou
// « chigiri » n'ont pas d'équivalent français d'un seul mot.
export const PROVERBS = [
  {
    ja: '縁は異なもの味なもの',
    romaji: 'En wa i na mono aji na mono',
    fr: 'Le lien qui unit deux êtres est chose étrange, et savoureuse.',
  },
  {
    ja: '偕老同穴',
    romaji: 'Kairō dōketsu',
    fr: 'Vieillir ensemble, et reposer dans la même terre.',
  },
  {
    ja: '一期一会',
    romaji: 'Ichigo ichie',
    fr: 'Une seule fois, une seule rencontre — celle-ci ne reviendra pas.',
  },
  {
    ja: '赤い糸で結ばれている',
    romaji: 'Akai ito de musubarete iru',
    fr: 'Reliés par le fil rouge, noué à leurs petits doigts depuis toujours.',
  },
  {
    ja: '鴛鴦の契り',
    romaji: 'Oshidori no chigiri',
    fr: 'Le serment des canards mandarins, qui ne se quittent plus.',
  },
  {
    ja: '雨降って地固まる',
    romaji: 'Ame futte ji katamaru',
    fr: 'Après la pluie, la terre se raffermit. On le dit aux mariés.',
  },
  {
    ja: '二人三脚',
    romaji: 'Nininsankyaku',
    fr: 'Deux personnes, trois jambes : on n’avance qu’au même pas.',
  },
  {
    ja: '相思相愛',
    romaji: 'Sōshi sōai',
    fr: 'Penser l’un à l’autre, s’aimer l’un l’autre.',
  },
  {
    ja: '末永くお幸せに',
    romaji: 'Suenagaku oshiawase ni',
    fr: 'Que votre bonheur dure très longtemps.',
  },
  {
    ja: '縁結び',
    romaji: 'Enmusubi',
    fr: 'Nouer le lien — ce qu’on vient demander aux sanctuaires.',
  },
  {
    ja: '千里の道も一歩から',
    romaji: 'Senri no michi mo ippo kara',
    fr: 'Même la route de mille lieues commence par un pas.',
  },
  {
    // Anecdote, pas une citation : aucun texte de Sōseki ne la contient. Elle
    // se raconte depuis un siècle, et c'est très bien ainsi — mais la formule
    // ci-dessous ne lui attribue pas la phrase, seulement la légende.
    ja: '月が綺麗ですね',
    romaji: 'Tsuki ga kirei desu ne',
    fr: 'La lune est belle, n’est-ce pas ? La légende veut que Natsume Sōseki '
      + 'ait traduit ainsi « je t’aime », trop direct en japonais.',
  },
];

// Mots doux, par moment. Français, courts, sans ponctuation d'exclamation :
// ils passent en coup de vent sous une action qui vient de réussir.
export const WHISPERS = {
  // Une ville vient d'être ajoutée à l'itinéraire.
  step: [
    'Une ville de plus où te tenir la main.',
    'Encore un endroit du monde qui ne nous connaît pas encore.',
    'Tu poses les villes, je porte les valises.',
    'Va pour celle-là. J’irais n’importe où, du moment que tu y es.',
  ],
  // Un hôtel, un restaurant, une visite…
  item: [
    'Bien choisi. Tu as toujours eu l’œil.',
    'Noté. J’ai hâte d’y être avec toi.',
    'Ça nous fera un souvenir de plus.',
    'Encore une chose qu’on fera ensemble pour la première fois.',
  ],
  // Un lieu vient d'être situé sur la carte.
  locate: [
    'Un point de plus sur la carte, un fil de plus entre nous.',
    'Te voilà en train de dessiner nos deux semaines.',
  ],
  // Le lien de partage.
  share: [
    'Montre-leur où on s’en va.',
  ],
  // Préparation hors ligne.
  offline: [
    'Tout est dans ta poche, maintenant. Même sans réseau, on sait où on va.',
  ],
  // Liste de voyages vide, ou voyage sans aucune ville.
  start: [
    'Une page blanche, et toute une vie pour la remplir.',
  ],
};

// Empreinte stable d'une chaîne. Le tirage doit être déterministe : un proverbe
// qui changerait à chaque rendu clignoterait à la moindre frappe au clavier, et
// ne serait pas testable.
function fingerprint(seed) {
  const text = String(seed ?? '');
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

export function proverbFor(seed) {
  return PROVERBS[fingerprint(seed) % PROVERBS.length];
}

// Renvoie null plutôt que de lever : un mot doux qui manque ne doit jamais
// empêcher une ville de s'ajouter.
export function whisperFor(kind, seed) {
  const list = WHISPERS[kind];
  if (!Array.isArray(list) || list.length === 0) return null;
  return list[fingerprint(seed) % list.length];
}
