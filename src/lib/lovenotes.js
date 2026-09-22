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
    ja: '愛は無限',
    romaji: 'Ai wa mugen',
    fr: 'L\u2019amour est sans limite.',
  },
  {
    ja: '一蓮托生',
    romaji: 'Ichiren takushō',
    fr: 'Portés par le même lotus — quoi qu\u2019il advienne, le même sort.',
  },
  {
    ja: '比翼連理',
    romaji: 'Hiyoku renri',
    fr: 'Deux oiseaux d\u2019une seule aile, deux arbres d\u2019une seule branche : '
      + 'ils ne volent, ils ne poussent, qu\u2019ensemble.',
  },
  {
    ja: '袖振り合うも多生の縁',
    romaji: 'Sode furiau mo tashō no en',
    fr: 'Même deux manches qui se frôlent tiennent d\u2019un lien ancien.',
  },
  {
    ja: '恋に上下の隔てなし',
    romaji: 'Koi ni jōge no hedate nashi',
    fr: 'L\u2019amour ne connaît ni rang ni distance.',
  },
  {
    ja: '愛屋烏に及ぶ',
    romaji: 'Aioku karasu ni oyobu',
    fr: 'Qui aime la maison finit par aimer jusqu\u2019aux corbeaux sur son toit.'
      + ' On aime quelqu\u2019un avec tout ce qui vient avec.',
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
    'Celle-là, c’est toi qui l’as trouvée. Comme d’habitude.',
    'Une ville de plus, une nuit de plus contre toi.',
    'Je ne sais pas ce qu’on y fera. Je sais avec qui.',
    'Où tu veux. Vraiment, où tu veux.',
    'Tu dessines nos journées. Moi je te regarde faire, et je t’aime.',
    'Je t’aime. C’était juste pour le dire, profite qu’on en soit là.',
    'Cette ville ne sait pas encore la chance qu’elle a.',
    'On va s’y perdre tous les deux. C’est tout ce que je demande.',
    'Chaque ville que tu ajoutes, c’est un jour de plus rien qu’à nous.',
    'Ma vie a commencé avec toi. Le reste, ce sont des voyages.',
  ],
  // Un hôtel, un restaurant, une visite…
  item: [
    'Bien choisi. Tu as toujours eu l’œil.',
    'Noté. J’ai hâte d’y être avec toi.',
    'Encore une chose qu’on fera ensemble pour la première fois.',
    'Je nous y vois déjà, tous les deux.',
    'Si c’est toi qui le choisis, c’est que ce sera bien.',
    'Celui-là, on s’en souviendra dans vingt ans.',
    'Ajouté. Et moi je t’ajoute un baiser.',
    'Ce sera notre endroit, maintenant.',
    'Tu prépares tout ça avec tant de soin. Je t’aime pour ça aussi.',
    'Je t’aime, tiens. Ça n’a rien à voir, et pourtant si.',
    'Dix mille kilomètres pour un dîner avec toi. Ça les vaut largement.',
    'Tu ne le sais pas, mais tu es en train de me rendre très heureux.',
    'Je regarderai ça, et je te regarderai le regarder.',
    'Avec toi, même la file d’attente sera un bon souvenir.',
    'Merci de faire de nos vies quelque chose d’aussi joli.',
  ],
  // Un lieu vient d'être situé sur la carte.
  locate: [
    'Un point de plus sur la carte, un fil de plus entre nous.',
    'Te voilà en train de dessiner nos deux semaines.',
    'Épinglé. Comme le jour où tu m’as épinglé, moi.',
    'La carte se remplit. Ma vie aussi, depuis toi.',
    'Où que ce soit sur cette carte, mon nord c’est toi.',
    'Tu sais toujours où on va. C’est bien pratique, je t’aime.',
  ],
  // Le lien de partage.
  share: [
    'Montre-leur où on s’en va. Ils ne sauront pas à quel point on est bien.',
    'Partage l’itinéraire. Le reste, c’est entre nous.',
    'Ils verront le voyage. Ils ne verront pas comme je te regarde.',
  ],
  // Préparation hors ligne.
  offline: [
    'Tout est dans ta poche, maintenant. Même sans réseau, on sait où on va.',
    'Plus besoin d’antenne. On a tout ce qu’il faut : l’itinéraire, et toi.',
    'Sans réseau, sans repères, sans un mot de japonais. Avec toi, ça ira.',
  ],
  // Liste de voyages vide, ou voyage sans aucune ville.
  start: [
    'Une page blanche, et toute une vie pour la remplir.',
  ],
  // Écran de connexion — la première chose qu'elle lit en ouvrant l'app.
  welcome: [
    'Te revoilà. Notre voyage t’attendait, et moi aussi.',
    'Bonjour toi. Le Japon n’a pas bougé, mon amour non plus.',
    'Reviens quand tu veux. C’est chez toi, ici comme ailleurs.',
  ],
  // Le vol du retour, dans le panneau des vols.
  comeback: [
    'Le seul vol qu’on prendra à regret.',
    'On rentrera. Mais on rentrera à deux, et c’est déjà tout.',
  ],
  // Bandeau pagode — la grande ligne, puis la ligne du dessous.
  hero: [
    'Notre voyage de noces',
    'Le premier voyage de notre vie à deux',
    'Deux alliances et un aller simple pour le bonheur',
  ],
  heroSub: [
    'Tout ce qu’on s’est promis, on va le vivre là-bas.',
    'Un itinéraire pour deux, écrit à quatre mains.',
    'Le début de tout, à dix mille kilomètres d’ici.',
  ],
  // Panneau des billets d'avion. Le tirage est seme par l'identifiant du
  // voyage : une seule de ces lignes s'affichera, toujours la meme. Elles
  // disent donc toutes la meme chose, chacune a sa facon.
  flights: [
    'Les deux places les plus amoureuses de l’avion',
    'Tout l’amour de cet avion tiendra sur deux sièges',
    'Nulle part ailleurs dans cet avion on ne s’aimera autant',
  ],
  // Temps de trajet entre deux villes.
  travel: [
    'Le temps qu’on passera côte à côte',
    'Des heures de train, ta tête sur mon épaule',
  ],
  // Le nombre de nuits d'une étape vient de changer. Ces messages-là tiennent
  // sur UNE ligne sous le nom de la ville, en petit : ils accompagnent un clic
  // sur « + », ils ne doivent pas s'installer. D'où la limite de 40 signes,
  // que lovenotes.test.js verrouille.
  nights: [
    'Une nuit de plus contre toi.',
    'Reste. Je suis bien, là.',
    'Un matin de plus à te réveiller.',
    'Une nuit de gagnée sur le retour.',
    'Bonne idée. Ne rentrons jamais.',
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

// Compte à rebours avant le départ.
//
// Il tient la place du sous-titre en en-tête : c'est la première chose qu'elle
// lit en ouvrant le voyage, et la seule ligne qui change toute seule.
//
// Deux parties : le décompte, puis la phrase. Elles se lisent l'une sous
// l'autre, la seconde prolongeant la première — « Dans 47 jours » n'est pas
// une phrase, c'est le début de celle du dessous.
const LIGNES = [
  'sous le ciel du Japon : toi et moi, encore et toujours. 🇯🇵❤️',
  'nous partons célébrer ce « nous » que je choisirais encore mille fois. ❤️',
  'Commence à rêver… moi, j’ai déjà commencé. ❤️',
  'J’ai déjà le cœur qui décolle. ❤️',
];

// Le jour du départ a sa propre phrase : les quatre autres se lisent comme la
// suite d'un décompte, et il n'y a plus rien à décompter.
const JOUR_J = 'Prends ma main et ne la lâche plus. 🇯🇵❤️';

// « Dans 1 jours » n'existe pas, et « Dans 0 jours » encore moins. Les deux
// derniers jours ont donc leur propre tête de phrase.
function compte(days) {
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return 'Demain';
  return `Dans ${days} jours`;
}

// Renvoie { compte, ligne }, ou null une fois le voyage commencé : compter les
// jours n'a plus de sens quand on y est. `today` est injectable pour que le
// test ne dépende pas du jour où il tourne.
export function countdown(startIso, today = new Date()) {
  if (!startIso) return null;
  const [year, month, day] = String(startIso).split('-').map(Number);
  if (!year || !month || !day) return null;

  // Minuit local des deux côtés : comparer une date nue à un instant ferait
  // basculer le compte selon l'heure de la journée.
  const departure = new Date(year, month - 1, day);
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((departure - now) / 86400000);
  if (days < 0) return null;

  // Le reste du nombre de jours, pas une empreinte : l'empreinte faisait
  // tomber plusieurs jours d'affilée sur la même ligne. Le modulo garantit
  // qu'on alterne chaque matin.
  if (days === 0) return { compte: compte(0), ligne: JOUR_J };
  return { compte: compte(days), ligne: LIGNES[days % LIGNES.length] };
}
