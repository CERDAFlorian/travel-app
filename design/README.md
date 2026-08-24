# Références de conception

Importé depuis le projet Claude Design `Itinéraire Japon interactif`
(`ffcea357-0409-407c-94cb-8441582baff1`) via le MCP `claude_design`.

Ce dossier est une **référence de lecture seule**. Il n'est pas compilé par Vite
et il est exclu de l'image Docker (voir `.dockerignore`).

## Contenu

| Fichier | Rôle |
|---|---|
| `Itinéraire Japon.dc.html` | Le design complet : palette, mise en page, données de démo |
| `japan-map.jsx` | Carte du Japon : d3-geoMercator, pan/zoom/pinch, placement auto des labels |
| `support.js` | Runtime du canvas Claude Design (généré) — requis pour ouvrir le `.dc.html` |
| `image-slot.js` | Composant starter du canvas — requis pour ouvrir le `.dc.html` |
| `img/` | **Les PNG sources.** Compressés en WebP vers `public/img/` par `npm run img` |
| `img/.manifest.json` | Hachages des PNG, sert au contrôle de fraîcheur en CI |

Pour ouvrir le design dans un navigateur, il faut le servir en HTTP
(le `.dc.html` charge d3 et topojson depuis unpkg) :

```sh
npx serve design
```

## Images

Les PNG de `img/` sont la **source de vérité**. Ils ne sont jamais servis :
`npm run img` les compresse en WebP dans `public/img/`, et ce sont les WebP qui
sont commités et déployés (4,2 Mo → 251 Ko, −94 %).

```sh
npm run img          # compresse ce qui a changé
npm run img -- --all # réencode tout
npm run img:check    # vérifie sans compresser (tourne en CI)
```

Nécessite `cwebp` : `brew install webp` (ou `apt install webp`). Seul
`npm run img:check` s'en passe, c'est pourquoi la CI peut le lancer.

Après avoir ajouté ou remplacé un PNG, lance `npm run img` et commite
`public/img/` **et** `design/img/.manifest.json` — sinon la CI échoue.

Réglages : WebP q80, `-alpha_q 90`, `-m 6`. Les 28 images ont toutes de la
transparence réelle, donc JPEG est exclu. AVIF ne gagnerait que ~5 % de plus
pour un encodage 10× plus lent et un support limité à iOS 16+.

## Palette (extraite du .dc.html, par fréquence)

| Rôle | Hex |
|---|---|
| accent (rouge sombre) | `#8f1d24` — variante foncée `#7a2027`, liens survolés `#6d1418` |
| bg (crème) | `#f8ecd9` |
| surface | `#fdf6e9`, `#fffdf7` |
| border | `#e0caa2`, `#e6d2ab`, `#d9bd8c` |
| muted | `#a08050` — placeholders `#b39a72` |
| text | `#3d2f24` — titres `#5c1b1b` |

Polices : `Playfair Display` (600/700) et `EB Garamond` — déjà chargées dans `index.html`.

## Couleurs de catégorie (`CATS`, ligne ~315 du .dc.html)

| Clé | Libellé | Couleur | Sur la carte | Dans le budget |
|---|---|---|---|---|
| `hotel` | Hôtel | `#2c5271` | oui | oui |
| `activite` | Activités | `#3f6b4a` | oui | oui |
| `restaurant` | Restaurants | `#b4621f` | oui | non |
| `shopping` | Shopping | `#6b3f6e` | oui | non |
| `lieu` | Lieux touristiques | `#1f6f74` | oui | oui |
| `note` | Notes perso | `#8a6a2f` | non | non |

**Décision : la clé canonique est `restaurant`.** Le `.dc.html` utilise `resto`,
le contrat SQL de L1 impose `CHECK IN (...,'restaurant',...)` ; c'est la spec qui
tranche. Le tableau ci-dessus donne les valeurs à utiliser dans l'app.

Le `.dc.html` n'est pas modifié : c'est un import fidèle du canvas, le corriger
le ferait diverger de sa source. En transposant son code, remplacer `resto` par
`restaurant` — c'est la seule des 6 clés qui change.

## Données géographiques

`CITIES` (ligne ~324) contient **25 villes** avec `lat`/`lon` réels et les offsets
de labels (`lx`, `ly`, `ox`, `oy`, `anchor`). Réutilisable directement pour le seed
de L1 et le calibrage de L5.

## ⚠️ 9 images à récupérer

`get_file` du MCP plafonne à 256 Ko ; 13 PNG dépassaient et arrivaient tronqués
(en-tête PNG valide mais chunk `IEND` absent — `file` ne le détecte pas). Ils ont
été supprimés plutôt que laissés corrompus. Le plafond est infranchissable côté
MCP : l'export doit se faire à la main depuis le canvas.

Sur ces 13, **4 ne sont référencées nulle part** dans le `.dc.html` — ce sont des
variantes inutilisées, inutile de les récupérer : `alpes2`, `deco-fuji2`,
`koyasan2`, `miyajima2`.

Les **9 réellement utilisées** :

| Image | Rôle | Bloque L3 ? |
|---|---|---|
| `deco-momiji` | décor du header, en haut à gauche | **oui** |
| `deco-fuji` | décor du header, en haut à droite | **oui** |
| `hero-pagode` | bandeau hero pleine largeur | **oui** |
| `sushi` | items « sushi », « toyosu », « tsukiji » | non |
| `sumo` | items « sumo », « ryogoku » | non |
| `shirakawago2` | items « shiroyama », « vallée » | non |
| `narai` | items « narai », « nakasendo » | non |
| `matcha` | items « matcha », « thé » | non |
| `baguettes` | items « baguette » | non |

Les 6 dernières alimentent l'appariement par mots-clés (voir plus bas) : leur
absence laisse simplement l'item sans photo, sans rien casser. Les 3 premières
sont structurantes pour le shell de L3.

**Procédure** : exporter depuis le canvas Claude Design, déposer les `.png` dans
`design/img/`, puis `npm run img`. Le manifeste et les WebP se mettent à jour
tout seuls, il n'y a rien d'autre à toucher.

## Appariement photo ↔ item

Le design n'attache pas les photos aux étapes : il fait correspondre des
**mots-clés du titre de l'item** à une image (`.dc.html`, lignes 366-381). Le
bandeau d'une étape est composé des photos de ses items qui matchent. À reprendre
tel quel pour le `StepCard` de L3.
