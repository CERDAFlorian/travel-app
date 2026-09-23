import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // autoUpdate : le service worker remplace l'ancien dès qu'une nouvelle
      // version est là. Pas de bandeau « une mise à jour est disponible » —
      // il faudrait le voir et cliquer, or l'app sert surtout quand on n'a ni
      // réseau ni envie de s'occuper d'elle.
      registerType: 'autoUpdate',
      // Pas de `includeAssets` : `globPatterns` capture déjà les PNG. Les deux
      // ensemble inscrivaient chaque icône DEUX FOIS au précache, avec des
      // révisions différentes — ce que Workbox refuse, et l'installation du
      // service worker échouait.

      workbox: {
        // Le shell ET les images. Les 31 WebP font 311 Ko : les précacher
        // coûte un téléchargement à l'installation et évite sept bandeaux
        // photo vides dans un train sans réseau.
        globPatterns: ['**/*.{js,css,html,webp,png,woff2,svg}'],
        // Les icônes déclarées au manifest sont précachées par le plugin
        // lui-même : les reprendre ici les inscrirait deux fois, avec des
        // révisions différentes, et Workbox refuse l'installation.
        // apple-touch-icon n'est pas au manifest (iOS le lit depuis le HTML),
        // il reste donc capté par le glob.
        globIgnores: ['icon-*.png'],
        // Toute navigation retombe sur index.html : le routeur prend ensuite
        // la main, y compris sur /voyage/:slug et /partage/:token.
        navigateFallback: '/index.html',
        // Aucun cache d'exécution n'est déclaré, et c'est voulu : les appels
        // Supabase doivent toucher le réseau ou échouer franchement — c'est
        // IndexedDB qui porte la donnée hors ligne, pas le service worker.
        // Nominatim non plus : géocoder hors ligne n'a aucun sens.
        cleanupOutdatedCaches: true,
      },

      manifest: {
        name: 'Itinéraire',
        short_name: 'Itinéraire',
        description: "Préparation et consultation hors ligne d'itinéraires de voyage.",
        lang: 'fr',
        // standalone : plein écran, sans barre d'adresse. C'est aussi ce qui
        // exempte l'app de la purge des données à 7 jours de Safari.
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        background_color: '#f6f7f8',
        theme_color: '#2f5d8c',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { port: 5173 },

  test: {
    // DES VALEURS BIDON, ET C'EST VOULU.
    //
    // Les tests de rendu importent des composants qui remontent jusqu'à
    // `lib/supabase.js`, lequel LÈVE au chargement quand la configuration
    // manque — c'est délibéré, un client null se propagerait en « cannot read
    // properties of null » à des dizaines de lignes de la vraie cause.
    //
    // En local, `.env.local` le nourrissait sans qu'on y pense ; la CI n'en a
    // pas, et les deux suites tombaient à l'import. Les tests ne joignent
    // jamais le réseau : le client est construit, jamais appelé.
    //
    // Surtout, ces valeurs empêchent un test de toucher la VRAIE base par
    // accident. Le jour où un test appellera Supabase pour de bon, il échouera
    // sur une URL qui n'existe pas plutôt que d'écrire dans la production.
    env: {
      VITE_SUPABASE_URL: 'https://base-de-test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'cle-publishable-de-test',
    },
  },
});
