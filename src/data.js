// Données de référence de l'itinéraire : catégories, villes, temps de trajet,
// bibliothèque de photos et contenu d'origine du voyage.

export const STORAGE_KEY = 'japon-itin-v3';
export const START = [2026, 10, 7]; // 7 novembre 2026
export const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export const CATS = {
  hotel: { label: 'Hôtel', color: '#2c5271', ph: "Nom de l'hôtel…", map: true, budget: true },
  activite: { label: 'Activités', color: '#3f6b4a', ph: 'Une activité…', map: true, budget: true },
  resto: { label: 'Restaurants', color: '#b4621f', ph: 'Un restaurant…', map: true, budget: false },
  shopping: { label: 'Shopping', color: '#6b3f6e', ph: 'Une boutique, un quartier…', map: true, budget: false },
  lieu: { label: 'Lieux touristiques', color: '#1f6f74', ph: 'Un lieu à voir…', map: true, budget: true },
  note: { label: 'Notes perso', color: '#8a6a2f', ph: 'Une note à retenir…', map: false, budget: false }
};

export const CAT_KEYS = Object.keys(CATS);

export const CITIES = {
  tokyo: { name: 'Tokyo', lon: 139.69, lat: 35.68, lx: 23, ly: -6 },
  yokohama: { name: 'Yokohama', lon: 139.64, lat: 35.44, lx: 20, ly: 16 },
  kamakura: { name: 'Kamakura', lon: 139.55, lat: 35.32, lx: 16, ly: 20 },
  hakone: { name: 'Hakone', lon: 139.03, lat: 35.23, lx: 0, ly: 24, anchor: 'middle' },
  kawaguchiko: { name: 'Fuji-Kawaguchiko', short: 'Kawaguchiko', lon: 138.76, lat: 35.50, lx: 0, ly: -16, anchor: 'middle' },
  nikko: { name: 'Nikkō', lon: 139.60, lat: 36.75, lx: 18, ly: -8 },
  matsumoto: { name: 'Matsumoto & Alpes japonaises', short: 'Matsumoto', lon: 137.97, lat: 36.24, lx: 0, ly: 28, anchor: 'middle' },
  nagano: { name: 'Nagano', lon: 138.19, lat: 36.65, lx: 18, ly: -8 },
  takayama: { name: 'Takayama', lon: 137.25, lat: 36.14, lx: 16, ly: 18 },
  shirakawa: { name: 'Shirakawa-go', lon: 136.90, lat: 36.26, lx: -18, ly: -16, anchor: 'end' },
  kanazawa: { name: 'Kanazawa', lon: 136.65, lat: 36.56, lx: -18, ly: -6, anchor: 'end' },
  toyama: { name: 'Toyama', lon: 137.21, lat: 36.70, lx: 16, ly: -8 },
  nagoya: { name: 'Nagoya', lon: 136.91, lat: 35.18, lx: 16, ly: 16 },
  ise: { name: 'Ise', lon: 136.71, lat: 34.49, lx: 14, ly: 16 },
  kyoto: { name: 'Kyoto', lon: 135.77, lat: 35.01, oy: -9, lx: 21, ly: 5 },
  nara: { name: 'Nara', lon: 135.83, lat: 34.69, ox: 16, oy: 16, lx: 14, ly: 12 },
  osaka: { name: 'Osaka', lon: 135.50, lat: 34.69, ox: -11, oy: 11, lx: -19, ly: 6, anchor: 'end' },
  kobe: { name: 'Kobe', lon: 135.19, lat: 34.69, lx: -16, ly: 16, anchor: 'end' },
  himeji: { name: 'Himeji', lon: 134.69, lat: 34.82, lx: 0, ly: -14, anchor: 'middle' },
  okayama: { name: 'Okayama', lon: 133.92, lat: 34.66, lx: 0, ly: 20, anchor: 'middle' },
  hiroshima: { name: 'Hiroshima', lon: 132.46, lat: 34.39, lx: -21, ly: -5, anchor: 'end' },
  fukuoka: { name: 'Fukuoka', lon: 130.40, lat: 33.59, lx: 16, ly: 12 },
  beppu: { name: 'Beppu', lon: 131.49, lat: 33.28, lx: 14, ly: 14 },
  kumamoto: { name: 'Kumamoto', lon: 130.71, lat: 32.80, lx: 14, ly: 14 },
  sendai: { name: 'Sendai', lon: 140.87, lat: 38.27, lx: -16, ly: -6, anchor: 'end' }
};

