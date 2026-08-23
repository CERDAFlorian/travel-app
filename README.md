# Travel App

Application React/Vite minimale pour valider le deploiement Coolify.

## Installation locale

```sh
npm install
cp .env.example .env.local
npm run dev
```

Pour le moment, Supabase est installe mais vide. Les variables peuvent rester vides tant que l'app Hello World ne lit pas encore la base.

## Build production

```sh
npm run build
```

## Branches et CI/CD

- `dev` : branche de travail. Chaque push lance un build de verification.
- `main` : branche de production. Chaque push build l'app puis declenche un deploiement Coolify.

## Secrets GitHub

Dans `Settings > Secrets and variables > Actions`, ajouter :

```txt
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
COOLIFY_DEPLOY_WEBHOOK
COOLIFY_TOKEN
```

## Configuration Coolify

1. Dans Coolify, creer un nouveau projet.
2. Ajouter une nouvelle application.
3. Choisir GitHub comme source.
4. Selectionner le depot `CERDAFlorian/travel-app`.
5. Choisir la branche `main` pour la production.
6. Selectionner un build pack compatible Vite, idealement `Nixpacks` ou `Static`.
7. Renseigner les commandes :

```txt
Install Command: npm ci
Build Command: npm run build
Publish Directory: dist
```

8. Ajouter les variables d'environnement `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` quand ton projet Supabase sera cree.
9. Ajouter ton domaine dans Coolify.
10. Garder HTTPS active.
11. Deployer une premiere fois depuis Coolify.
12. Copier le `Deploy Webhook (auth required)` dans le secret GitHub `COOLIFY_DEPLOY_WEBHOOK`.
13. Creer un token API Coolify avec la permission `deploy`, puis le mettre dans `COOLIFY_TOKEN`.
