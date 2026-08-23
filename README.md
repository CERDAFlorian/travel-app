# Travel App

Application React/Vite pour creer et gerer des itineraires de voyage personnels.

## Stack

- React + Vite pour le front
- Supabase pour la base PostgreSQL, l'authentification et le stockage des images
- Deploiement prevu sur VPS Infomaniak avec un build statique servi par Nginx

## Installation locale

```sh
npm install
cp .env.example .env.local
npm run dev
```

Renseigner ensuite `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans `.env.local`.

## Supabase

1. Creer un projet Supabase.
2. Ouvrir le SQL Editor.
3. Executer le fichier `supabase/schema.sql`.
4. Copier l'URL du projet et la cle `anon public` dans `.env.local`.

Tant que Supabase n'est pas configure, l'app actuelle continue de fonctionner avec `localStorage`.

## Build production

```sh
npm run build
```

Voir `docs/deploiement-infomaniak.md` pour le deploiement VPS.
