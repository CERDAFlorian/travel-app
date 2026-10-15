# Incohérences relevées — ménage du 6 octobre 2026

Relevées pendant le ménage F5 (fin de L10). Rien de ce qui suit n'a été
corrigé : chaque point attend une décision. Les suppressions faites pendant le
ménage sont résumées tout en bas.

## 1. À traiter avant le départ du 7 novembre

**Le README promet une carte hors ligne.** Le tableau « Ce qui marche hors
ligne » coche « la carte », et l'étape 4 de « Avant de partir » dit que la carte
doit s'afficher en mode avion. Depuis F1, la carte est celle de Google : elle
demande le réseau et affiche un message à la place. Le pas-à-pas de mise en prod
de L10 (étape 9) dit l'inverse du README. À corriger dans `README.md`, sinon
quelqu'un croira son voyage mal préparé en voyant la carte vide.

**✅ Corrigé le 12 octobre 2026 (L11 F3). `TravelTimes` appelle un hook après un `return`.** Le composant sort tôt quand
il n'y a aucun trajet, puis appelle `useLoveNotes`. C'est contraire aux règles
des hooks React. Sans conséquence aujourd'hui, car c'est le seul
hook du composant et qu'il ne lit qu'un contexte. Le jour où on y ajoutera un
`useState`, ajouter ou retirer le premier trajet fera planter le composant.
Correctif : remonter l'appel de `useLoveNotes` au-dessus du `return null`.

## 2. Documentation périmée

### README.md

- **Variables d'environnement** : le tableau ne cite que Supabase. Il manque
  `VITE_GOOGLE_MAPS_KEY`, `VITE_GOOGLE_MAP_ID` et `GOOGLE_MAPS_TEST_KEY`, que
  `.env.example` décrit.
- **Secrets GitHub** : le README en annonce « quatre ». `deploy.yml` en lit six,
  avec les deux de Google.
- **« L'app n'ayant pas encore d'écran de connexion »** : l'écran existe depuis
  L1.5.
- **« Les trois tournent en CI sur chaque push »** : `check.yml` tourne sur un
  push vers `dev` et sur une PR vers `main`, pas sur un push vers `main`.

### travel-app-lots-et-prompts.md

