# Travel App

Application de préparation de voyage. React + Vite + Supabase + IndexedDB.
Offline en lecture seule. Déploiement Coolify via image Docker.

Le découpage du développement en lots est dans
[`travel-app-lots-et-prompts.md`](travel-app-lots-et-prompts.md).
Les références de conception sont dans [`design/`](design/README.md).

## Installation locale

```sh
npm install
cp .env.example .env.local
npm run dev
```

L'app démarre sur http://localhost:5173.

## Build production

```sh
npm run build     # sortie dans dist/
npm run preview   # sert dist/ localement
```

## Vérifications

```sh
npm test            # suite unitaire Vitest
npm run img:check   # les WebP servis sont à jour vis-à-vis des PNG sources
npm run sql:check   # cohérence du schéma, des policies RLS et du seed
```

Les trois tournent en CI sur chaque push.

**La CI n'a pas de `.env.local`.** Vérifier en local ne suffit donc pas : un
import qui dépend de la configuration Supabase y passe et casse en CI. Pour
reproduire ses conditions exactes :

```sh
mv .env.local .env.local.bak
npm run img:check && npm run sql:check && npm test && npm run build
mv .env.local.bak .env.local
```

Les tests, eux, ne dépendent plus de ce fichier : `vite.config.js` leur fournit
des valeurs Supabase bidon, qui garantissent aussi qu'aucun test ne touchera la
vraie base.

## Ressources générées

Trois scripts produisent des fichiers **commités**. Ils ne tournent jamais au
build : `npm run build` n'a donc besoin ni de réseau ni d'outil externe.

```sh
npm run map      # fond de carte du Japon → src/data/japan-geometry.js
npm run icons    # icônes PWA et écran d'accueil → public/
npm run fonts    # Playfair Display + EB Garamond → public/fonts/
npm run img      # PNG de design/img/ → WebP de public/img/
```

`map` et `fonts` téléchargent depuis le réseau ; `icons` encode les PNG à la
main (aucune dépendance graphique) ; `img` a besoin de `cwebp`
(`brew install webp`).

## Avant de partir

À faire **la veille du départ, en wifi**, dans cet ordre.

**1. Installer l'app sur l'écran d'accueil.** Ouvrir le site dans **Safari**
(pas Chrome), puis *Partager → Sur l'écran d'accueil*.

Ce n'est pas qu'un confort : Safari efface toutes les données d'un site après
**7 jours sans visite** — IndexedDB, caches, service worker. Les apps ajoutées
à l'écran d'accueil en sont **exemptées**. En mode navigateur, le cache peut
donc avoir disparu le jour où on en a besoin.

**2. Ouvrir l'app depuis l'icône**, se connecter, et appuyer sur
**« Préparer le voyage hors ligne »** sur la page des voyages.

Ce bouton télécharge tous les voyages en entier. Naviguer dans l'app ne suffit
pas : il suffit de n'avoir jamais ouvert l'étape de Hiroshima pour qu'elle
manque dans le train.

**3. Vérifier**, toujours en wifi : le bandeau doit afficher le nombre de
voyages en cache et de fichiers précachés.

**4. Tester en vrai.** Mode avion, **fermer complètement l'app** (balayer
depuis le sélecteur d'apps), rouvrir. Tout doit s'afficher : étapes, photos,
carte, budget. Si quelque chose manque, c'est maintenant qu'il faut le voir.

### Ce qui marche hors ligne, et ce qui ne marche pas

| | |
|---|---|
| Lire l'itinéraire, les photos, la carte, le budget | ✅ |
| Naviguer entre les écrans | ✅ |
| Ajouter, modifier, supprimer | ❌ écriture bloquée |
| Localiser un lieu (Nominatim) | ❌ et sans objet hors préparation |
| Se connecter | ❌ — mais inutile : l'affichage ne dépend pas de la session |

Le jeton d'authentification expire en une heure et son renouvellement demande
le réseau. C'est prévu : l'app rend le cache sans se soucier de qui est
connecté.

## Variables d'environnement

| Variable | Usage |
|---|---|
| `VITE_SUPABASE_URL` | URL du projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clé publiable (elle part dans le bundle, ce n'est pas un secret) |

En local elles décrivent la base de **dev** ; en CI, les secrets GitHub du même
nom décrivent la **prod**. `.env.example` ne contient que des placeholders ;
`.env` et `.env.local` sont gitignorés.

## Branches et CI/CD

- `dev` — branche de travail. Chaque push lance `.github/workflows` → build de vérification.
- `main` — production. Chaque push construit l'image Docker et la pousse sur
  GHCR (`ghcr.io/cerdaflorian/travel-app:latest` + tag du SHA).

Coolify tire ensuite cette image. Il n'y a **pas** de webhook de déploiement
déclenché depuis GitHub : les secrets `COOLIFY_DEPLOY_WEBHOOK` et `COOLIFY_TOKEN`
ne sont utilisés par aucun workflow.

### Secrets GitHub requis

Dans `Settings > Secrets and variables > Actions` :

```txt
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

`GITHUB_TOKEN` est fourni automatiquement pour le push sur GHCR.

## Déploiement Coolify

L'app se déploie comme **image Docker préconstruite**, pas via un build pack.

1. Dans Coolify, créer une application de type *Docker Image*.
2. Image : `ghcr.io/cerdaflorian/travel-app:latest`.
3. Port exposé : `80`.
4. Ajouter le domaine, garder HTTPS actif.

Le [`Dockerfile`](Dockerfile) construit l'app avec Node 24 puis la sert avec nginx.
Les variables `VITE_*` sont injectées **au build** (via `build-args` dans le workflow),
pas au runtime — changer une variable impose de reconstruire l'image.

### Headers de cache

Déjà configurés dans [`nginx.conf`](nginx.conf), rien à faire côté Coolify :

- `index.html`, `sw.js`, `manifest.webmanifest` → `no-cache`
- `/assets/` (hashés par Vite) → `immutable`, 1 an

## Base de données

**Deux projets Supabase : dev et prod.** `.env.local` pointe la base de
**développement** ; la production vit dans les secrets GitHub du dépôt. Toute
migration se pose d'abord sur dev, puis sur prod — la procédure complète est
dans [`supabase/README.md`](supabase/README.md).

En cas de doute sur la base qu'on lit, `npm run dev` l'annonce dans la console
du navigateur : `[supabase] base « … »`.

Les migrations SQL sont dans [`supabase/`](supabase/README.md) : schéma, RLS,
seed du voyage Japon. Elles s'appliquent **à la main** depuis le SQL Editor de
Supabase — ni le repo, ni la CI, ni le déploiement ne parlent à la base.

```sh
npm run sql:bundle | pbcopy   # toutes les migrations d'un bloc, pour une base neuve
```

```sh
npm run sql:check   # contrôle statique des fichiers SQL (tourne aussi en CI)
```

Avant le premier seed, les comptes doivent exister dans `auth.users` — à créer
depuis **Authentication → Users** du dashboard Supabase, l'app n'ayant pas
encore d'écran de connexion. Le seed rattache le voyage aux comptes existants,
et RLS le rend invisible tant que personne n'y est rattaché.
