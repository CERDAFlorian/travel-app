#!/usr/bin/env node
// Relier à Google ce qui a déjà été saisi — seulement quand c'est sûr (L10, M).
//
//   node scripts/relier-google.mjs <export.json>
//
// <export.json> : le JSON rendu par supabase/outils/export-voyage.sql. Le
// script ne parle à AUCUNE base : il lit l'export, interroge Google, et écrit
// à côté de l'export un fichier SQL de liens sûrs — à passer à la main dans le
// SQL Editor, sur dev d'abord, puis sur la prod, comme toute migration. Rien
// n'est automatique, fidèle à L8.
//
// Les étapes d'abord : une étape reliée donne à ses lieux leur vrai centre, et
// c'est par rapport à lui qu'on juge un lieu (moins de 50 km). La règle de ce
// qui est « sûr » vit dans src/lib/placeMatch.js, testée. Tout le reste garde
// son « À relier » dans l'app, pour la recherche de F2.
//
// Clé : GOOGLE_MAPS_TEST_KEY (Places API (New) seulement), lue dans
// .env.local ou l'environnement. Jamais la clé navigateur.
//
// Coût : une recherche texte (palier Pro) par lieu non relié, dans la
// franchise de 5 000 par mois — quelques dizaines par voyage.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { categoryOf } from '../src/lib/categories.js';
import { decideItem, decideStep } from '../src/lib/placeMatch.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fail = (message) => {
  console.error(`✗ ${message}`);
  process.exit(1);
};