export const TIMES = {
  'matsumoto|tokyo': '2h40', 'matsumoto|shirakawa': '3h30', 'kyoto|shirakawa': '3h30',
  'hiroshima|kyoto': '1h45', 'hiroshima|osaka': '1h30', 'osaka|tokyo': '2h30', 'kyoto|tokyo': '2h20',
  'kyoto|osaka': '30 min', 'nara|osaka': '45 min', 'kyoto|nara': '45 min', 'nikko|tokyo': '2h',
  'hakone|tokyo': '1h30', 'kamakura|tokyo': '1h', 'kanazawa|kyoto': '2h', 'kanazawa|shirakawa': '1h15',
  'shirakawa|takayama': '50 min', 'kyoto|nagoya': '35 min', 'nagoya|tokyo': '1h40', 'fukuoka|hiroshima': '1h05',
  'okayama|osaka': '45 min', 'hiroshima|okayama': '35 min', 'sendai|tokyo': '1h35', 'kobe|osaka': '30 min',
  'himeji|osaka': '30 min', 'kanazawa|toyama': '25 min', 'kawaguchiko|tokyo': '2h', 'tokyo|yokohama': '30 min',
  'matsumoto|nagano': '50 min', 'beppu|fukuoka': '2h', 'fukuoka|kumamoto': '40 min', 'ise|kyoto': '2h',
  'kanazawa|osaka': '2h35', 'matsumoto|nagoya': '2h', 'kyoto|takayama': '3h30', 'nagoya|takayama': '2h20'
};

// bibliothèque de photos indexée par mots-clés du nom de lieu
export const PHOTO_LIB = [
  [['asakusa', 'senso'], '/img/asakusa.png'], [['shibuya'], '/img/shibuya.png'], [['skytree'], '/img/skytree.png'],
  [['fushimi', 'inari'], '/img/fushimi.png'], [['pavillon d or', 'kinkaku'], '/img/kinkakuji.png'],
  [['arashiyama', 'bambou'], '/img/arashiyama.png'], [['genbaku'], '/img/genbaku.png'],
  [['chateau d hiroshima'], '/img/hiroshima-chateau.png'], [['okonomiyaki'], '/img/okonomiyaki.png'],
  [['chateau d osaka'], '/img/osaka-chateau.png'], [['dotonbori', 'kuromon'], '/img/dotonbori.png'],
  [['universal'], '/img/universal.png'], [['sushi', 'toyosu', 'tsukiji'], '/img/sushi.png'],
  [['chateau de matsumoto'], '/img/matsumoto-chateau.png'], [['alpes', 'kamikochi'], '/img/alpes.png'],
  [['narai', 'nakasendo'], '/img/narai.png'], [['shirakawa', 'gassho'], '/img/shirakawago.png'],
  [['onsen', 'ryokan'], '/img/onsen.png'], [['shiroyama', 'vallee'], '/img/shirakawago2.png'],
  [['miyajima', 'torii', 'itsukushima'], '/img/torii.png'], [['cerf'], '/img/cerf.png'], [['daisho'], '/img/daishoin.png'],
  [['koyasan', 'okunoin'], '/img/okunoin.png'], [['kongobu'], '/img/kongobuji.png'], [['shojin'], '/img/shojin.png'],
  [['kenrokuen'], '/img/kenrokuen.png'], [['higashi', 'chaya'], '/img/higashi-chaya.png'],
  [['disney'], '/img/disney.png'],
  [['sumo', 'ryogoku'], '/img/sumo.png'], [['illumination'], '/img/illuminations.png'],
  [['matcha', 'the '], '/img/matcha.png'], [['baguette'], '/img/baguettes.png'],
  [['vue sur tokyo', 'vue de tokyo'], '/img/tokyo-vue.png']
];

export const EXPERIENCES = [
  { bg: "url('/img/baguettes.png')", name: 'Création de baguettes', text: 'Atelier artisanal : repartez avec vos propres baguettes.', where: 'Tokyo ou Kyoto' },
  { bg: "url('/img/sumo.png')", name: 'Combat de sumo', text: 'Entraînement du matin ou tournoi dans une salle mythique.', where: 'Tokyo · Ryōgoku' },
  { bg: "url('/img/matcha.png')", name: 'Atelier matcha', text: 'Cérémonie du thé et gestes traditionnels.', where: 'Kyoto' },
  { bg: "url('/img/sushi.png')", name: 'Expérience sushi', text: 'Atelier ou dégustation dans un cadre authentique.', where: 'Osaka ou Tokyo' }
];