- **« État du projet — 18 septembre 2026 »** : dit que L9 et L10 ne sont « pas
  commencés » et que `main` est en retard. Les deux lots sont faits, et L10 est
  fusionné dans `main` (PR #17, le 29 septembre 2026).
- **Introduction de L10** : « Spécifié le 26 septembre 2026, pas commencé ».
- **Arbitrage 5 de L10, « Le titre reste celui de l'utilisateur »** : contredit
  par le correctif du 29 septembre, où le nom Google remplace le titre.
- **Arbitrage 1, ligne F4 du découpage et « À trancher »** : parlent encore des
  photos Google, abandonnées le 27 septembre au profit de Wikimedia et du
  copier-coller.
- **« Rôles disponibles » du thème** : la liste n'a pas suivi le contrat. Il
  manque `surface-sunken`, `surface-warm`, `surface-tint`, `surface-action`,
  `text-soft`, `accent-deep`, `map-sea` et `map-sea-edge`.

### supabase/README.md

- **`steps.images`** : décrit comme la surcharge du bandeau par mots-clés.
  Ce bandeau est retiré, et plus rien ne lit la colonne.
- **`steps.pin_x` / `pin_y`** : présentées comme un repli pour la carte SVG, qui
  n'existe plus.
- **Fin de « Contenu du seed »** : conseille de décommenter des coordonnées
  « pour s'épargner des appels à Nominatim ».

### design/README.md

- **Table des catégories** : la clé `hotel` y est libellée « Hôtel ». L'app
  affiche « Logement » depuis le 29 septembre.

## 3. Code et architecture

**Le style de la carte est celui du Japon pour tous les voyages.** Le fond Google
vient d'un seul Map ID, dont le style cloud (`design/carte-google-style.json`)
reprend la mer crème et la terre kaki du thème japonais. Un voyage en thème
`neutral` aurait une mer bleutée pendant le chargement, puis une carte aux
couleurs du Japon. C'est contraire à la règle « rien de spécifique au Japon hors
de `_japan.scss` et de la donnée ». Piste : un Map ID par thème, choisi depuis
le thème du voyage.

**Le cache hors ligne n'a pas changé de version avec L10.** `db.js` demande
d'incrémenter `SHAPE` dès qu'un champ s'ajoute à la fiche d'un voyage. L10 en a
ajouté plusieurs (`place_id`, `place_synced_at`, les champs photo) et `SHAPE`
est resté à 2. Impact faible et sans doute déjà passé : une fiche mise en cache
avant L10 s'affichait sans photos ni liens Google jusqu'à la réponse du réseau.
À retenir pour le prochain champ.

**`deploy.yml` construit l'image de prod sans lancer les contrôles.** Pas de
tests, ni `img:check`, ni `sql:check`. C'est sans danger tant que `main` ne
reçoit que des PR venues de `dev`, contrôlées par `check.yml`. Un lancement
manuel ou un push direct sur `main` partirait en prod sans filet.

**Les deux workflows n'utilisent pas les mêmes versions d'actions.**
`check.yml` est en `checkout@v6`, `deploy.yml` en `checkout@v4`.

## 4. Restes en base, à retirer par une migration

Le client ne lit ni n'écrit plus ces colonnes. Les retirer demande une migration
passée à la main sur dev puis sur prod, et une mise à jour de
`trip_by_share_token`.

| Reste | Pourquoi il est mort |
|---|---|
| `steps.photo_url`, `photo_credit`, `photo_license`, `photo_page`, `photo_checked_at`, `photo_source` | plus de photo de ville depuis le 29 septembre |
| `steps.images` | le bandeau par mots-clés est retiré |
| `steps.pin_x`, `steps.pin_y` | placement manuel sur la carte SVG |
| `items.geocoded_at` | trace de Nominatim, plus jamais posée |
| règle de stockage `steps/<id>/…` | on ne colle plus de photo sur une ville |

## 5. Laissé en place volontairement

- **`dev-carte.html`, `dev-carte.voyage.json`, `src/dev-carte.jsx`** : la page
  d'essai de F1, hors git. Elle contient l'export du vrai voyage et ne se
  retrouve nulle part ailleurs, donc je ne l'ai pas supprimée. À effacer à la
  main quand elle ne sert plus.
- **Le dossier `design/`** : référence de conception, utile tant que l'app suit
  la maquette.
- **`--sp-8` et `--fs-3xl`** : inutilisés, mais ce sont les derniers barreaux
  d'échelles complètes. Les retirer n'apporte rien.

## Ce que le ménage a supprimé

- **Nominatim** (`lib/geocode.js`) et son test. La lecture de coordonnées
  collées, encore utile, vit désormais dans `lib/geo.js` avec ses tests.
- **La carte SVG** : `lib/projection.js`, `data/japan-geometry.js`,
  `lib/labels.js`, `scripts/build-map.mjs`, le script `npm run map` et leurs
  tests. La mesure d'un nom, encore utile, vit dans `lib/mapGeometry.js`.
- **Quatre fonctions jamais branchées** : `walkMinutes`, `canMoveStep`,
  `slotLabel`, `clearCoordinates`.
- **Jetons de thème inutilisés** : `map-land`, `map-land-line`, les six
  `--cat-*-soft` et cinq des six `--z-*`.
- **La frise `deco-band`**, précachée mais jamais affichée par l'app.
- **Le doublon de la police Lora** : deux fichiers identiques pour 600 et 700.
  `build-fonts.mjs` télécharge désormais une fois le fichier variable, déclaré
  pour les deux graisses. L'app installée n'est pas gênée par le renommage, car
  le service worker recharge la feuille des polices sans passer par le cache du
  navigateur.
- **La lecture des champs photo et `images` des étapes** dans `api.js`, et
  l'effacement de photo, devenu sans objet, quand on déplace une étape.
- **Divers** : un import inutilisé dans `FlightsPanel`, les `.gitkeep` de
  dossiers non vides, et le cache du CLI Supabase, commité par erreur et
  désormais ignoré.
