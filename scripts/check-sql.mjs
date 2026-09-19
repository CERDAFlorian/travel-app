#!/usr/bin/env node
// Contrôle statique des fichiers SQL de supabase/.
//
// Il n'y a pas de Postgres dans ce projet ni en CI, et le SQL n'est jamais
// exécuté par Claude Code (L1 : « je l'applique moi-même »). Ce script attrape
// donc ce qui se voit sans serveur : quotes déséquilibrées, transaction non
// refermée, FK vers une table inexistante, table sans RLS, policy permissive,
// valeur de seed hors CHECK, enchaînement des dates d'étapes.
//
// Il ne remplace pas l'exécution : un typage invalide ou une fonction inconnue
// ne se verront qu'à l'application des migrations.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);

// --- Lecture et découpe -----------------------------------------------------

function read(rel) {
  try {
    return readFileSync(resolve(root, rel), 'utf8');
  } catch {
    fail(rel, 'fichier introuvable');
    return null;
  }
}

// Retire commentaires et corps de chaînes, en signalant ce qui reste ouvert.
// Les littéraux deviennent '' pour que les regex de structure ne tombent pas
// sur du texte (« Château d'Osaka » contient une parenthèse ? non, mais
// « Récupérer le JR Pass » contient des mots-clés SQL).
function strip(sql, file) {
  let out = '';
  let i = 0;
  let line = 1;
  while (i < sql.length) {
    const c = sql[i];
    if (c === '\n') { line++; out += c; i++; continue; }

    if (c === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      if (end < 0) { fail(file, `commentaire /* ouvert ligne ${line} et jamais refermé`); return out; }
      for (let k = i; k < end; k++) if (sql[k] === '\n') line++;
      i = end + 2;
      continue;
    }
    if (c === '$') {
      const tag = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
      if (tag) {
        const end = sql.indexOf(tag[0], i + tag[0].length);
        if (end < 0) { fail(file, `bloc ${tag[0]} ouvert ligne ${line} et jamais refermé`); return out; }
        const body = sql.slice(i, end + tag[0].length);
        out += ' '.repeat(0) + body.replace(/[^\n]/g, ' ');
        for (const ch of body) if (ch === '\n') line++;
        i = end + tag[0].length;
        continue;
      }
    }
    if (c === "'") {
      const start = line;
      i++;
      for (;;) {
        if (i >= sql.length) { fail(file, `chaîne ouverte ligne ${start} et jamais refermée`); return out; }
        if (sql[i] === "'" && sql[i + 1] === "'") { i += 2; continue; }
        if (sql[i] === "'") { i++; break; }
        if (sql[i] === '\n') line++;
        i++;
      }
      out += "''";
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function checkBalance(stripped, file) {
  let depth = 0;
  for (const c of stripped) {
    if (c === '(') depth++;
    else if (c === ')') depth--;
    if (depth < 0) { fail(file, 'une parenthèse fermante de trop'); return; }
  }
  if (depth > 0) fail(file, `${depth} parenthèse(s) jamais refermée(s)`);
}

function checkTransaction(stripped, file) {
  const begins = (stripped.match(/\bbegin\s*;/gi) || []).length;
  const commits = (stripped.match(/\bcommit\s*;/gi) || []).length;
  if (begins !== commits) fail(file, `${begins} begin pour ${commits} commit`);
  if (begins === 0) fail(file, 'aucune transaction : un échec à mi-parcours laisserait la base à moitié migrée');
}

// --- Chargement -------------------------------------------------------------

const files = {
  schema: 'supabase/migrations/0001_schema.sql',
  rls: 'supabase/migrations/0002_rls.sql',
  share: 'supabase/migrations/0003_partage.sql',
  seed: 'supabase/seed.sql',
};

const raw = {};
const clean = {};
for (const [key, rel] of Object.entries(files)) {
  const sql = read(rel);
  if (sql === null) continue;
  raw[key] = sql;
  clean[key] = strip(sql, rel);
  checkBalance(clean[key], rel);
  checkTransaction(clean[key], rel);
}

if (Object.keys(clean).length === Object.keys(files).length) {
  // --- Schéma ---------------------------------------------------------------

  const tables = [...clean.schema.matchAll(/create table (?:if not exists )?public\.(\w+)/gi)].map((m) => m[1]);
  const expected = ['trips', 'trip_members', 'steps', 'items', 'flights', 'legs', 'experiences'];
  for (const t of expected) if (!tables.includes(t)) fail(files.schema, `table « ${t} » absente`);

  // FK : toute cible doit exister (public.* déclarées ici, auth.users fournie par Supabase)
  for (const m of clean.schema.matchAll(/references\s+(public|auth)\.(\w+)\s*\(/gi)) {
    const [, schema, table] = m;
    if (schema === 'public' && !tables.includes(table)) fail(files.schema, `FK vers public.${table}, table jamais créée`);
    if (schema === 'auth' && table !== 'users') fail(files.schema, `FK vers auth.${table}, inattendue`);
  }

  // Le seed s'appuie sur des UUID fixes : ils doivent être valides.
  for (const m of raw.seed.matchAll(/'([0-9a-f]{8}-[0-9a-f-]{23,})'/gi)) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(m[1])) {
      fail(files.seed, `UUID mal formé : ${m[1]}`);
    }
  }

  // --- RLS ------------------------------------------------------------------

  for (const t of expected) {
    if (!new RegExp(`alter table public\\.${t}\\s+enable row level security`, 'i').test(clean.rls)) {
      fail(files.rls, `RLS jamais activé sur ${t}`);
    }
    for (const action of ['select', 'insert', 'update', 'delete']) {
      const re = new RegExp(`create policy \\w+ on public\\.${t}\\s+for ${action}\\b`, 'i');
      if (!re.test(clean.rls)) fail(files.rls, `${t} : aucune policy ${action.toUpperCase()}`);
    }
  }

  // Une policy permissive annule tout le reste. On tolère `auth.uid() is not
  // null` (insert d'un voyage : la ligne n'a pas encore de propriétaire).
  for (const m of clean.rls.matchAll(/\b(using|with check)\s*\(\s*true\s*\)/gi)) {
    fail(files.rls, `policy permissive : ${m[0]}`);
  }
  // Toute policy doit être restreinte au rôle authenticated.
  const policies = [...clean.rls.matchAll(/create policy (\w+) on public\.\w+\s+for \w+([\s\S]*?);/gi)];
  for (const [, name, body] of policies) {
    if (!/\bto authenticated\b/i.test(body)) fail(files.rls, `policy ${name} : pas de « to authenticated »`);
  }
  // --- Partage --------------------------------------------------------------
  //
  // Le lien de partage est la seule porte ouverte à `anon`. Trois propriétés
  // le tiennent, et chacune se casse d'une ligne distraite.

  // 1. `anon` ne doit JAMAIS recevoir de droit de table. Tout l'intérêt du
  //    passage par fonction est là : la clé publique ne lit rien directement.
  for (const m of clean.share.matchAll(/grant\s+([^;]*?)\s+on\s+(?!function)([^;]*?)\s+to\s+([^;]+);/gi)) {
    if (/\banon\b/i.test(m[3])) {
      fail(files.share, `grant de table à anon : « ${m[0].trim().slice(0, 70)}… ». Le partage doit passer par la fonction.`);
    }
  }

  // 2. La fonction doit être SECURITY DEFINER au search_path verrouillé —
  //    sinon elle est soit inutile, soit dangereuse.
  // `strip` vide les corps $$…$$ : on lit le texte brut, en-tête et corps
  // compris, puisque c'est justement le corps qui porte le filtre.
  const shareFn = raw.share.match(
    /create or replace function public\.trip_by_share_token[\s\S]*?\bas\s+\$\$/i,
  );
  if (!shareFn) fail(files.share, 'fonction trip_by_share_token absente');
  else {
    if (!/security definer/i.test(shareFn[0])) {
      fail(files.share, 'trip_by_share_token doit être SECURITY DEFINER, sinon RLS la rend muette pour anon');
    }
    if (!/set search_path\s*=\s*''/i.test(shareFn[0])) {
      fail(files.share, "trip_by_share_token : SECURITY DEFINER sans « set search_path = '' »");
    }
  }

  // 3. Le filtre sur le jeton est le contrôle d'accès. Sans lui, la fonction
  //    rendrait n'importe quel voyage à n'importe qui.
  if (!/where\s+t\.share_token\s*=\s*p_token/i.test(raw.share)) {
    fail(files.share, 'trip_by_share_token ne filtre pas sur le jeton : elle exposerait tous les voyages');
  }

  // 4. Le droit d'exécution doit être retiré à `public` avant d'être accordé
  //    nommément : `public` couvre tout rôle présent et à venir.
  if (!/revoke execute on function public\.trip_by_share_token\(uuid\) from public/i.test(clean.share)) {
    fail(files.share, "le droit d'exécution n'est pas retiré à `public` avant d'être accordé");
  }

  // Les fonctions SECURITY DEFINER doivent verrouiller leur search_path.
  const fns = [...clean.rls.matchAll(/create (?:or replace )?function public\.(\w+)([\s\S]*?)as\s/gi)];
  for (const [, name, head] of fns) {
    if (/security definer/i.test(head) && !/set search_path\s*=\s*''/i.test(head)) {
      fail(files.rls, `fonction ${name} : SECURITY DEFINER sans « set search_path = '' »`);
    }
  }

  // --- Seed -----------------------------------------------------------------

  const listOf = (name) => {
    const m = new RegExp(`constraint ${name}[^\\n]*in \\(([^)]*)\\)`, 'i').exec(raw.schema);
    return m ? [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]) : null;
  };
  // Les littéraux du seed ont été effacés par strip() : on relit le brut.
  const seedRaw = raw.seed;

  const catsSchema = [...(/items_category_known check \(category in \(([^)]*)\)/i.exec(raw.schema)?.[1] || '').matchAll(/'([^']*)'/g)].map((m) => m[1]);
  const expectedCats = ['hotel', 'activite', 'restaurant', 'shopping', 'lieu', 'note'];
  for (const c of expectedCats) if (!catsSchema.includes(c)) fail(files.schema, `catégorie « ${c} » absente du CHECK`);
  if (catsSchema.includes('resto')) fail(files.schema, 'catégorie « resto » : la clé canonique est « restaurant »');

  const itemsBlock = /insert into public\.items[\s\S]*?\n\) as v\(/.exec(seedRaw)?.[0] || '';
  const itemRows = [...itemsBlock.matchAll(/^\s*\((\d+),\s*'([a-z]+)',/gm)];
  if (itemRows.length === 0) fail(files.seed, 'aucun item lu — le bloc a-t-il changé de forme ?');
  const perStep = new Map();
  for (const [, stepNo, cat] of itemRows) {
    if (!catsSchema.includes(cat)) fail(files.seed, `item de catégorie « ${cat} », hors CHECK`);
    perStep.set(Number(stepNo), (perStep.get(Number(stepNo)) || 0) + 1);
  }
  for (let n = 1; n <= 7; n++) if (!perStep.get(n)) fail(files.seed, `étape ${n} sans aucun item`);
  const seenCats = new Set(itemRows.map((r) => r[2]));
  for (const c of expectedCats) if (!seenCats.has(c)) fail(files.seed, `aucun item d'exemple en catégorie « ${c} »`);

  // Étapes : 7, positions 1..7, dates enchaînées, nights = écart des dates.
  const steps = [...seedRaw.matchAll(/^\s*\('5eed[0-9a-f-]+',\s*'5eed[0-9a-f-]+',\s*(\d+),\s*'([^']*)',\s*'(\d{4}-\d\d-\d\d)',\s*'(\d{4}-\d\d-\d\d)',\s*(\d+),/gm)];
  if (steps.length !== 7) fail(files.seed, `${steps.length} étape(s) lues, 7 attendues`);
  let total = 0;
  steps.forEach(([, pos, name, start, end, nights], idx) => {
    if (Number(pos) !== idx + 1) fail(files.seed, `étape « ${name} » : position ${pos}, ${idx + 1} attendue`);
    const days = (Date.parse(end) - Date.parse(start)) / 86400000;
    if (days !== Number(nights)) fail(files.seed, `étape « ${name} » : ${nights} nuit(s) pour ${days} jour(s) entre ${start} et ${end}`);
    if (idx > 0 && steps[idx - 1][4] !== start) fail(files.seed, `étape « ${name} » commence le ${start}, la précédente finit le ${steps[idx - 1][4]}`);
    total += Number(nights);
  });
  const trip = /'japon-2026',\s*'[^']*',\s*'[^']*',\s*'(\d{4}-\d\d-\d\d)',\s*'(\d{4}-\d\d-\d\d)'/.exec(seedRaw);
  if (!trip) fail(files.seed, 'dates du voyage illisibles');
  else {
    if (steps.length && trip[1] !== steps[0][3]) fail(files.seed, `le voyage démarre le ${trip[1]}, la 1re étape le ${steps[0][3]}`);
    if (steps.length && trip[2] !== steps[steps.length - 1][4]) fail(files.seed, `le voyage finit le ${trip[2]}, la dernière étape le ${steps[steps.length - 1][4]}`);
    const span = (Date.parse(trip[2]) - Date.parse(trip[1])) / 86400000;
    if (span !== total) fail(files.seed, `${total} nuits cumulées pour ${span} jours de voyage`);
  }

  // Liaisons : 6, consécutives, mode et durée valides.
  const modes = listOf('legs_mode_known') || [];
  const legs = [...seedRaw.matchAll(/^\s*\((\d),\s*(\d),\s*'(\w+)',\s*(\d+),/gm)];
  if (legs.length !== 6) fail(files.seed, `${legs.length} liaison(s) lues, 6 attendues`);
  legs.forEach(([, from, to, mode, min], idx) => {
    if (Number(from) !== idx + 1 || Number(to) !== idx + 2) fail(files.seed, `liaison ${from}→${to} : les étapes ne se suivent pas`);
    if (!modes.includes(mode)) fail(files.seed, `liaison ${from}→${to} : mode « ${mode} » hors CHECK`);
    if (Number(min) <= 0) fail(files.seed, `liaison ${from}→${to} : durée ${min}`);
  });

  // Vols : directions dans le CHECK, codes IATA plausibles.
  const dirs = listOf('flights_direction_known') || [];
  const flights = [...seedRaw.matchAll(/'(aller|retour|[a-z]+)',\s*'([A-Z]{3})',\s*'([A-Z]{3})',\s*'(\d{4}-\d\d-\d\d)'/g)];
  if (flights.length !== 2) fail(files.seed, `${flights.length} vol(s) lus, 2 attendus`);
  for (const [, dir] of flights) if (!dirs.includes(dir)) fail(files.seed, `vol de direction « ${dir} », hors CHECK`);

  // Images d'expériences : servies en .webp depuis public/img/.
  for (const m of seedRaw.matchAll(/'([\w-]+\.(png|jpg|jpeg|webp))'/g)) {
    if (m[2] !== 'webp') fail(files.seed, `image « ${m[1]} » : les images sont servies en .webp`);
  }
}

// --- Sortie -----------------------------------------------------------------

if (errors.length) {
  console.error(`SQL — ${errors.length} problème(s) :\n`);
  for (const e of errors) console.error('  · ' + e);
  process.exit(1);
}
console.log('SQL — schéma, RLS et seed cohérents.');
