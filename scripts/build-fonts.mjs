#!/usr/bin/env node
// Rapatrie les polices en local.
//
// POURQUOI. index.html les chargeait depuis Google Fonts. Hors ligne, au
// Japon, la feuille de style distante ne répond pas et toute la typographie
// retombe sur Georgia — l'app reste lisible, mais elle n'est plus la même.
// Un service worker ne peut pas garantir le contenu d'un tiers ; l'héberger
// est la seule façon d'en être sûr.
//
// Sous-ensemble latin uniquement : le seul dont l'app a besoin. Les jeux
// cyrillique, grec et vietnamien pèseraient sans jamais servir.
//
// La sortie est commitée : `npm run build` n'a pas besoin de réseau.
//
//   node scripts/build-fonts.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'public/fonts');

// Lora remplace Playfair Display pour les titres.
//
// Playfair a un contraste de traits très élevé : pleins épais, déliés presque
// invisibles. C'est un caractère de maquette imprimée, et à l'écran ses
// déliés disparaissent — d'autant plus sur un fond crème peu contrasté.
// Lora garde le registre éditorial avec un contraste modéré, et elle a été
// dessinée pour l'écran.
const CSS_URL =
  'https://fonts.googleapis.com/css2?family=Lora:wght@600;700&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap';

// Google sert des formats différents selon le User-Agent. Celui-ci obtient du
// woff2, pris en charge partout depuis des années et le plus compact.
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const slug = (family, style, weight) =>
  `${family.toLowerCase().replace(/\s+/g, '-')}-${weight}${style === 'italic' ? 'i' : ''}.woff2`;

async function main() {
  mkdirSync(OUT, { recursive: true });

  const css = await fetch(CSS_URL, { headers: { 'User-Agent': UA } }).then((r) => {
    if (!r.ok) throw new Error(`Google Fonts a répondu ${r.status}`);
    return r.text();
  });

  // Chaque @font-face porte son sous-ensemble en commentaire juste avant.
  const blocks = css.split('/*').slice(1);
  const faces = [];
  let total = 0;

  for (const block of blocks) {
    const subset = block.slice(0, block.indexOf('*/')).trim();
    if (subset !== 'latin') continue;

    const family = /font-family:\s*'([^']+)'/.exec(block)?.[1];
    const style = /font-style:\s*(\w+)/.exec(block)?.[1] ?? 'normal';
    const weight = /font-weight:\s*(\d+)/.exec(block)?.[1];
    const url = /src:\s*url\(([^)]+)\)/.exec(block)?.[1];
    if (!family || !weight || !url) continue;

    const name = slug(family, style, weight);
    const bytes = Buffer.from(await fetch(url).then((r) => r.arrayBuffer()));
    writeFileSync(resolve(OUT, name), bytes);
    total += bytes.length;

    faces.push(
      `@font-face {\n` +
        `  font-family: '${family}';\n` +
        `  font-style: ${style};\n` +
        `  font-weight: ${weight};\n` +
        // swap : le texte s'affiche tout de suite dans la police de repli puis
        // bascule. Mieux qu'un écran vide le temps du chargement.
        `  font-display: swap;\n` +
        `  src: url('/fonts/${name}') format('woff2');\n` +
        `}`,
    );
    process.stdout.write(`  ${name.padEnd(34)} ${(bytes.length / 1024).toFixed(1)} Ko\n`);
  }

  if (faces.length === 0) throw new Error('aucun @font-face latin trouvé — le format de Google a changé');

  writeFileSync(
    resolve(OUT, 'fonts.css'),
    `/* GÉNÉRÉ par scripts/build-fonts.mjs — ne pas modifier à la main.\n` +
      `   Sous-ensemble latin de Google Fonts, hébergé localement pour que la\n` +
      `   typographie survive au mode avion. Relancer : node scripts/build-fonts.mjs */\n\n` +
      `${faces.join('\n\n')}\n`,
    'utf8',
  );

  process.stdout.write(`\n${faces.length} fontes, ${(total / 1024).toFixed(1)} Ko au total\n`);
}

main().catch((error) => {
  process.stderr.write(`\n${error.message}\n`);
  process.exit(1);
});