export function seedSteps() {
  return [
    { id: 's1', city: 'tokyo', nights: 2 }, { id: 's2', city: 'matsumoto', nights: 1 },
    { id: 's3', city: 'shirakawa', nights: 1 }, { id: 's4', city: 'kyoto', nights: 4 },
    { id: 's5', city: 'hiroshima', nights: 2 }, { id: 's6', city: 'osaka', nights: 3 },
    { id: 's7', city: 'tokyo', nights: 6 }
  ];
}

export function seedFlights() {
  return [
    { id: 'fl-aller', label: 'Aller', route: 'Paris CDG → Tokyo Haneda', date: '7 nov. 2026', flight: 'vol à confirmer', price: '' },
    { id: 'fl-retour', label: 'Retour', route: 'Tokyo Haneda → Paris CDG', date: '26 nov. 2026', flight: 'vol à confirmer', price: '' }
  ];
}

export function seedItems() {
  const m = (cat, name, meta, geo) =>
    Object.assign({ id: cat + '-' + Math.random().toString(36).slice(2, 7), cat, name, meta: meta || '', price: '' }, geo || {});
  return {
    s1: [
      m('hotel', 'Hôtel à Asakusa', '2 nuits'),
      m('activite', 'Distillerie Hakushu', 'sur la route · détour 2h', { lon: 138.31, lat: 35.79, ox: 16, oy: -40 }),
      m('activite', 'Balade Asakusa & Nakamise', ''),
      m('resto', 'Izakaya à Shinjuku', ''),
      m('lieu', 'Temple Sensō-ji', ''),
      m('lieu', 'Shibuya Crossing', ''),
      m('note', "Récupérer le JR Pass à l'aéroport", '')
    ],
    s2: [
      m('hotel', 'Ryokan avec onsen', '1 nuit'),
      m('lieu', 'Château de Matsumoto', ''),
      m('activite', 'Narai-juku, route du Nakasendō', ''),
      m('resto', 'Soba de Shinshū', ''),
      m('note', 'Prévoir des vêtements chauds', '')
    ],
    s3: [
      m('hotel', 'Nuit en maison gasshō-zukuri', '1 nuit'),
      m('lieu', 'Point de vue de Shiroyama', ''),
      m('activite', 'Balade dans le village', ''),
      m('resto', 'Bœuf de Hida', '')
    ],
    s4: [
      m('hotel', 'Machiya à Gion', '4 nuits'),
      m('lieu', 'Fushimi Inari', ''), m('lieu', "Pavillon d'or", ''), m('lieu', 'Arashiyama & bambouseraie', ''),
      m('activite', 'Atelier matcha', ''),
      m('resto', 'Marché Nishiki', ''), m('resto', 'Dîner kaiseki', ''),
      m('shopping', 'Teramachi', ''),
      m('note', 'Réserver le kaiseki avant le départ', '')
    ],
    s5: [
      m('hotel', 'Hôtel centre-ville', '2 nuits'),
      m('activite', 'Miyajima & torii flottant', 'env. 45 min', { lon: 132.32, lat: 34.30, ox: -12, oy: 16, thumb: '/img/torii.png' }),
      m('lieu', 'Mémorial de la Paix', ''), m('lieu', 'Dôme de Genbaku', ''),
      m('resto', 'Okonomiyaki à Okonomi-mura', ''),
      m('note', 'Ferry inclus dans le JR Pass', '')
    ],
    s6: [
      m('hotel', 'Hôtel à Namba', '3 nuits'),
      m('activite', 'Universal Studios Japan', 'env. 30 min', { lon: 135.43, lat: 34.67, ox: -46, oy: -4, thumb: '/img/universal.png' }),
      m('activite', 'Kōyasan', 'env. 2h30', { lon: 135.58, lat: 34.21, ox: 8, oy: 24, thumb: '/img/okunoin.png' }),
      m('lieu', "Château d'Osaka", ''),
      m('resto', 'Street food à Dōtonbori', ''), m('resto', 'Marché Kuromon', ''),
      m('shopping', 'Shinsaibashi', ''),
      m('note', 'Billets Universal à réserver', '')
    ],
    s7: [
      m('hotel', 'Hôtel à Shinjuku', '6 nuits'),
      m('activite', 'Tokyo Disneyland', 'env. 40 min', { lon: 139.88, lat: 35.63, ox: 26, oy: 28, thumb: '/img/disney.png' }),
      m('activite', 'Sumo à Ryōgoku', ''), m('activite', 'Atelier baguettes', ''),
      m('resto', 'Sushi au marché de Toyosu', ''),
      m('shopping', 'Ginza', ''), m('shopping', 'Akihabara', ''),
      m('lieu', "Illuminations d'automne", ''),
      m('note', 'Derniers souvenirs', '')
    ]
  };
}
