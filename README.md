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

## Variables d'environnement

| Variable | Usage |
|---|---|
| `VITE_SUPABASE_URL` | URL du projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clé publiable (elle part dans le bundle, ce n'est pas un secret) |

`.env.example` contient les valeurs du projet. `.env` et `.env.local` sont gitignorés.

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

Les migrations SQL vivront dans `supabase/`. Elles s'appliquent manuellement,
la CI ne touche jamais à la base.
