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
| `img` | Lien symbolique vers `../public/img` |

Pour ouvrir le design dans un navigateur, il faut le servir en HTTP
(le `.dc.html` charge d3 et topojson depuis unpkg) :

```sh
npx serve design
```

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
| `resto` | Restaurants | `#b4621f` | oui | non |
| `shopping` | Shopping | `#6b3f6e` | oui | non |
| `lieu` | Lieux touristiques | `#1f6f74` | oui | oui |
| `note` | Notes perso | `#8a6a2f` | non | non |

⚠️ **Écart à trancher avant L1** : le design utilise la clé `resto`, le contrat SQL
du lot L1 impose `CHECK IN (...,'restaurant',...)`. Aligner un côté ou l'autre.

## Données géographiques

`CITIES` (ligne ~324) contient **25 villes** avec `lat`/`lon` réels et les offsets
de labels (`lx`, `ly`, `ox`, `oy`, `anchor`). Réutilisable directement pour le seed
de L1 et le calibrage de L5.

## ⚠️ 13 images manquantes

`get_file` du MCP plafonne à 256 Ko ; 13 PNG dépassaient et arrivaient tronqués.
Ils ont été supprimés plutôt que laissés corrompus (en-tête PNG valide mais chunk
`IEND` absent — `file` ne détecte pas le problème).

À récupérer manuellement depuis le canvas puis à déposer dans `public/img/` :

```
alpes2  baguettes  deco-fuji  deco-fuji2  deco-momiji  hero-pagode
koyasan2  matcha  miyajima2  narai  shirakawago2  sumo  sushi
```

`deco-fuji`, `deco-momiji` et `hero-pagode` sont les décos du header — nécessaires
à partir de L3. Les 28 autres images sont présentes et complètes.

Toutes ces images font plus de 190 Ko. Prévoir une conversion WebP avant le
précache intégral de L7.