function readKey() {
  if (process.env.GOOGLE_MAPS_TEST_KEY) return process.env.GOOGLE_MAPS_TEST_KEY;
  const env = join(root, '.env.local');
  if (!existsSync(env)) return null;
  const line = readFileSync(env, 'utf8').split('\n').find((l) => l.startsWith('GOOGLE_MAPS_TEST_KEY='));
  return line ? line.slice('GOOGLE_MAPS_TEST_KEY='.length).trim().replace(/^["']|["']$/g, '') : null;
}

const [exportPath] = process.argv.slice(2);
if (!exportPath) fail('usage : node scripts/relier-google.mjs <export.json>');
const KEY = readKey();
if (!KEY) fail('GOOGLE_MAPS_TEST_KEY absente de .env.local');

const doc = JSON.parse(readFileSync(exportPath, 'utf8'));
if (doc.format !== 'travel-app/voyage@1') fail(`${exportPath} n'est pas un export de export-voyage.sql`);

// --- Google -----------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function search(query, bias) {
  const body = { textQuery: query, languageCode: 'fr', pageSize: 1 };
  if (bias) {
    body.locationBias = { circle: { center: { latitude: Number(bias.lat), longitude: Number(bias.lng) }, radius: 50000 } };
  }
  for (let attempt = 1; ; attempt += 1) {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.types',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    // Une erreur passagère de Google (5xx) ne doit pas passer pour « introuvable ».
    if (res.status >= 500 && attempt < 3) {
      await sleep(1500 * attempt);
      continue;
    }
    if (!res.ok) fail(`Google a répondu ${res.status} : ${data.error?.message ?? ''}`);
    const place = data.places?.[0];
    return place
      ? { placeId: place.id, name: place.displayName?.text ?? '', lat: place.location.latitude, lng: place.location.longitude, types: place.types ?? [] }
      : null;
  }
}

// --- décisions ----------------------------------------------------------------

const located = (point) => point.lat != null && point.lng != null;
const steps = [...doc.steps].sort((a, b) => a.position - b.position);
const centerOf = new Map();
const linkedSteps = [];
const linkedItems = [];
const manual = [];

let previous = null;
for (const step of steps) {
  if (step.place_id) {
    centerOf.set(step.id, step);
  } else {
    const found = await search(step.name, previous ?? (located(step) ? step : null));
    const decision = decideStep(step, found);
    if (decision.link) {
      linkedSteps.push({ step, found });
      centerOf.set(step.id, found);
    } else {
      manual.push({ kind: 'étape', title: step.name, reason: decision.reason });
      if (located(step)) centerOf.set(step.id, step);
    }
  }
  previous = centerOf.get(step.id) ?? previous;
}

const stepById = new Map(steps.map((step) => [step.id, step]));
for (const item of doc.items) {
  if (item.place_id || !categoryOf(item.category)?.onMap) continue;
  const center = centerOf.get(item.step_id) ?? null;
  const found = await search(item.title, center);
  const decision = decideItem(item, center, found);
  if (decision.link) linkedItems.push({ item, found, reason: decision.reason });
  else manual.push({ kind: stepById.get(item.step_id)?.name ?? '?', title: item.title, reason: decision.reason });
}

// --- SQL ------------------------------------------------------------------------

// Des identifiants qu'on recopie dans du SQL : on vérifie leur forme plutôt
// que de les échapper.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLACE = /^[A-Za-z0-9_-]+$/;
const comment = (text) => String(text).replace(/[\r\n]+/g, ' ');
const coord = (n) => Number(n).toFixed(6);

function update(table, row, found, extra = '') {
  if (!UUID.test(row.id) || !PLACE.test(found.placeId)) fail(`identifiant inattendu : ${row.id} / ${found.placeId}`);
  return `update public.${table} set place_id = '${found.placeId}', lat = ${coord(found.lat)}, lng = ${coord(found.lng)}, place_synced_at = now()${extra}\n where id = '${row.id}' and place_id is null;`;
}

const out = [
  `-- ${basename(exportPath).replace(/\.json$/, '')}.relier-google.sql`,
  `-- Généré le ${new Date().toISOString()} par scripts/relier-google.mjs, depuis`,
  `-- l'export du voyage « ${comment(doc.trip.title)} » (${doc.trip.slug}) du ${doc.exporte_le}.`,
  '--',
  `-- ${linkedSteps.length} étape(s) et ${linkedItems.length} lieu(x) reliés à Google, seulement les cas sûrs.`,
  '-- À passer à la main dans le SQL Editor : sur DEV d\'abord, puis sur la prod,',
  '-- après 0010_google.sql. Chaque ligne ne touche qu\'un lieu encore non relié :',
  '-- rejouable, et sans effet sur ce qui a été relié à la main depuis l\'export.',
  '',
  'begin;',
  '',
];
for (const { step, found } of linkedSteps) {
  out.push(`-- étape « ${comment(step.name)} » → ${comment(found.name)}`, update('steps', step, found), '');
}
for (const { item, found, reason } of linkedItems) {
  out.push(`-- « ${comment(item.title)} » → ${comment(found.name)} (${reason})`, update('items', item, found, ', geocoded_at = null'), '');
}
out.push(
  'commit;',
  '',
  '-- Le compte rendu : la seule ligne que le SQL Editor affiche.',
  `select (select count(*) from public.steps s where s.trip_id = '${doc.trip.id}' and s.place_id is not null) as etapes_reliees,`,
  `       (select count(*) from public.items i join public.steps s on s.id = i.step_id`,
  `         where s.trip_id = '${doc.trip.id}' and i.place_id is not null) as lieux_relies;`,
  '',
);
if (!UUID.test(doc.trip.id)) fail(`identifiant de voyage inattendu : ${doc.trip.id}`);

const sqlPath = join(dirname(resolve(exportPath)), `${basename(exportPath).replace(/\.json$/, '')}.relier-google.sql`);
writeFileSync(sqlPath, out.join('\n'));

// --- compte rendu -----------------------------------------------------------------

console.log(`\nReliés automatiquement : ${linkedSteps.length} étape(s), ${linkedItems.length} lieu(x)`);
for (const { step, found } of linkedSteps) console.log(`  ✓ étape ${step.name} → ${found.name}`);
for (const { item, found, reason } of linkedItems) console.log(`  ✓ ${item.title} → ${found.name} (${reason})`);
console.log(`\nÀ relier à la main dans l'app : ${manual.length}`);
for (const { kind, title, reason } of manual) console.log(`  · [${kind}] ${title} — ${reason}`);
console.log(`\nSQL : ${sqlPath}`);
