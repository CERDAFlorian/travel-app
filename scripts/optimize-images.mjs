#!/usr/bin/env node
// Compresse design/img/*.png -> public/img/*.webp
//
// Les PNG sont la source de verite (hors image Docker, voir .dockerignore).
// Les WebP sont generes ET commites : ce qui est teste est byte-a-byte ce qui
// est deploye, et le precache du service worker (L7) reste deterministe.
//
//   npm run img            compresse ce qui a change
//   npm run img -- --all   reencode tout
//   npm run img:check      ne compresse rien, echoue si un WebP manque ou est
//                          perime (utilise par la CI, cwebp non requis)
//
// La fraicheur est determinee par le hachage du PNG source, pas par sa mtime :
// git ne preserve pas les mtimes, un checkout CI les remet toutes a la meme
// valeur. Le manifeste vit dans design/ pour ne pas etre copie dans dist/.
//
// Depend de cwebp (libwebp) : `brew install webp` ou `apt install webp`.

import {
  existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, basename } from 'node:path';

const SRC = 'design/img';
const OUT = 'public/img';
const MANIFEST = join(SRC, '.manifest.json');
const QUALITY = 80;
const ALPHA_QUALITY = 90;

const args = new Set(process.argv.slice(2));
const checkOnly = args.has('--check');
const force = args.has('--all');

const fail = (msg) => { console.error(`✗ ${msg}`); process.exit(1); };
const kb = (n) => `${Math.round(n / 1024)} Ko`;
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 16);
const webpFor = (png) => join(OUT, `${basename(png, '.png')}.webp`);

if (!existsSync(SRC)) fail(`dossier source introuvable : ${SRC}`);

const pngs = readdirSync(SRC).filter((f) => f.toLowerCase().endsWith('.png')).sort();
if (pngs.length === 0) fail(`aucun PNG dans ${SRC}/`);

let manifest = {};
if (existsSync(MANIFEST)) {
  try { manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')); } catch { manifest = {}; }
}

// --- mode verification (CI) : aucune dependance externe requise -------------
if (checkOnly) {
  const problems = [];
  for (const png of pngs) {
    const out = webpFor(png);
    if (!existsSync(out)) problems.push(`${png} — WebP absent`);
    else if (manifest[png] !== sha(join(SRC, png))) problems.push(`${png} — WebP perime`);
  }
  const orphans = existsSync(OUT)
    ? readdirSync(OUT).filter(
        (f) => f.endsWith('.webp') && !pngs.includes(`${basename(f, '.webp')}.png`))
    : [];
  for (const o of orphans) problems.push(`${o} — WebP sans PNG source`);

  if (problems.length) {
    console.error(`✗ ${problems.length} probleme(s) :`);
    for (const p of problems) console.error(`    ${p}`);
    console.error('\n  Lance `npm run img` puis commite public/img/ et design/img/.manifest.json');
    process.exit(1);
  }
  console.log(`✓ ${pngs.length} images : tous les WebP sont a jour.`);
  process.exit(0);
}

// --- mode compression -------------------------------------------------------
try {
  execFileSync('cwebp', ['-version'], { stdio: 'ignore' });
} catch {
  fail('cwebp introuvable. Installe-le : brew install webp (ou apt install webp)');
}

mkdirSync(OUT, { recursive: true });

const next = {};
let done = 0, skipped = 0, srcBytes = 0, outBytes = 0;

for (const png of pngs) {
  const src = join(SRC, png);
  const out = webpFor(png);
  const hash = sha(src);
  next[png] = hash;

  if (!force && existsSync(out) && manifest[png] === hash) {
    skipped++;
  } else {
    execFileSync('cwebp', [
      '-q', String(QUALITY),
      '-alpha_q', String(ALPHA_QUALITY),
      '-m', '6',
      '-quiet',
      src, '-o', out,
    ]);
    done++;
  }
  srcBytes += statSync(src).size;
  outBytes += statSync(out).size;
}

writeFileSync(MANIFEST, `${JSON.stringify(next, null, 2)}\n`);

const saved = srcBytes === 0 ? 0 : Math.round(((srcBytes - outBytes) / srcBytes) * 100);
console.log(
  `✓ ${pngs.length} images  (${done} compressee(s), ${skipped} deja a jour)\n` +
  `  ${kb(srcBytes)} PNG -> ${kb(outBytes)} WebP  (-${saved} %)`
);
