// Photos libres de Wikimedia Commons, pour les lieux et les villes (L10).
//
// Google interdit de garder ses photos. Wikimedia, lui, les publie sous
// licence libre : on a le droit de les enregistrer et de les réafficher, à
// condition de citer l'auteur et la licence. La photo d'un lieu se cherche donc
// UNE fois, puis s'enregistre (0012_photos.sql) : 0 € et hors ligne compris.
//
// Le chemin : Wikidata, la base derrière Wikipédia, donne pour un lieu connu
// sa position et sa photo principale (propriété P18) ; Commons donne la
// vignette, l'auteur et la licence. On cherche autour de la VRAIE position du
// lieu — à 3 km pour un lieu, 30 km pour une ville — ce qui écarte presque
// tous les homonymes. Pas de photo plutôt qu'une mauvaise : un doute, et
// l'emplacement reste vide.
//
// Prototype du 25 septembre 2026, éprouvé sur le vrai voyage : 17 lieux sur
// 29 avec une photo juste, dont 14 lieux touristiques sur 19.

import { namesMatch, significantTokens, tokens } from './placeMatch.js';
import { haversine } from './geo.js';

const WIKIDATA = 'https://www.wikidata.org/w/api.php';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
// Wikimedia ne sert que des largeurs standard : 500 existe, 480 non.
const THUMB_WIDTH = 500;
export const RADIUS_KM = { place: 3, hotel: 3, city: 30 };

// Ce qu'un voyageur ne désigne jamais en tapant un nom de lieu : une gare
// homonyme (« Fushimi-Inari »), un événement (« chute du château d'Osaka »).
const NOT_A_PLACE = /\b(station|battle|siege|war|incident|railway)\b/;
// Un quartier, une ville : jamais la photo d'un hôtel.
const AREA = /\b(district|neighbou?rhood|ward|town|city|area|prefecture|street)\b/;

// Les requêtes à essayer, dans l'ordre : le titre tel quel, puis ses morceaux
// (« Okonomiyaki à Okonomi-mura » → « Okonomi-mura »), le plus long d'abord,
// puis sans les mots génériques (« JARDIN KENROKUEN » → « kenrokuen »).
export function queriesFor(title) {
  const parts = String(title)
    .split(/\s*(?:&|,|\s[àa]u?x?\s|\s-\s)\s*/)
    .map((part) => part.trim())
    .filter((part) => significantTokens(part).length > 0)
    .sort((a, b) => b.length - a.length);
  const candidates = [title, ...(parts.length > 1 ? parts : []), significantTokens(title).join(' '), ...parts.map((p) => significantTokens(p).join(' '))];
  const seen = new Set();
  return candidates.filter((query) => {
    const key = query.toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const names = (entity) => [
  ...Object.values(entity.labels ?? {}).map((label) => label.value),
  ...Object.values(entity.aliases ?? {}).flatMap((list) => list.map((alias) => alias.value)),
];

// Qualité de la correspondance entre la requête et un élément Wikidata :
// 2 nom identique, 1 nom concordant (voir placeMatch.namesMatch), 0 aucun.
export function nameScore(query, entity) {
  const wanted = tokens(query).join('');
  let best = 0;
  for (const name of names(entity)) {
    if (tokens(name).join('') === wanted) return 2;
    if (namesMatch(query, name)) best = 1;
  }
  return best;
}

const imageOf = (entity) => entity.claims?.P18?.[0]?.mainsnak?.datavalue?.value ?? null;
const describe = (entity) => entity.descriptions?.en?.value?.toLowerCase() ?? '';

function positionOf(entity) {
  const value = entity.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
  return value?.latitude != null ? { lat: value.latitude, lng: value.longitude } : null;
}

// Le meilleur élément Wikidata pour une requête, ou null. `ids` arrivent dans
// l'ordre de pertinence de Wikidata ; on préfère le nom identique, puis le plus
// proche, puis cet ordre.
export function pickEntity(query, ids, entities, center, { kind = 'place' } = {}) {
  const radius = RADIUS_KM[kind] ?? RADIUS_KM.place;
  const ranked = [];

  ids.forEach((id, rank) => {
    const entity = entities[id];
    if (!entity || !imageOf(entity)) return;
    const description = describe(entity);
    if (NOT_A_PLACE.test(description)) return;
    if (kind === 'hotel' && AREA.test(description)) return;
    const position = positionOf(entity);
    const km = position && center ? haversine(center, position) : null;
    if (km != null && km > radius) return;
    const score = nameScore(query, entity);
    if (score === 0) return;
    ranked.push({ id, file: imageOf(entity), score, km: km ?? radius, rank });
  });

  ranked.sort((a, b) => b.score - a.score || a.km - b.km || a.rank - b.rank);
  return ranked[0] ?? null;
}

// Ce que Commons dit d'un fichier, réduit à ce qu'on enregistre.
export function photoFromImageInfo(info) {
  if (!info?.thumburl) return null;
  const meta = info.extmetadata ?? {};
  const text = (value) => String(value ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return {
    url: info.thumburl,
    credit: text(meta.Artist?.value).slice(0, 120) || null,
    license: text(meta.LicenseShortName?.value) || null,
    page: info.descriptionurl ?? null,
  };
}

// --- réseau -------------------------------------------------------------------

// `origin=*` : l'API de Wikimedia accepte les appels anonymes depuis un
// navigateur. `Api-User-Agent` remplace le User-Agent, qu'un navigateur
// n'a pas le droit de fixer : c'est ce que Wikimedia demande pour savoir qui
// l'appelle.
async function api(base, params) {
  const url = `${base}?${new URLSearchParams({ ...params, format: 'json', origin: '*' })}`;
  const response = await fetch(url, { headers: { 'Api-User-Agent': 'travel-app/1.0 (https://travel.floriancerda.fr)' } });
  if (!response.ok) throw new Error(`Wikimedia a répondu ${response.status}`);
  return response.json();
}

export async function findPhoto({ title, lat, lng, kind = 'place' }) {
  if (!title || lat == null || lng == null) return null;
  const center = { lat: Number(lat), lng: Number(lng) };
  const radius = RADIUS_KM[kind] ?? RADIUS_KM.place;

  for (const query of queriesFor(title)) {
    const search = await api(WIKIDATA, {
      action: 'query',
      list: 'search',
      srlimit: '10',
      srsearch: `${query} haswbstatement:P18 nearcoord:${radius}km,${center.lat},${center.lng}`,
    });
    const ids = (search.query?.search ?? []).map((hit) => hit.title);
    if (ids.length === 0) continue;

    const { entities = {} } = await api(WIKIDATA, {
      action: 'wbgetentities',
      ids: ids.join('|'),
      props: 'labels|aliases|claims|descriptions',
      languages: 'fr|en',
    });
    const best = pickEntity(query, ids, entities, center, { kind });
    if (!best) continue;

    const commons = await api(COMMONS, {
      action: 'query',
      titles: `File:${best.file}`,
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      iiurlwidth: String(THUMB_WIDTH),
    });
    const page = Object.values(commons.query?.pages ?? {})[0];
    return photoFromImageInfo(page?.imageinfo?.[0]);
  }
  return null;
}
