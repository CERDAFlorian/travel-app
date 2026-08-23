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

