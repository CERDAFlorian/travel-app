// Relier automatiquement un lieu déjà saisi à Google — seulement quand c'est
// sûr (L10, M).
//
// Un lien faux posé en silence est pire qu'un lien absent : l'un se découvre
// sur place, devant une porte close ; l'autre se voit dans l'app, avec son
// « À relier ». La règle est donc prudente, et tout ce qui n'est pas sûr reste
// à relier à la main, avec la recherche de F2.
//
// Sans dépendance : utilisé par scripts/relier-google.mjs, testé ici.

import { haversine } from './geo.js';

// Ce qui décrit un lieu sans le nommer. « JARDIN KENROKUEN » se compare à
// Google comme « Kenrokuen ».
const GENERIC = new Set([
  'jardin', 'temple', 'sanctuaire', 'chateau', 'marche', 'quartier', 'musee', 'parc',
  'hotel', 'cimetiere', 'le', 'la', 'les', 'de', 'du', 'des', 'd', 'l', 'a', 'au', 'aux', 'et',
]);

export function tokens(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

const significant = (list) => list.filter((token) => !GENERIC.has(token));

// Les mots qui nomment vraiment le lieu : « JARDIN KENROKUEN » → ['kenrokuen'].
export function significantTokens(text) {
  return significant(tokens(text));
}

function levenshtein(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

// Une faute d'une lettre sur un mot d'au moins cinq lettres : « anari » pour
// « inari », « studio » pour « studios ». Pas en deçà : « vue » et « view »
// ne sont pas le même mot.
const close = (a, b) => a === b || (Math.min(a.length, b.length) >= 5 && levenshtein(a, b) <= 1);

// Le nom saisi désigne-t-il le lieu que Google propose ?
//
//   · le nom, collé, est le même : « Kenrokuen » / « Kenroku-en » ;
//   · ou il est contenu dans celui de Google, sur au moins cinq lettres :
//     « Disney sea » / « Tokyo DisneySea », « Cimetière okunoin » /
//     « Okuno-in Cemetery » ;
//   · ou chacun de ses mots se retrouve chez Google, à une lettre près :
//     « Fushimi anari » / « Fushimi Inari-taisha ».
export function namesMatch(title, googleName) {
  const all = tokens(title);
  const mine = significant(all);
  const theirs = tokens(googleName);
  if (mine.length === 0 || theirs.length === 0) return false;

  const mineCompact = mine.join('');
  const theirsCompact = theirs.join('');
  if (all.join('') === theirsCompact || mineCompact === significant(theirs).join('')) return true;
  if (mineCompact.length >= 5 && theirsCompact.includes(mineCompact)) return true;
  return mine.every((word) => theirs.some((other) => close(word, other)));
}

// Un item ne se relie jamais à une ville ou une préfecture : « Château
// d'Osaka » réduit à « Osaka » ne doit pas tomber sur la ville.
const AREA_TYPES = new Set(['locality', 'administrative_area_level_1', 'administrative_area_level_2', 'country']);

export const SAME_PLACE_KM = 0.3;
export const MOVED_TOO_FAR_KM = 1;
export const STEP_RADIUS_KM = 50;
export const STEP_MOVED_TOO_FAR_KM = 25;

// Relier un ITEM ? `item` : { title, lat, lng }. `stepCenter` : le centre de son
// étape, ou null. `found` : le premier résultat de Google, { name, lat, lng,
// types }. Rend { link: true } ou { link: false, reason }.
export function decideItem(item, stepCenter, found) {
  if (!found) return { link: false, reason: 'Google ne trouve rien' };

  const current = item.lat != null && item.lng != null ? { lat: Number(item.lat), lng: Number(item.lng) } : null;
  const moved = current ? haversine(current, found) : null;

  // Même endroit, à 300 m près : c'est le même lieu, même si les noms
  // diffèrent — « Pavillon d'or » / « Kinkaku-ji ».
  if (moved != null && moved <= SAME_PLACE_KM) return { link: true, reason: 'même endroit' };

  if ((found.types ?? []).some((type) => AREA_TYPES.has(type))) {
    return { link: false, reason: 'Google propose une ville, pas un lieu' };
  }
  if (!namesMatch(item.title, found.name)) return { link: false, reason: `nom différent : « ${found.name} »` };

  const fromStep = stepCenter ? haversine(stepCenter, found) : null;
  if (fromStep != null && fromStep > STEP_RADIUS_KM) {
    return { link: false, reason: `à ${Math.round(fromStep)} km de l'étape` };
  }
  if (moved != null && moved > MOVED_TOO_FAR_KM) {
    return { link: false, reason: `à ${moved.toFixed(1)} km de sa position actuelle` };
  }
  return { link: true, reason: 'même nom' };
}

// Relier une ÉTAPE ? Le nom doit concorder, et une étape déjà située ne doit
// pas bouger de plus de 25 km : au-delà, c'est une homonyme — la Shirakawa du
// Fukushima pour Shirakawa-gō — et c'est à l'utilisateur de trancher.
export function decideStep(step, found) {
  if (!found) return { link: false, reason: 'Google ne trouve rien' };
  if (!namesMatch(step.name, found.name)) return { link: false, reason: `nom différent : « ${found.name} »` };

  if (step.lat != null && step.lng != null) {
    const moved = haversine({ lat: Number(step.lat), lng: Number(step.lng) }, found);
    if (moved > STEP_MOVED_TOO_FAR_KM) return { link: false, reason: `à ${Math.round(moved)} km de sa position actuelle` };
  }
  return { link: true, reason: 'même nom' };
}
