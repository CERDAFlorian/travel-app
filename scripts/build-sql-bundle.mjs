#!/usr/bin/env node
// Toutes les migrations bout à bout, sur la sortie standard.
//
// Monter une base neuve — la base de dev de L8 — demandait de coller huit
// fichiers l'un après l'autre dans le SQL Editor, dans le bon ordre, sans en
// sauter un. C'est huit occasions de se tromper pour un geste qu'on ne fait
// qu'une fois par base, donc jamais assez souvent pour le connaître par cœur.
//
// RIEN N'EST COMMITÉ et rien n'est appliqué : le script écrit sur stdout, on
// colle, on lance. Un fichier généré en plus des migrations finirait par
// diverger d'elles au premier oubli de régénération — c'est exactement ce que
// ce projet évite pour la carte, les icônes et les polices, qui sont commités
// parce qu'ils ne se recalculent pas depuis une source de vérité vivante. Ici,
// la source vit à côté.
//
//   npm run sql:bundle | pbcopy     # macOS : directement dans le presse-papier
//   npm run sql:bundle > /tmp/x.sql
//
// Le seed n'en fait PAS partie, et c'est délibéré : il s'ouvre sur un
// `delete from public.trips`, et on ne mélange pas un geste destructeur avec
// la construction du schéma. Il se colle à part, en connaissance de cause.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(root, 'supabase/migrations');

// Tri lexicographique : la numérotation à quatre chiffres le rend fiable
// jusqu'à 9999 migrations, ce qui laisse de la marge.
const files = readdirSync(dir)
  .filter((name) => name.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.error('Aucune migration dans supabase/migrations/.');
  process.exit(1);
}

const parts = [
  '-- ═══════════════════════════════════════════════════════════════════════',
  `-- ${files.length} migrations, dans l'ordre, générées par \`npm run sql:bundle\`.`,
  '--',
  "-- À coller d'un bloc dans le SQL Editor d'une base NEUVE. Chaque migration",
  '-- garde son propre begin/commit : si l\'une échoue, les précédentes restent',
  '-- appliquées et on reprend à celle qui a cassé.',
  '--',
  '-- Le seed n\'est pas inclus : il efface le voyage `japon-2026` avant de le',
  '-- reconstruire. À coller séparément, quand on sait pourquoi.',
  '-- ═══════════════════════════════════════════════════════════════════════',
  '',
];

for (const name of files) {
  parts.push(
    '',
    `-- ───────────────────────────────────────────────────────────────────────`,
    `-- ${name}`,
    `-- ───────────────────────────────────────────────────────────────────────`,
    '',
    readFileSync(resolve(dir, name), 'utf8').trimEnd(),
    '',
  );
}

process.stdout.write(parts.join('\n') + '\n');

// Sur stderr : le récapitulatif ne pollue pas ce qu'on redirige ou colle.
console.error(`${files.length} migrations réunies : ${files.join(', ')}`);
