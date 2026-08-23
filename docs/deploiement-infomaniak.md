# Deploiement sur VPS Infomaniak avec Coolify

Cette app est une SPA Vite/React. Comme Coolify est deja installe sur le VPS, il vaut mieux le laisser gerer le build, le conteneur, le domaine et HTTPS.

## Variables d'environnement

Dans Coolify, ajouter ces variables a l'application :

```sh
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

Les variables `VITE_*` sont integrees au build front. La cle `anon` Supabase est publique par design, mais la securite repose sur les policies RLS du schema SQL.

## Configuration Coolify

- Creer une nouvelle Application dans Coolify depuis le repo GitHub `CERDAFlorian/travel-app`.
- Branch de production : `main`.
- Build pack : `Nixpacks` ou `Static` pour une SPA.
- Install command : `npm ci`.
- Build command : `npm run build`.
- Public directory : `dist`.
- Activer `Is it a static site?` si l'option est disponible.
- Ajouter le domaine dans Coolify et laisser `Force HTTPS` active.

Coolify deploie les applications dans des conteneurs Docker et peut utiliser les build packs pour transformer automatiquement le code source en application deployable.

## CI/CD GitHub Actions

Le projet contient deux workflows :

- `.github/workflows/check.yml` : verifie que l'app build correctement sur `dev` et sur les pull requests vers `main`.
- `.github/workflows/deploy.yml` : verifie le build sur `main`, puis declenche le deploiement Coolify via webhook.

Secrets GitHub requis :

```txt
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
COOLIFY_DEPLOY_WEBHOOK=https://coolify.example.com/api/v1/deploy?uuid=resource-uuid&force=false
COOLIFY_TOKEN=token-api-coolify-avec-permission-deploy
```

Dans Coolify :

1. Activer l'acces API si necessaire dans `Settings > Advanced`.
2. Creer un token dans `Keys & Tokens > API Tokens` avec la permission `deploy`.
3. Copier le `Deploy Webhook (auth required)` depuis `Application > Configuration > Webhooks`.
4. Mettre le token et l'URL dans les secrets GitHub ci-dessus.
