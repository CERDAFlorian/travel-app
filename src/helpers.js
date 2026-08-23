// Formatage des prix et des dates, estimation des temps de trajet et
// association d'une photo à un nom de lieu.

import { CITIES, MONTHS, PHOTO_LIB, START, TIMES } from './data.js';

export const uid = (p) => p + '-' + Math.random().toString(36).slice(2, 8);

export const norm = (s) =>
  String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ');

export function imgFor(name) {
  const n = ' ' + norm(name) + ' ';
  for (let i = 0; i < PHOTO_LIB.length; i++) {
    const keys = PHOTO_LIB[i][0];
    for (let j = 0; j < keys.length; j++) if (n.indexOf(keys[j]) >= 0) return PHOTO_LIB[i][1];
  }
  return null;
}

// ---------- prix ----------
export function num(v) {
  if (!v) return 0;
  const c = String(v).replace(/[^0-9.,]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  const n = parseFloat(c);
  return isNaN(n) ? 0 : n;
}

export function eur(n) {
  return n ? new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €' : '—';
}

// ---------- dates ----------
export const fmt = (d) => d.getDate() + ' ' + MONTHS[d.getMonth()];
export const dayAt = (offset) => new Date(START[0], START[1], START[2] + offset);

// ---------- trajets ----------
export function legTime(a, b) {
  if (!a || !b || a === b) return '';
  const k = [a, b].sort().join('|');
  if (TIMES[k]) return 'env. ' + TIMES[k];
  const A = CITIES[a], B = CITIES[b];
  if (!A || !B) return 'à estimer';
  const R = 6371, r = Math.PI / 180;
  const dLat = (B.lat - A.lat) * r, dLon = (B.lon - A.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(A.lat * r) * Math.cos(B.lat * r) * Math.sin(dLon / 2) ** 2;
  const km = 2 * R * Math.asin(Math.sqrt(h)) * 1.25;
  const mins = Math.round((0.55 + km / 170) * 60 / 5) * 5;
  return 'env. ' + (mins >= 60 ? Math.floor(mins / 60) + 'h' + (mins % 60 ? String(mins % 60).padStart(2, '0') : '') : mins + ' min');
}

// ---------- liens externes ----------
export const isApplePlatform = () => /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent || '');

export function mapLink(name, cityName) {
  const q = encodeURIComponent(name + ', ' + cityName + ', Japon');
  return isApplePlatform()
    ? 'https://maps.apple.com/?q=' + q
    : 'https://www.google.com/maps/search/?api=1&query=' + q;
}

export const photoSearchUrl = (name, cityName) =>
  'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(name + ' ' + cityName + ' Japon');

// 3 photos : les lieux étoilés d'abord, puis on complète (lieux, activités, hôtel)
export function featured(list, cats) {
  const stars = list.filter((i) => i.star && cats[i.cat] && cats[i.cat].map).slice(0, 3);
  const out = stars.slice();
  ['lieu', 'activite', 'hotel'].forEach((c) =>
    list.forEach((i) => {
      if (out.length < 3 && i.cat === c && out.indexOf(i) < 0) out.push(i);
    })
  );
  return out.slice(0, 3);
}

// géocodage : nom du lieu + ville → coordonnées réelles (OpenStreetMap)
export async function geocode(name, city) {
  // 1er essai : le nom tel quel ; 2e essai : le lieu-dit après « à / en / au / du »
  const tries = [name];
  const m = name.match(/\s(?:à|en|au|aux|du|de|dans)\s+(.+)$/i);
  if (m && m[1].length > 2) tries.push(m[1]);
  for (let i = 0; i < tries.length; i++) {
    const q = encodeURIComponent(tries[i] + ', ' + city + ', Japon');
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=fr&q=' + q);
    const j = await r.json();
    if (j && j.length) return { lon: parseFloat(j[0].lon), lat: parseFloat(j[0].lat) };
    if (i < tries.length - 1) await new Promise((z) => setTimeout(z, 1100));
  }
  return null;
}
