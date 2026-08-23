# Travel App

Application React/Vite minimale pour valider le deploiement Coolify.

## Installation locale

```sh
npm install
npm run dev
```

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

8. Ajouter ton domaine dans Coolify.
9. Garder HTTPS active.
10. Deployer une premiere fois depuis Coolify.
11. Copier le `Deploy Webhook (auth required)` dans le secret GitHub `COOLIFY_DEPLOY_WEBHOOK`.
12. Creer un token API Coolify avec la permission `deploy`, puis le mettre dans `COOLIFY_TOKEN`.
