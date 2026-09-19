import { categoryOf } from './categories.js';

// Appariement photo ↔ item, transposé du design (.dc.html, PHOTO_LIB et
// featured(), lignes 365-420).
//
// Le design contient aussi une table PHOTOS qui fige 3 photos par ville. Elle
// n'est appelée nulle part : c'est du code mort, et la reprendre aurait figé le
// Japon dans un composant censé servir tous les voyages.
//
// Les chemins pointent vers /img/*.webp : les PNG de design/img/ ne sont jamais
// servis, `npm run img` les compresse vers public/img/.
export const PHOTO_LIB = [
  [['asakusa', 'senso'], 'asakusa'],
  [['shibuya'], 'shibuya'],
  [['skytree'], 'skytree'],
  [['fushimi', 'inari'], 'fushimi'],
  [['pavillon d or', 'kinkaku'], 'kinkakuji'],
  [['arashiyama', 'bambou'], 'arashiyama'],
  [['genbaku'], 'genbaku'],
  [['chateau d hiroshima'], 'hiroshima-chateau'],
  [['okonomiyaki'], 'okonomiyaki'],
  [['chateau d osaka'], 'osaka-chateau'],
  [['dotonbori', 'kuromon'], 'dotonbori'],
  [['universal'], 'universal'],
  [['sushi', 'toyosu', 'tsukiji'], 'sushi'],
  [['chateau de matsumoto'], 'matsumoto-chateau'],
  [['alpes', 'kamikochi'], 'alpes'],
  [['narai', 'nakasendo'], 'narai'],
  [['shirakawa', 'gassho'], 'shirakawago'],
  [['onsen', 'ryokan'], 'onsen'],
  [['shiroyama', 'vallee'], 'shirakawago2'],
  [['miyajima', 'torii', 'itsukushima'], 'torii'],
  [['cerf'], 'cerf'],
  [['daisho'], 'daishoin'],
  [['koyasan', 'okunoin'], 'okunoin'],
  [['kongobu'], 'kongobuji'],
  [['shojin'], 'shojin'],
  [['kenrokuen'], 'kenrokuen'],
  [['higashi', 'chaya'], 'higashi-chaya'],
  [['disney'], 'disney'],
  [['sumo', 'ryogoku'], 'sumo'],
  [['illumination'], 'illuminations'],
  [['matcha', 'the '], 'matcha'],
  [['baguette'], 'baguettes'],
  [['vue sur tokyo', 'vue de tokyo'], 'tokyo-vue'],
];

// Six images de la table ne sont pas encore exportées du canvas. Les déclarer
// ici évite d'afficher une tuile cassée : l'item tombe sur le repli, comme s'il
// n'avait pas de correspondance. Retirer une entrée de cette liste le jour où
// le PNG arrive dans design/img/.
export const MISSING = new Set(['sushi', 'sumo', 'shirakawago2', 'narai', 'matcha', 'baguettes']);

// Minuscules, accents retirés, tout ce qui n'est pas alphanumérique réduit à un
// espace. « Pavillon d'or » et « pavillon d or » doivent matcher la même entrée.
function normalize(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ');
}

// Première correspondance gagnante, comme dans le design : l'ordre de
// PHOTO_LIB fait office de priorité.
export function imageFor(title) {
  const haystack = ` ${normalize(title)} `;

  for (const [keywords, name] of PHOTO_LIB) {
    if (keywords.some((keyword) => haystack.includes(keyword))) {
      return MISSING.has(name) ? null : `/img/${name}.webp`;
    }
  }
  return null;
}

// Les 3 items mis en avant dans le bandeau d'une étape : les favoris d'abord —
// à condition d'être d'une catégorie géographique, ce qui écarte les notes —
// puis on complète avec des lieux, des activités, l'hôtel, dans cet ordre.
export function featured(items) {
  const chosen = items.filter(
    (item) => item.favorite && categoryOf(item.category)?.onMap,
  );

  for (const category of ['lieu', 'activite', 'hotel']) {
    for (const item of items) {
      if (chosen.length >= 3) break;
      if (item.category === category && !chosen.includes(item)) chosen.push(item);
    }
  }

  return chosen.slice(0, 3);
}

// Une même image ne doit pas apparaître deux fois dans un bandeau : deux items
// « château » d'une même étape retomberaient sur la même photo.
export function photoStripFor(items) {
  const used = new Set();

  return featured(items).map((item) => {
    let src = imageFor(item.title);
    if (src && used.has(src)) src = null;
    else if (src) used.add(src);
    return { id: item.id, title: item.title, src };
  });
}
