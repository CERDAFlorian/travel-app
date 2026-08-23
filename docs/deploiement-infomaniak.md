# Deploiement sur VPS Infomaniak

Cette app est une SPA Vite/React. Le deploiement le plus simple consiste a builder le dossier `dist`, puis a le servir avec Nginx.

## Variables d'environnement

Creer un fichier `.env.production` sur la machine de build :

```sh
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

Les variables `VITE_*` sont integrees au build front. La cle `anon` Supabase est publique par design, mais la securite repose sur les policies RLS du schema SQL.

## Build

```sh
npm ci
npm run build
```

Copier ensuite le contenu de `dist/` sur le VPS, par exemple dans :

```txt
/var/www/travel-app
```

## Exemple Nginx

```nginx
server {
  listen 80;
  server_name travel.example.com;

  root /var/www/travel-app;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

Pour HTTPS, ajouter un certificat Let's Encrypt avec Certbot apres pointage DNS.

## CI/CD GitHub Actions

Le projet contient deux workflows :

- `.github/workflows/check.yml` : verifie que l'app build correctement sur `dev` et sur les pull requests vers `main`.
- `.github/workflows/deploy.yml` : deploie automatiquement `main` sur le VPS.

Secrets GitHub requis :

```txt
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
VPS_HOST=ip-ou-domaine-du-vps
VPS_USER=deploy
VPS_PORT=22
VPS_DEPLOY_PATH=/var/www/travel-app
VPS_SSH_PRIVATE_KEY=cle-privee-ssh-du-user-deploy
```

Sur le VPS, le dossier `VPS_DEPLOY_PATH` doit exister et appartenir a `VPS_USER`.
