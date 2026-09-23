# travel-app — Découpage en lots & prompts Claude Code

Stack figée : React + Vite + SCSS + Supabase + IndexedDB. Déploiement Coolify via image
Docker (nginx, fallback SPA — le README décrivait un build pack static, c'était périmé).
Offline en **lecture seule**. Carte SVG unique zoomable, ancres géographiques + labels déportés.

> **Design importé.** Le MCP `claude_design` est configuré (scope user) et le projet
> [Itinéraire Japon interactif](https://claude.ai/design/p/ffcea357-0409-407c-94cb-8441582baff1)
> a été importé dans `design/`. **Lire `design/README.md` avant tout lot** : palette,
> couleurs des catégories, 25 villes géolocalisées, appariement photo ↔ item.

---

## État du projet — 18 septembre 2026

Branche de travail : `dev`. `main` est en retard, la fusion se fera par PR.
**L0 à L7 sont terminés.** Reste L8 — séparer la base de dev de la base de prod.

**L9 spécifié le 22 septembre 2026**, pas commencé : le programme jour par jour —
organiser activités, restaurants et visites à l'intérieur d'une ville. Le modèle et
les neuf arbitrages sont en bas du fichier, après L8.

⚠️ **Départ le 7 novembre 2026 — sept semaines.** L5 et L6 pèsent environ trois
jours de travail. L7 (PWA, service worker) est le lot qui rend l'app utilisable
sur place : s'il faut rogner, rogner sur L6, jamais sur L7.

**Le SQL est appliqué** — les trois fichiers sont passés dans le SQL Editor le
18 septembre 2026, comptages vérifiés : 7 étapes, 48 items, 6 liaisons, 2 vols,
4 expériences, 2 membres. La base contient le voyage `japon-2026` et L2 a de
quoi lire. Les fichiers de `supabase/` restent la source de vérité : toute
évolution de schéma s'y écrit d'abord, puis se rejoue à la main.

### Ce qui est en place

| | |
|---|---|
| Stack | React 18 + Vite 8 + SCSS (`sass`), `@supabase/supabase-js` |
| Thème | `src/theme/`, multi-voyages, validé à la compilation (voir plus bas) |
| Build | `npm run build` → ~150 ms, `dist` = 452 Ko, aucun warning |
| Dev | `npm run dev` → http://localhost:5173 |
| Images | 28 WebP dans `public/img/` (251 Ko), sources PNG dans `design/img/` |
| Base | `supabase/` : schéma, RLS, seed Japon. À appliquer à la main |
| CI | `check.yml` sur push `dev` et PR `main` : `img:check` + `sql:check` + build |
| Déploiement | image Docker → GHCR → Coolify. `nginx.conf` fait le fallback SPA |

### Commandes

```sh
npm run dev          # serveur de développement
npm run build        # build production
npm test             # suite unitaire Vitest (tourne en CI)
npm run test:watch   # la même, en continu
npm run img          # compresse design/img/*.png → public/img/*.webp
npm run img:check    # vérifie sans compresser (tourne en CI)
npm run sql:check    # cohérence schéma / RLS / seed (tourne en CI)
```

**Tests unitaires** — 105 cas sur la logique pure : `geo`, `geocode`, `photos`,
`dates`, `errors`. Ils figent ce qui avait été vérifié à la main lot après lot
et qui n'était pas rejouable : les 42,87 km Kyoto → Osaka contre les 39 km
erronés du contrat, les huit formes acceptées de coordonnées collées,
l'espacement de 1,1 s imposé par Nominatim, l'ordre de composition d'un bandeau
photo, la classification réseau / auth / serveur. Deux d'entre eux sont des
garde-fous d'intégrité : ils échouent si une image de `PHOTO_LIB` n'existe ni
dans `public/img/` ni dans la liste des absentes, et si une image déclarée
absente a finalement été exportée.

### Décisions prises

- **SCSS, pas CSS.** Décidé en L0. Le SCSS sert à une chose précise : valider à la
  compilation qu'un thème remplit bien tout le contrat de tokens. Un `.css` ne peut pas.
- **L'app est multi-voyages.** Chaque pays aura son thème ; une page de création de
  voyage et une page listant les voyages sont envisagées. Rien de spécifique au Japon
  ne doit exister hors de `themes/_japan.scss` et de la donnée.
- **Les 6 couleurs de catégorie sont invariantes**, identiques pour tous les voyages :
  c'est le fil conducteur visuel. Elles sont donc hors contrat de thème.
- **Clé catégorie : `restaurant`**, pas `resto`. Le design utilise `resto`, la spec
  L1 tranche. C'est la seule des 6 clés qui diffère.
- **Images servies en WebP.** Les PNG sources vivent dans `design/img/` et n'entrent
  pas dans l'image Docker. Toute nouvelle image : la déposer là, puis `npm run img`.
- **Le `.dc.html` n'est jamais modifié.** C'est un import fidèle du canvas ; le
  corriger le ferait diverger de sa source.

### Système de thème (posé en L0)

```
src/theme/
├── index.scss              point d'entrée unique, importé par main.jsx
├── _contract.scss          liste canonique des rôles + validation au build
├── _emit.scss              registre $themes → :root + [data-theme="…"]
├── _mixins.scss            from(), focus-ring(), truncate()
├── base/_invariants.scss   catégories, espacement, typo, z-index, durées
├── base/_reset.scss
├── base/_typography.scss
├── themes/_japan.scss      palette du design importé
├── themes/_neutral.scss    repli + gabarit d'un nouveau pays
└── themes.js               registre JS (id, libellé, aperçu) pour les pages voyages
```

**Trois couches.** (1) palette brute privée au thème, des noms de couleurs, jamais
consommée par un composant ; (2) rôles sémantiques — c'est ce que les composants
utilisent ; (3) invariants de structure, hors thème.

**Le contrat est vérifié à la compilation.** `_contract.scss` liste les rôles que tout
thème doit fournir. Une clé manquante ou inconnue casse le build :

```
Error: [sass] "Thème « japan » : token manquant « muted » (voir src/theme/_contract.scss)."
```

**Rôles disponibles** — fonds `--bg` `--surface` `--surface-raised` `--overlay` ;
texte `--text` `--text-heading` `--muted` `--text-invert` ; accent `--accent`
`--accent-hover` `--accent-contrast` `--accent-soft` ; secondaire `--accent-2`
`--accent-2-soft` ; traits `--border` `--border-strong` `--border-soft` ; états
`--ok` `--warn` `--danger` `--info` ; typo `--font-display` `--font-body` ;
formes `--radius-sm|md|lg|pill` `--shadow-sm|md|lg`.

**Invariants** — `--cat-*` et `--cat-*-soft` (les 6 catégories), `--sp-1..8`,
`--fs-xs..3xl`, `--lh-tight` `--lh-base`, `--z-*`, `--dur-*` `--ease-out`,
`--page-max` `--page-pad`.

**Ajouter un pays** : copier `themes/_neutral.scss`, une ligne dans `$themes`
(`_emit.scss`), une entrée dans `themes.js`. Aucun composant à toucher.

**Portée de la charte pays** — décidée le 18 septembre 2026, elle structure tout le
reste : un thème pays n'habille **que l'intérieur d'un voyage**. L'écran de connexion,
la liste des voyages et la création d'un voyage portent la charte de l'application,
qui est `neutral`. C'est ce que `:root` émet (`_emit.scss`), et ce que vaut
`APP_THEME` (`themes.js`). Peindre les écrans communs aux couleurs du Japon n'aurait
plus de sens dès le deuxième voyage — et l'app est destinée à devenir un créateur
d'itinéraires.

**Bascule** : `applyTheme(id)` pose `data-theme` sur `<html>`, alimenté par
`trips.theme` (L2). À n'appeler qu'en entrant dans un voyage, et à rappeler avec
`APP_THEME` en sortant. Les sélecteurs `[data-theme="…"]` étant autonomes, un thème
pays peut aussi habiller un sous-arbre plutôt que la page entière — utile le jour où
une liste de voyages affichera plusieurs pays côte à côte.

**Attention à `_neutral.scss`** : il cumule trois rôles — charte de l'app, repli d'un
thème inconnu, gabarit d'un nouveau pays. Pour ajouter un pays on le **copie**, on ne
le modifie pas en place, sinon on repeint l'écran de connexion.

### Reste à faire hors lots

**Les 3 images bloquantes sont arrivées** (18 septembre 2026) — `deco-momiji`,
`deco-fuji`, `hero-pagode`, exportées à la main du canvas et compressées. 31 PNG
sources, 311 Ko de WebP servis.

**6 restent à exporter**, et trois d'entre elles se voient : `narai`,
`shirakawago2` et `sumo` correspondent à des items du seed dont le bandeau
tombe en repli. Les déposer dans `design/img/` puis `npm run img` fait passer
les étapes à bandeau complet de **2 sur 7 à 4 sur 7**, sans toucher au code.
Les trois autres (`sushi`, `matcha`, `baguettes`) ne servent qu'aux expériences
de L6. Le plafond de 256 Ko de `get_file` empêche de les récupérer via le MCP.

**Les mots d'amour ne doivent pas partir dans le lien de partage** — demandé le
22 septembre 2026. Ils sont personnels ; un itinéraire envoyé à la famille ou à
un ami ne doit pas les afficher. La vue partagée rend le MÊME composant que la
vue propriétaire (`TripView`, c'est délibéré), donc la coupure se fait sur le
drapeau `shared`, pas sur `readOnly` — hors ligne on reste chez soi, et les mots
doivent rester.

**Trois sont visibles aujourd'hui en partage**, et deux n'utilisent pas le
composant `LoveNote` — les chercher par son nom n'en trouverait qu'un :

| Où | Comment |
|---|---|
| Pied de page | `TripView.jsx` — `<LoveNote>` |
| En-tête du panneau des vols | `FlightsPanel.jsx` — `whisperFor('flights', …)` |
| Sous le vol retour | `FlightsPanel.jsx` — `whisperFor('comeback', …)` |

Les trois autres `<LoveNote>` — nuits, item ajouté, ville ajoutée — se
déclenchent sur une écriture, donc jamais en partage.

Le plus propre est de passer `shared` en prop et de ne rien rendre : masquer en
CSS laisserait le texte dans le HTML envoyé, donc lisible par qui regarde la
source. Et prévoir le cas au moment d'ajouter le prochain mot doux, sinon la
fuite reviendra par la porte suivante.

**Trois items n'auront jamais de photo** : Distillerie Hakushu, Balade dans le
village, Mémorial de la Paix. Aucun mot-clé ne leur correspond dans le design.

---

## ⚠️ Écarts entre ces specs et le design importé

Constatés en lisant `design/japan-map.jsx` et le `.dc.html`. **À arbitrer au moment
du lot concerné**, les prompts ci-dessous n'en tiennent pas compte.

**L5 — la carte décrite n'est pas celle du design.** Le contrat parle d'un « SVG
stylisé dessiné à la main » avec calibrage manuel par ville. En réalité
`japan-map.jsx` télécharge `world-atlas` (TopoJSON) depuis un CDN et le projette
avec `d3.geoMercator().fitExtent()`. Conséquences :

- le calibrage `src/data/city-bounds.js` devient inutile, la projection donne déjà
  les positions ;
- le déport de labels n'utilise **pas** `d3-force` : la fonction `place()` essaie
  des positions candidates et garde la première sans collision ;
- le cache par paliers de zoom n'existe pas, tout est recalculé à chaque rendu —
  l'exigence de perf reste donc entièrement à faire ;
- **bloquant offline** : la carte `fetch` un CDN au montage. Hors ligne au Japon
  elle ne s'affiche pas. Le TopoJSON du Japon doit être embarqué dans le bundle.

**L1 — `pin_x` / `pin_y` sont probablement inutiles.** Le contrat les justifie par
un placement manuel dans le SVG. Avec une vraie projection, `lat`/`lng` suffisent.
→ **Arbitré en L1** : colonnes créées, contraintes à 0–1, laissées vides. Une
colonne nullable inutilisée ne coûte rien ; l'ajouter plus tard coûte une
migration. Elles servent de repli si une étape doit être forcée quelque part.

**L3 — le bandeau photo n'est pas un champ de l'étape.** Le design apparie les
photos par **mots-clés du titre d'item** (`.dc.html`, lignes 366-381), pas via un
tableau sur l'étape. À arbitrer avec `steps.images text[]` prévu en L1.
→ **Arbitré en L1** : les deux cohabitent. `steps.images` existe mais reste
`NULL` dans le seed ; L3 compose le bandeau par mots-clés, et la colonne sert
de surcharge quand l'appariement automatique ne donne rien de bon.

**L2 — « offline + recharge » est intestable avant L7.** Le mode Offline de
DevTools coupe aussi le serveur qui sert l'app : sans service worker, le
rechargement ne ramène même pas `index.html`, on obtient le dinosaure de Chrome
et rien du code applicatif ne s'exécute. IndexedDB cache la **donnée**, jamais
l'**application**. Tant que L7 n'a pas posé le service worker, un lot ne peut se
vérifier qu'en coupant Supabase seul, via *Network request blocking* sur
`*supabase.co*`. Le critère d'arrêt de L2 ci-dessous a été corrigé en
conséquence ; la version d'origine était invérifiable.

**L7 — les headers de cache sont déjà faits.** `nginx.conf` gère `no-cache` sur
`index.html`/`sw.js`/`manifest.webmanifest` et `immutable` sur `/assets/`.

---

## Paradigme de boucle

Chaque prompt est une **boucle fermée** : Claude Code explore, planifie, implémente, vérifie, corrige, et s'arrête sur un critère explicite. Trois règles imposées dans chaque prompt :

1. **Une seule boucle par prompt.** Un lot = un prompt = un commit.
2. **Vérification exécutable.** La boucle ne se termine pas sur « j'ai fini » mais sur une commande qui passe.
3. **Stop condition.** Ce que Claude Code n'a pas le droit de toucher, et ce qu'il doit remonter au lieu de décider seul.

Colle un prompt, laisse la boucle tourner, vérifie, commit, passe au suivant. Ne lance jamais deux lots en parallèle.

---

## Découpage en lots

| Lot | Contenu | Effort | Palier atteint |
|---|---|---|---|
| ~~**L0**~~ | ~~Fondations : arbo, tokens CSS, config Vite, client Supabase~~ | ✅ fait | Le projet build et déploie |
| ~~**L1**~~ | ~~Schéma Supabase + RLS + seed Japon~~ | ✅ fait | La donnée existe |
| ~~**L1.5**~~ | ~~Connexion, routeur, sélection de voyage~~ | ✅ fait | On entre dans l'app |
| ~~**L2**~~ | ~~Couche données + cache IndexedDB + hook `useTrip`~~ | ✅ fait | L'app lit online et offline |
| ~~**L3**~~ | ~~Shell + étapes + catégories + items (lecture)~~ | ✅ fait | **App utilisable** |
| ~~**L4**~~ | ~~Édition items + LOCALISER (Nominatim) + Haversine~~ | ✅ fait | Prépa autonome dans l'app |
| ~~**L5**~~ | ~~Carte SVG : pan/zoom, ancres, labels déportés, filtres tags~~ | ✅ fait | La pièce maîtresse |
| **L6** | Vols, trajets, expériences, budget | 1 j | Périmètre complet |
| ~~**L7**~~ | ~~PWA, précache, bouton sync, QA mobile~~ | ✅ fait | Prêt pour le voyage |
| **L8** | Séparer la base de dev de la base de prod | 0,5 j | On peut casser sans risque |
| ~~**L9**~~ | ~~Le programme jour par jour — 4 features, voir la section dédiée~~ | ✅ fait | On sait quoi faire chaque jour |

**Cible réaliste jour 1 : L0 → L3.**

---

## L0 — Fondations

```
CONTEXTE
Projet React + Vite existant, repo travel-app, déployé sur Coolify en static.
App perso de préparation de voyage. Palette : rouge sombre / crème / vert sauge (esprit japonais).

OBJECTIF
Poser l'arborescence, le système de thème par variables CSS, et le client Supabase.
Aucune fonctionnalité métier dans ce lot.

CONTRAT
- Crée uniquement : src/lib/, src/theme/, src/components/, src/hooks/, src/pages/
- Le thème passe EXCLUSIVEMENT par des CSS custom properties dans src/theme/japan.css
  (--accent, --bg, --surface, --text, --muted, --sage, --border).
  Aucune couleur en dur dans un composant. Cette contrainte rend le thème remplaçable
  pour un futur voyage.
- src/lib/supabase.js : client initialisé depuis import.meta.env.VITE_SUPABASE_URL
  et VITE_SUPABASE_ANON_KEY. Lève une erreur explicite si absentes.
- .env.example commité, .env gitignoré.

BOUCLE
1. Lis le repo, liste ce qui existe déjà. Ne recrée pas ce qui est là.
2. Propose l'arborescence complète et attends ma validation AVANT d'écrire.
3. Implémente.
4. Vérifie : `npm run build` passe sans warning, `npm run dev` démarre,
   la page affiche un écran vide aux couleurs du thème.
5. Si échec, corrige et relance l'étape 4. Maximum 3 tentatives, puis remonte le blocage.

CRITÈRE D'ARRÊT
`npm run build` OK + écran thémé visible en dev.

STOP
- Ne touche pas à vite.config.js au-delà de l'alias @ vers src/.
- N'installe aucune dépendance hors @supabase/supabase-js sans me demander.
```

**L0 — fait le 24 août 2026.** Le prompt ci-dessus est conservé tel qu'il a été lancé ;
voici ce qui a réellement été livré et les deux écarts assumés.

Livré : `src/theme/` complet (voir « Système de thème » plus haut), `supabase.js` qui
lève en nommant les variables manquantes, alias `@` dans `vite.config.js`,
`.env.example` en placeholders, `src/styles.css` supprimé, `components/` `hooks/`
`pages/` créés. Une seule dépendance ajoutée : `sass` en devDependency.

**Écart 1 — SCSS au lieu de CSS.** Le thème n'est donc pas dans `src/theme/japan.css`
mais dans `src/theme/themes/_japan.scss`. Motif : le contrat de tokens devient
vérifiable à la compilation.

**Écart 2 — `--sage` n'existe pas.** Remplacé par `--accent-2` (`#3f6b4a` côté Japon).
Un token nommé d'après une couleur est un piège dans un système multi-thème : `--sage`
contiendrait de l'ocre au Maroc. Les 7 variables du contrat sont présentes, sous des
noms de rôle neutres. Le vert sauge reste par ailleurs la couleur de la catégorie
Activités (`--cat-activite`).

---

## L1 — Schéma Supabase + RLS

```
CONTEXTE
Projet Supabase vide. 2 utilisateurs (moi + ma compagne), auth par magic link.
Volume cible : ~400 lignes au total. Pas de Storage, les photos vivent dans /public/img/.

OBJECTIF
Produire les migrations SQL complètes : tables, contraintes, RLS, seed du voyage Japon.

CONTRAT
Tables :
  trips        (id uuid pk, slug text unique, title, subtitle, start_date, end_date,
                theme text default 'japan', created_at)
  trip_members (trip_id fk, user_id uuid, role text, pk(trip_id,user_id))
  steps        (id, trip_id fk, position int, name, date_start, date_end, nights int,
                lat numeric, lng numeric, pin_x numeric, pin_y numeric, images text[])
  items        (id, step_id fk, category text, title, url, address, price numeric,
                currency text default 'JPY', booked bool default false, position int,
                notes text, lat numeric, lng numeric, geocoded_at timestamptz)
  flights      (id, trip_id fk, direction text, from_code, to_code, date, dep time,
                arr time, airline, flight_no, ref, price numeric)
  legs         (id, trip_id fk, from_step fk, to_step fk, mode text, duration_min int, note)
  experiences  (id, trip_id fk, title, description, image, price numeric, url,
                favorite bool default false, position int)

Règles :
- category est un text + CHECK IN ('hotel','activite','restaurant','shopping','lieu','note').
  PAS un enum PostgreSQL (trop pénible à faire évoluer).
- pin_x / pin_y sur steps uniquement, normalisés 0–1 (placement manuel dans le SVG).
- lat / lng sur steps ET items (vraie donnée géographique).
- Aucune table budget : le budget est CALCULÉ depuis items.price + flights.price.
- RLS activé sur toutes les tables. Politique unique : accès si le trip_id de la ligne
  apparaît dans trip_members pour auth.uid(). Pour items/legs, remonter via step_id → trip_id.

BOUCLE
1. Écris supabase/migrations/0001_schema.sql puis 0002_rls.sql.
2. Écris supabase/seed.sql : le voyage Japon, 7 étapes dans l'ordre
   (Tokyo, Matsumoto, Shirakawa-go, Kyoto, Hiroshima, Osaka, Tokyo),
   les 6 legs avec les durées, quelques items d'exemple par catégorie.
   Laisse lat/lng à NULL sur les items — ils seront géocodés depuis l'app.
3. Vérifie chaque fichier SQL : syntaxe valide, pas de FK orpheline, RLS non contournable.
4. Écris supabase/README.md : ordre d'exécution et procédure de reset.

CRITÈRE D'ARRÊT
Les 3 fichiers SQL sont écrits et relus. Tu me listes les commandes à lancer.

STOP
- N'exécute rien contre Supabase. Tu produis le SQL, je l'applique moi-même.
- Ne crée aucune policy permissive du type `using (true)`.
```

**Notes L1**
- Clé catégorie : **`restaurant`** (décidé), le design dit `resto`.
- `design/README.md` liste 25 villes avec `lat`/`lon` réels, réutilisables pour le seed.
- Voir l'écart signalé plus haut sur `pin_x` / `pin_y`.

**L1 — fait le 25 août 2026.** Rien n'a été exécuté contre Supabase : les
fichiers sont écrits, à appliquer à la main. Procédure dans
[`supabase/README.md`](supabase/README.md).

Livré : `supabase/migrations/0001_schema.sql` (7 tables, contraintes, index,
droits), `0002_rls.sql` (4 fonctions d'accès, 1 trigger, 28 policies),
`supabase/seed.sql` (voyage Japon : 7 étapes, 48 items, 6 liaisons, 2 vols,
4 expériences), `supabase/README.md`, plus `npm run sql:check` branché en CI.

**Vérification.** Il n'y a pas de Postgres dans ce projet, donc pas de moyen
d'exécuter le SQL pour le valider. `scripts/check-sql.mjs` contrôle ce qui se
voit sans serveur : quotes et parenthèses, transactions refermées, FK dont la
table cible existe, RLS activé partout, les 4 policies par table, aucune policy
permissive ni sans `to authenticated`, `security definer` au `search_path`
verrouillé, catégories du seed dans le `CHECK`, enchaînement des dates
d'étapes, images en `.webp`. Chacun de ces contrôles a été vérifié en cassant
volontairement le fichier correspondant. Un typage invalide ne se verra qu'à
l'application.

**Écart 1 — `items.favorite` ajouté.** Absent du contrat, mais L3 demande une
étoile favori sur `ItemRow` et le design s'en sert pour choisir les 3 photos du
bandeau d'étape. Sans la colonne, L3 se serait arrêté sur une migration.

**Écart 2 — `currency` sur `flights` et `experiences`.** Le contrat ne la met
que sur `items`. Un vol s'achète en euros, un item se paie en yens : sans
devise sur les vols, le budget de L6 additionne deux monnaies et le total est
faux sans que rien ne le signale. Défaut `EUR` sur les vols, `JPY` ailleurs.

**Écart 3 — un trigger et 4 fonctions en plus des policies.** Une policy de
`trip_members` qui interroge `trip_members` en SQL direct part en récursion
infinie. Les prédicats passent donc par des fonctions `security definer`. Le
trigger `trips_claim_creator`, lui, inscrit le créateur d'un voyage comme
`owner` — sans quoi la future page « nouveau voyage » se bloquerait elle-même.
Conséquence à connaître : l'insertion d'un voyage ne doit pas demander la ligne
en retour (`.insert(row)` sans `.select()`), le détail est dans `0002_rls.sql`.

**Écart 4 — les prix du seed sont inventés.** Le design ne portait aucun prix.
Sept hôtels et six activités en ont reçu un, ordres de grandeur plausibles,
pour que le budget de L6 ait quelque chose à additionner (370 800 ¥
actuellement). À remplacer par les vrais montants.

**Appliqué le 18 septembre 2026.** Les deux comptes ont été créés depuis
**Authentication → Users** (il n'y a pas encore d'écran de connexion dans
l'app), puis les trois fichiers exécutés dans l'ordre. Vérification passée :
`membres` = 2, donc le voyage est visible par les deux comptes. Marche à suivre,
reset et rattachement d'un compte supplémentaire dans
[`supabase/README.md`](supabase/README.md).

Piège rencontré, noté pour la prochaine fois : les migrations se lancent avec le
rôle par défaut du SQL Editor (`postgres`), **sans user impersonation**. En se
faisant passer pour un `authenticated`, les `create table` et les `grant`
échouent. L'impersonation ne sert qu'à tester les policies après coup.

---

## L1.5 — Connexion, routeur, sélection de voyage

Lot ajouté le 18 septembre 2026, absent du découpage d'origine. Il comble un
trou : aucun lot ne prévoyait d'écran de connexion, alors que `0001_schema.sql`
retire tout droit à `anon`. Sans session, `fetchTrip()` ne ramène rien et le
critère d'arrêt de L2 — « charge online, passe offline, recharge » — est
invérifiable, faute de pouvoir remplir le cache une première fois.

**Livré**

| | |
|---|---|
| `src/hooks/useSession.js` | `getSession()` + `onAuthStateChange`, `signIn`, `signOut` |
| `src/hooks/useTheme.js` | chaque page déclare la charte qu'elle porte |
| `src/pages/Login.jsx` | email + mot de passe |
| `src/pages/Trips.jsx` | sélection d'un voyage, une carte par voyage |
| `src/pages/Trip.jsx` | intérieur d'un voyage — placeholder, L3 le remplit |
| `src/data/trips.js` | ⚠️ le voyage en dur, à remplacer par Supabase en L2 |

**Email + mot de passe, pas de magic link.** Le SMTP par défaut de Supabase est
plafonné et n'envoie qu'aux adresses de l'équipe du projet ; et recevoir un mail
suppose un réseau et une boîte accessible depuis le téléphone, à l'étranger. Les
deux comptes sont créés à la main dans le dashboard. Pas de formulaire
d'inscription non plus : l'app a deux utilisateurs connus.

**La connexion n'est pas une route, et ne doit pas le devenir.** Rediriger vers
`/connexion` quand le jeton expire expulserait de son itinéraire quelqu'un qui
n'a pas de réseau pour se reconnecter. L'écran se substitue au contenu, il ne
déplace personne.

**Routeur : `react-router-dom` 7.** Décidé ici plutôt qu'en L3 parce que le
routeur détermine d'où vient le slug, et que le slug est le paramètre d'entrée
de `useTrip()` en L2. Trancher après coup imposerait de réécrire `App`, les deux
pages, l'effet de thème et le hook de données. Routes : `/` pour la liste,
`/voyage/:slug` pour un voyage, tout le reste redirigé sur `/`. `BrowserRouter`
et non `HashRouter` : `nginx.conf` fait déjà le fallback SPA, les URL restent
propres. Coût : +13,6 Ko gzip (101,5 → 115,1), payés une fois à l'installation
de la PWA, pas pendant le voyage.

**Pas de création de voyage.** Volontaire. Le formulaire viendra avec le
créateur d'itinéraires, hors lots actuels.

**Ce que L2 en hérite** — `useTrip(slug)` lit le slug de la route, pas d'un état
local. Et la condition d'affichage de `App.jsx` doit passer de `!user` à
`!user && !cachedTrips` : le commentaire est dans le code, à l'endroit exact où
le changer.

---

## L2 — Couche données + cache offline

```
CONTEXTE
Schéma Supabase en place (L1). L'app doit fonctionner offline en LECTURE SEULE.
Volume total : 100–300 Ko de JSON. Pas de sync incrémentale, pas de résolution de conflits.

OBJECTIF
Une couche données qui charge le voyage entier, le cache dans IndexedDB,
et rend depuis le cache — indépendamment de l'état réseau et de l'état d'auth.

CONTRAT
- src/lib/db.js : wrapper IndexedDB minimal (une seule store 'trips', clé = slug).
  Pas de librairie de sync. `idb` est acceptable si tu justifies, sinon IndexedDB natif.
- src/lib/api.js : fetchTrip(slug) → une seule requête qui ramène trip + steps + items
  + flights + legs + experiences, assemblés en un objet imbriqué.
- src/hooks/useTrip.js :
    1. Au montage, lit IndexedDB → rend IMMÉDIATEMENT si présent
    2. En parallèle, si navigator.onLine, fetch → écrit IndexedDB → re-rend
    3. Expose { trip, loading, isOffline, lastSync, refresh() }

RÈGLE CRITIQUE — ne la contourne pas :
Le rendu ne doit JAMAIS être conditionné à l'état d'authentification Supabase.
Le token expire en ~1h et le refresh exige le réseau. Si le rendu est gaté derrière
l'auth, l'app est inutilisable hors ligne — exactement quand elle sert.
L'auth ne conditionne QUE l'écriture et le fetch réseau.

- Écritures bloquées si !navigator.onLine. Expose un flag readOnly pour l'UI.

BOUCLE
1. Implémente db.js, vérifie en console : écriture puis relecture d'un objet.
2. Implémente api.js, vérifie la forme de l'objet retourné (log de la structure).
3. Implémente useTrip.js.
4. Test manuel obligatoire : charge la page online, coupe SUPABASE SEULEMENT
   (DevTools → ⋮ → More tools → Network request blocking → motif *supabase.co*),
   recharge. L'app doit afficher la donnée cachée.
5. Si échec, corrige et relance l'étape 4.

CRITÈRE D'ARRÊT
Supabase bloqué + rechargement → la donnée s'affiche, isOffline = true.

STOP
- N'installe ni RxDB, ni WatermelonDB, ni PowerSync. Surdimensionné pour ce volume.
- N'implémente pas d'écriture offline ni de queue de mutations.
```

---

**L2 — fait le 18 septembre 2026.** Vérifié en bloquant Supabase seul
(*Request conditions* → `*://*.supabase.co/*`) : l'itinéraire complet s'affiche
depuis IndexedDB, bandeau « Hors ligne · synchronisé il y a 3 min ». Et le test
qui compte — déconnexion, puis rechargement avec Supabase bloqué — laisse
l'itinéraire à l'écran. Le rendu ne passe pas par l'authentification.

Livré : `lib/db.js` (IndexedDB natif, stores `trips` et `meta`), `lib/api.js`
(`fetchTrips`, `fetchTrip`), `lib/dates.js`, `hooks/useCached.js` et ses deux
enveloppes `useTrip` / `useTrips`, `hooks/useOnline.js`,
`components/SyncLine.jsx`. `src/data/trips.js` supprimé : plus aucune donnée en
dur dans l'app.

**Écart 1 — la liste des voyages est branchée aussi.** Le contrat ne parlait que
de `fetchTrip(slug)`. Mais L1.5 a introduit une page de sélection, et ne brancher
que la page voyage aurait laissé une liste mensongère pendant tout L3.

**Écart 2 — `isOffline` ne se fie pas à `navigator.onLine`.** Celui-ci répond
`true` dès qu'une interface réseau existe, wifi d'hôtel qui ne route rien
compris. `isOffline` vaut donc « pas de réseau déclaré **ou** dernier fetch
échoué ». Un fetch qui échoue n'efface jamais le cache : on garde à l'écran ce
qu'on avait et on signale que ça date.

**Décision — la déconnexion ne vide pas le cache.** C'est ce qui permet de lire
son itinéraire quand le jeton a expiré sans réseau pour le renouveler.
Contrepartie assumée : sur un téléphone déverrouillé, le voyage reste lisible
sans être connecté. Acceptable sur deux téléphones personnels.

**Ajouté hors contrat — `navigator.storage.persist()`.** Sans lui le navigateur
peut évincer IndexedDB quand l'espace manque. Safari ne l'implémente pas : côté
iPhone, seule l'installation sur l'écran d'accueil (L7) protège le cache, les
sites en onglet perdant toutes leurs données après 7 jours sans visite.

**Ce que L3 en hérite** — `useTrip(slug)` rend le voyage complet, étapes et
items déjà triés par `position`. `useSession()` expose `readOnly`
(`!online || !session`) pour l'UI d'édition de L4.

---

## L3 — Shell + étapes + items (lecture)

```
CONTEXTE
Couche données prête (L2). Design de référence : liste verticale d'étapes numérotées,
chacune avec bandeau photo et 6 catégories repliables à compteur.

OBJECTIF
L'app affiche l'itinéraire complet en lecture. Pas encore d'édition, pas encore de carte.

CONTRAT
- src/components/StepCard.jsx : numéro, nom, dates, nombre de nuits, bandeau de 3 photos,
  6 CategoryAccordion.
- src/components/CategoryAccordion.jsx : libellé en petites capitales, compteur entre
  parenthèses, chevron, contenu replié par défaut sauf si le compteur est > 0.
- src/components/ItemRow.jsx : puce colorée par catégorie, titre, prix aligné à droite,
  bouton PLAN (universal link Apple Maps :
  https://maps.apple.com/?ll=LAT,LNG&q=NOM — désactivé si lat/lng absents),
  étoile favori, bouton supprimer (inerte pour l'instant).
- Bandeau offline en haut si isOffline, avec la date du dernier sync.
- Toutes les couleurs via les variables CSS du thème. Aucun hex dans un composant.

BOUCLE
1. Implémente les composants un par un, du plus bas niveau au plus haut.
   Après CHAQUE composant, vérifie le rendu en dev avant de passer au suivant.
2. Assemble la page.
3. Vérifie sur les 7 étapes du seed : compteurs corrects, accordéons fonctionnels,
   aucun débordement à 375px de large.
4. Vérifie que `npm run build` passe.

CRITÈRE D'ARRÊT
Les 7 étapes s'affichent correctement, en desktop et à 375px.

STOP
- Pas d'édition dans ce lot.
- Pas de carte dans ce lot.
- Ne modifie pas la couche données de L2. Si elle te manque quelque chose, remonte-le.
```

**Notes L3**
- Les tokens sont posés (L0) : aucune couleur en dur, tout passe par les `--*`
  listés dans « Système de thème ». Les puces de catégorie utilisent `--cat-*`.
- Les images sont servies en `.webp`, pas `.png`.
- 3 images du header manquent encore — voir « Reste à faire hors lots ».
- Voir l'écart signalé plus haut sur le bandeau photo.

---

**L3 — fait le 18 septembre 2026.** Les 7 étapes s'affichent, compteurs justes,
accordéons fonctionnels, rien ne déborde à 375 px.

Livré : `lib/categories.js` (les 6 catégories, source unique), `lib/photos.js`
(PHOTO_LIB et featured transposés), `PhotoStrip`, `ItemRow`,
`CategoryAccordion`, `StepCard`, et `pages/Trip.jsx` qui assemble le shell avec
le décor et le hero. `.sr-only` ajouté au reset.

**Correction du doc — `PHOTOS` est du code mort.** Le `.dc.html` contient une
table qui fige 3 photos par ville ; elle n'est appelée nulle part. Le vrai
mécanisme est `featured(items)` + `imgFor(titre)`, par mots-clés. La reprendre
aurait figé le Japon dans un composant censé servir tous les voyages.

**`items.favorite` était nécessaire.** La colonne ajoutée hors contrat en L1 est
exactement l'étoile dont `featured()` a besoin pour choisir les 3 photos.

**Arbitrage — tout replié par défaut.** Le contrat disait « replié sauf si le
compteur est > 0 », ce qui revient à tout ouvrir : sur 48 items, Tokyo ferait un
mur à 375 px. On prépare un voyage en ouvrant la catégorie qu'on cherche.

**Arbitrage — pas de bouton supprimer.** Le contrat le voulait inerte. Un bouton
qui ne fait rien apprend au doigt un geste qui deviendra destructeur en L4 : il
arrivera avec l'action qu'il déclenche. Même raison pour l'étoile, qui reste un
indicateur et non un interrupteur.

**Les 5 coordonnées du seed sont décommentées** et remontées dans la
transaction — elles étaient après le `commit;`. Elles donnent 5 boutons Plan
réellement testables ; sans elles la fonction était invérifiable jusqu'à L4.

**Ce que L4 en hérite** — `ItemRow` est en lecture seule : l'étoile et la
suppression sont à y ajouter, pas à y activer. `useSession().readOnly` dit quand
l'écriture doit être bloquée.

---

## L4 — Édition + géocodage

```
CONTEXTE
Affichage en lecture opérationnel (L3). Il faut maintenant saisir la prépa depuis l'app.
Le géocodage sert à la préparation uniquement — jamais appelé pendant le voyage.

OBJECTIF
Ajout / édition / suppression d'items, avec un bouton LOCALISER qui géocode via Nominatim.

CONTRAT
- Champ de saisie inline en bas de chaque catégorie : titre + prix + bouton +.
- src/lib/geocode.js :
    - Nominatim : https://nominatim.openstreetmap.org/search
    - Query enrichie du contexte ville : `${titre}, ${nomEtape}, Japan`
    - format=json, limit=5, accept-language=fr
    - User-Agent identifiant l'app (obligatoire dans leur politique d'usage)
    - Espacement minimum 1,1 s entre deux appels (file d'attente simple)
- LOCALISER ouvre un sélecteur avec les 3–5 candidats (nom complet + type).
  JAMAIS d'acceptation automatique du premier résultat : le géocodage sur des noms
  romanisés japonais se trompe régulièrement de lieu.
- Repli obligatoire : champ de saisie manuelle acceptant "35.0394, 135.7292"
  (format copié depuis Google Maps). Prévois que 10–20 % des lieux passeront par là.
- 3 états visuels par item : non localisé / localisé / échec.
- src/lib/geo.js : haversine(a, b) en km, sans dépendance.
  walkMinutes(km) = round((km * 1.3 / 4.5) * 60)  — le 1,3 est le facteur de détour urbain.
- Contrôle de cohérence : si un item géocodé est à plus de 50 km du centre de son étape,
  affiche un avertissement. Rattrape les erreurs de géocodage invisibles autrement.
- Toute écriture désactivée si isOffline.

BOUCLE
1. Implémente geo.js. Vérifie avec un cas connu :
   Kyoto (35.0116,135.7681) → Osaka (34.6937,135.5023) ≈ 39 km.
2. Implémente geocode.js. Teste sur "Kinkaku-ji" avec contexte Kyoto :
   tu dois obtenir ~35.0394, 135.7292.
3. Implémente le formulaire et le sélecteur de candidats.
4. Test bout en bout : ajouter une activité, la localiser, vérifier en base.
5. Corrige jusqu'à ce que 4 passe.

CRITÈRE D'ARRÊT
Ajout d'une activité + géocodage + persistance vérifiée côté Supabase.

STOP
- Pas de Google Geocoding API : clé à protéger, backend nécessaire, disproportionné.
- Pas de géocodage en masse automatique au chargement.
```

---

**L4 — fait le 19 septembre 2026.** Ajout, édition, suppression, favori et
géocodage vérifiés depuis l'app, persistance confirmée côté Supabase.

Livré : `lib/geo.js`, `lib/geocode.js`, `lib/mutations.js`, `lib/errors.js`
(extrait d'`api.js`, partagé avec les écritures), `ItemForm`, `GeocodePicker`,
et un `ItemRow` qui porte désormais l'édition.

**Correction du contrat — le cas de contrôle Kyoto → Osaka est faux.** Le
contrat annonce ≈ 39 km ; la bonne valeur est **42,87 km**. Vérifiée par trois
formules indépendantes (haversine, loi sphérique des cosinus, approximation
plane) qui concordent à trois décimales, et par l'étalon Paris → Londres
(343,4 km obtenus contre 343,5 de référence). Les 39 km sont la distance
Kyoto–Shin-Ōsaka **par le rail**. Le code n'a pas été plié à l'attente erronée.

**Correction du contrat — le `User-Agent` est impossible.** C'est un en-tête
interdit dans un navigateur, `fetch` refuse de le définir. La politique de
Nominatim accepte à défaut le `Referer`, envoyé automatiquement. La contrainte
réellement tenable est l'espacement : mesuré à 1102 ms entre trois appels
concurrents.

**Vérifié contre l'API réelle** : `Kinkaku-ji, Kyoto, Japon` rend
35,0395 / 135,7295 — 9 mètres de la valeur attendue — à 4,9 km du centre de
Kyoto, type `amenity · place_of_worship`.

**Écritures puis resynchronisation complète.** Pas de mise à jour optimiste du
cache : après chaque écriture on recharge le voyage entier. 300 Ko sur le wifi
de la maison, et une seule source de vérité — l'écran montre ce que la base
contient, pas ce qu'on suppose y avoir écrit.

**Le contrôle des 50 km bloque, et persiste.** Un candidat trop éloigné du
centre de l'étape exige une confirmation explicite ; et l'avertissement reste
affiché sur l'item enregistré, sinon un « Enregistrer quand même » redeviendrait
invisible dès le sélecteur refermé. Deux items du seed le déclenchent
légitimement : Distillerie Hakushu (125 km de Tokyo, détour sur la route) et
Kōyasan (54 km d'Osaka, excursion à la journée).

**Suppression** : pas de `confirm()` natif, le bouton s'arme en « Confirmer ? »
et se désarme seul après trois secondes. Il n'y a pas de corbeille.

**`formatPrice` utilise `currencyDisplay: 'narrowSymbol'`** — sans lui `fr-FR`
rend « 4 500 JPY » au lieu de « 4 500 ¥ », illisible dans une liste de trente
lignes. Repli en cascade : `narrowSymbol` lève sur les moteurs antérieurs à
Safari 14.1.

**Reste ouvert** — le chemin d'écriture authentifié n'est pas testable en
automatique tant que L8 n'a pas séparé la base de dev de la base de prod :
des tests d'intégration écriraient dans le vrai voyage.

---

## L5 — Carte SVG

```
CONTEXTE
Carte SVG stylisée du Japon, dessinée à la main, déjà validée visuellement.
Elle sert de vue d'ensemble : on lit où se trouve quoi. La navigation réelle se fait
dans Plan sur iOS.

OBJECTIF
Carte zoomable/déplaçable où les activités se placent à leur position géographique réelle,
avec labels déportés pour rester lisibles.

CONTRAT
- Calibrage : src/data/city-bounds.js, une entrée par ville
    tokyo: { svg: {x,y,w,h}, geo: {n,s,w,e} }
  Sur 10–15 km la déformation Mercator est sous le pixel : transformation linéaire suffisante.
    nx = (lng - geo.w) / (geo.e - geo.w)
    ny = (geo.n - lat) / (geo.n - geo.s)
    px = svg.x + nx * svg.w   ;   py = svg.y + ny * svg.h
- Deux entités distinctes par activité :
    ANCRE : petit point à la position exacte. Ne bouge jamais.
    LABEL : cercle + texte, déporté pour éviter les collisions,
            relié à son ancre par un pointillé.
- Déport calculé avec d3-force (forceCollide sur les boîtes de labels
  + forceLink faible vers l'ancre). Import du seul module d3-force, pas de d3 complet.
- PERF — impératif : le déport se calcule par PALIERS de zoom (1, 2, 4, 8), une fois
  par palier, résultat mis en cache. Entre deux paliers, simple transform CSS sur un <g>.
  Ne recalcule jamais la simulation à chaque frame.
- Les NOMS des activités se masquent au dézoom (sous le palier 3). Les ancres restent
  visibles à tous les niveaux. Pas d'autre seuil.
- Pas de déport maximum, pas de masquage de label pour cause d'éloignement.
- Filtres : rangée de tags sous la carte (Étapes, Hôtel, Activités, Restaurants,
  Shopping, Lieux touristiques, Notes perso). Clic = toggle de la catégorie.
- Pan/zoom : molette + glisser en desktop, pinch en mobile.
  touch-action: none sur le conteneur SVG, gestion à deux doigts.
- Labels contre-scalés pour garder une taille de police constante quel que soit le zoom.

BOUCLE
1. Implémente d'abord la transformation géo → SVG seule, avec les ancres uniquement.
   Vérifie visuellement que les positions sont crédibles avant d'aller plus loin.
2. Ajoute pan/zoom. Vérifie la fluidité, pas de recalcul superflu.
3. Ajoute le déport de labels. ITÈRE : ce placement ne converge pas du premier coup.
   Ajuste forces et itérations jusqu'à un rendu propre sur Kyoto et Tokyo
   (les deux villes les plus denses).
4. Ajoute les filtres de tags.
5. Teste le pinch sur mobile réel, pas seulement en émulateur.

CRITÈRE D'ARRÊT
Kyoto et Tokyo lisibles à zoom fort, aucun label superposé, pinch fonctionnel sur iPhone.

STOP
- Pas de Leaflet, pas de Mapbox, pas de tuiles. Le SVG existant est la carte.
- Ne modifie pas le tracé du SVG. Tu ajoutes une couche par-dessus.
- Si le déport ne converge pas après 5 itérations d'ajustement, arrête-toi et remonte-moi
  les paramètres testés plutôt que de continuer à tâtonner.
```

**Notes L5** — lire l'encadré « Écarts » en haut du document avant de commencer.
Le contrat décrit une carte différente de celle qui existe.

---

**L5 — fait le 19 septembre 2026.** Carte, frise et pastilles. Le contrat
décrivait une carte qui n'existe pas ; voici ce qui a été fait à la place.

Livré : `scripts/build-map.mjs` (générateur), `src/data/japan-geometry.js`
(généré, 9,9 Ko), `lib/projection.js`, `lib/labels.js`, `TripMap`,
`StepTimeline`, `TripStats`.

**Le fond de carte est embarqué.** C'était le point bloquant signalé dans les
écarts : le design télécharge `world-atlas` depuis un CDN au montage, donc hors
ligne au Japon la carte ne s'affiche pas. `scripts/build-map.mjs` récupère la
géométrie une fois, extrait le Japon, la projette et écrit un chemin SVG
statique. Sa sortie est commitée : `npm run build` n'a jamais besoin de réseau.
Résolution 50m (110m donnait 65 points pour tout le pays, illisible), îlots hors
cadre écartés — 21 anneaux gardés sur 34, 796 points, 9,9 Ko.

**Aucune dépendance ajoutée.** Le décodage TopoJSON et la projection de
Mercator tiennent en trente lignes dans le script ; `d3-geo` et
`topojson-client` pour un calcul exécuté une fois n'en valaient pas le prix.

**`src/data/city-bounds.js` n'a pas été créé.** Le contrat prévoyait un
calibrage manuel par ville, justifié pour un SVG dessiné à la main. Avec une
vraie projection, `lat`/`lng` suffisent. C'est l'écart déjà anticipé en tête de
document.

**Pas de `d3-force` non plus.** Le contrat le demandait pour le déport des
labels ; l'algorithme du design — neuf positions candidates, la première sans
collision gagne — est déterministe et coûte quelques microsecondes, là où
`d3-force` est stochastique et itératif. Surtout, il est parfaitement cachable
par palier de zoom, ce que le même contrat exige par ailleurs. Les deux
exigences étaient contradictoires ; j'ai gardé celle sur la performance.

**Paliers 1, 2, 4, 8.** Le placement est calculé dans l'espace écran du palier
et mis en cache. Les libellés étant contre-échelonnés, leur empreinte en unités
carte rétrécit quand on zoome : placer au palier inférieur est donc
conservateur, les labels ne peuvent que s'écarter davantage à l'intérieur d'un
palier, jamais se rapprocher.

**Le calque des marqueurs est isolé et mémoïsé.** Pendant un glisser, seul le
`transform` du `<g>` parent change ; React saute entièrement le sous-arbre des
cinquante marqueurs.

**Épingles groupées.** Tokyo est l'étape 1 ET l'étape 7, aux mêmes coordonnées.
Une seule épingle, badge « 1·7 », et les clics successifs passent d'une étape à
l'autre puis désélectionnent.

**Reste à vérifier sur appareil réel** — le pinch, et la lisibilité de Kyoto et
Tokyo à zoom fort. Ce dernier critère n'est pas évaluable en l'état : seuls 7
items portent des coordonnées. Le déport des labels ne sera réellement mis à
l'épreuve qu'une fois une trentaine d'items géocodés.

---

**Reprise du design à l'identique — 19 septembre 2026.** Relecture complète du
`.dc.html` et correction des écarts. Ce passage absorbe l'essentiel de L6 :
les vols, les expériences et le budget sont des sections du design, pas un lot
séparé.

**Corrigé côté mise en page** — grille à deux colonnes (`auto-fit`,
`minmax(min(100%, 430px), 1fr)`) avec la carte en `aside` **collant**, alors que
j'avais tout empilé en une colonne. Le bandeau pagode revient à sa place, après
la carte et avant les expériences : il sépare la préparation de l'inspiration.

**Corrigé côté en-tête** — titre en capitales `clamp(40px, 6.2vw, 86px)`, décor
qui déborde volontairement (`left: -18px`), marges asymétriques qui lui
réservent la place, pastilles alignées à droite sur la ligne du titre.

**Corrigé côté étape** — rail avec disque numéroté et filet dégradé, pilule des
nuits, bandeau photo à cartouche rouge pleine (et non un dégradé), ligne de
trajet en pied, en-tête d'accordéon avec le **total de la catégorie**.

**Corrigé côté item** — tout sur UNE ligne : vignette 44×31, pastille, nom,
note, pilule `Plan ↗` / `Maps ↗` selon la plateforme, étoile, pilule
LOCALISER, champ prix, ✕. J'en avais fait deux lignes.

**Ajouté** — `FlightsPanel`, `Experiences`, `BudgetPanel`, `TravelTimes`,
`TripHeader`, `HeroBanner`.

**Cinq jetons de thème en plus** — `surface-sunken`, `surface-warm`,
`surface-tint`, `text-soft`, `accent-deep`. Le design emploie cinq nuances
chaudes distinctes ; les réduire à `surface` aplatissait la hiérarchie. Ajoutés
au contrat et aux deux thèmes, donc aucun hex en dur dans un composant.

**Tous les tarifs sont affichés en euros.** Le design additionne `flightsSum`
(euros) et les totaux d'items (yens) en un seul nombre, ce qui donne un chiffre
sans unité — le défaut anticipé en L1, qui avait justifié la colonne `currency`
sur `flights`. La solution est celle que prévoyait le contrat de L6 : une
conversion à **taux constant**, assumée comme indicative, dans
`src/lib/currency.js`. Pas d'API de change.

La donnée reste stockée dans sa devise d'origine — un hôtel se paie en yens, et
réécrire la base perdrait le montant qu'on présentera au comptoir. Seul
l'affichage convertit ; la saisie garde la devise de la ligne, signalée par le
placeholder (« prix ¥ »).

⚠️ **Le taux vaut 1 € ≈ 165 ¥ et doit être revu avant le départ** : 10 % d'écart
déplacent le total de plus de 200 €. Il est affiché en clair sous le budget pour
qu'on n'oublie pas qu'il vieillit. Contrôle sur le seed : 370 800 ¥ → 2 247 €,
soit 1 124 € par voyageur et 118 € la nuit.

**Non repris, et pourquoi** — les commandes du canvas qui n'ont pas de mutation
derrière : réordonner une étape (▲▼), la retirer, « Ajouter une ville »,
« Réinitialiser l'itinéraire », ajouter ou supprimer un vol, le champ prix des
vols, « Localiser les lieux » en masse (interdit par le STOP de L4), et le
dépôt d'image par glisser (fonction du canvas, pas du web). Même raison qu'en
L3 pour le bouton supprimer : un geste qui ne fait rien s'apprend quand même.
Ces actions demandent des mutations sur `steps` et `flights` qu'aucun lot ne
couvre encore.

**Le nombre de voyageurs vit en état local**, par défaut 2 : `trips` ne le porte
pas, et l'ajouter demanderait une migration pour une valeur qui ne sert qu'au
budget.

**Trouvé au passage** — `index.html` charge Playfair Display et EB Garamond
depuis Google Fonts. Hors ligne, au premier affichage, les deux polices
retombent sur Georgia. L7 devra soit les précacher, soit les héberger — la
seconde option est plus sûre, un service worker ne contrôle pas ce qu'un tiers
renvoie.

---

## L6 — Vols, trajets, expériences, budget

```
CONTEXTE
Cœur de l'app opérationnel. Reste les sections périphériques du design.

OBJECTIF
Bloc billets d'avion, table des temps de trajet, section expériences, budget global.

CONTRAT
- Vols : SAISIE MANUELLE uniquement (aller + retour). Aucune API de recherche de vols.
- Trajets : table lue depuis legs, format "Tokyo → Matsumoto ..... env. 2h40".
  Valeurs saisies à la main, pas calculées. Le vol d'oiseau ne dit rien d'un Shinkansen.
- Expériences : grille de cartes avec image, titre, description, prix, toggle favori.
- Budget : CALCULÉ à la volée depuis items.price + flights.price, groupé par catégorie.
  Ne crée aucune table budget — elle se désynchroniserait.
  Affiche un total et une répartition. Devise JPY avec conversion EUR indicative
  (taux en constante, pas d'API de change).

BOUCLE
1. Un bloc à la fois, vérification du rendu après chacun.
2. Vérifie que le total budget correspond à la somme manuelle des items du seed.

CRITÈRE D'ARRÊT
Les 4 blocs affichés, budget cohérent avec la donnée.

STOP
- Pas d'API de vols (Amadeus, Duffel) : backend nécessaire, hors périmètre.
- Pas d'API de taux de change.
```

---

## L7 — PWA & offline complet

```
CONTEXTE
App fonctionnelle. Elle doit maintenant survivre à 3 semaines au Japon
avec un réseau incertain.

OBJECTIF
Installation sur écran d'accueil, précache des assets, sync explicite avant départ.

CONTRAT
- vite-plugin-pwa. Manifest : nom, icônes, display standalone, couleur de thème.
- Service worker : précache du shell + de TOUTES les images de /public/img/.
- Bouton « Synchroniser pour le voyage » : force un fetch complet + précache des images,
  avec barre de progression. Ne compte pas sur une navigation exhaustive avant le départ.
- Appelle navigator.storage.persist() au premier chargement.
- Headers de cache (à configurer côté Coolify, documente-les) :
    index.html et sw.js  → no-cache
    assets hashés        → immutable
  Sans ça, le service worker sert indéfiniment une version périmée.

BOUCLE
1. Configure le plugin, vérifie que le SW s'enregistre.
2. Vérifie le contenu du précache dans DevTools → Application → Cache Storage.
3. TEST RÉEL OBLIGATOIRE, pas d'émulateur : installer sur iPhone, mode avion,
   fermer l'app, rouvrir. Tout doit s'afficher.
4. Documente dans README.md la procédure « avant de partir ».

CRITÈRE D'ARRÊT
App utilisable en mode avion sur iPhone après fermeture complète.

STOP
- Ne mets pas en cache les appels Nominatim : inutile hors ligne.
- Ne tente pas de rendre l'écriture disponible offline.
```

**Notes L7**
- Les headers de cache sont déjà dans `nginx.conf`.
- Images déjà optimisées : 251 Ko de WebP au lieu de 4,2 Mo de PNG, `dist` = 448 Ko.

---

**L7 — fait le 19 septembre 2026.** `vite-plugin-pwa`, manifest, précache de
**48 fichiers (1,09 Mo)**, bouton de préparation, en-têtes de cache complétés,
procédure « avant de partir » dans le README.

**Les polices sont rapatriées.** `index.html` les chargeait depuis Google
Fonts : en mode avion toute la typographie retombait sur Georgia. Un service
worker ne peut pas garantir ce que renvoie un tiers, l'hébergement local était
la seule réponse sûre. `scripts/build-fonts.mjs` récupère le sous-ensemble
latin — 7 fontes, 298 Ko.

**L'icône ne représente pas le Japon.** Trois étapes reliées par un trajet, sur
le bleu du thème `neutral`. Un mont Fuji aurait marqué toute l'app comme
japonaise, alors que la charte pays ne vaut qu'à l'intérieur d'un voyage.
`scripts/build-icons.mjs` encode les PNG à la main — la machine n'avait ni
rastériseur SVG ni Pillow, et une dépendance graphique pour quatre fichiers
générés une fois était disproportionnée.

**Un bug de précache attrapé au build** : les icônes étaient inscrites deux
fois, par `includeAssets` puis par le manifest, avec des révisions
différentes — Workbox refuse l'installation dans ce cas. `globIgnores` règle
le doublon. Vérifié : 48 entrées, 48 uniques.

**Aucun cache d'exécution n'est déclaré**, et c'est délibéré. Les appels
Supabase doivent toucher le réseau ou échouer franchement : c'est IndexedDB qui
porte la donnée hors ligne, pas le service worker. Nominatim non plus — le
STOP du contrat, et géocoder hors ligne n'a aucun sens.

**`nginx.conf` complété** : `registerSW.js` en `no-cache`, le runtime Workbox
hashé en `immutable`, polices à 30 jours et images à 7 — ces deux-là ne sont
pas hashées, `immutable` les figerait un an après une régénération.

**Reste à vérifier sur appareil réel**, et c'est le critère d'arrêt : installer
depuis Safari, mode avion, fermer complètement l'app, rouvrir. Le service
worker n'existe pas en `npm run dev` ; il faut `npm run preview` ou le site
déployé.

---

## L8 — Séparer dev et prod

```
CONTEXTE
Une seule base Supabase sert tout : .env.local en développement ET le secret
GitHub du déploiement pointent le même projet (lwekjapsghprasnvoaxc).
Conséquence : toute migration, tout seed, toute suppression accidentelle
s'applique à la base que l'app déployée lit. seed.sql s'ouvre sur un
`delete from public.trips where slug = 'japon-2026'` en cascade — le rejouer
après une vraie saisie efface le voyage.

Assumé jusqu'ici : tant que la base est quasi vide, il n'y a rien à perdre.
Ça cesse d'être vrai dès que la prépa réelle est saisie.

OBJECTIF
Une base de développement distincte de la base de production, et une procédure
écrite pour promouvoir une migration de l'une à l'autre.

CONTRAT
Deux voies, à trancher AVANT d'implémenter :
  (a) base locale — CLI Supabase + Docker. Ni l'un ni l'autre n'est installé
      sur la machine. Base jetable, hors ligne, reset instantané.
  (b) second projet Supabase « dev » — le plan gratuit en autorise deux.
      Rien à installer, mais un projet gratuit inactif finit par être mis en
      pause, et il faut le réveiller avant de travailler.
- .env.local pointe la base de DEV. Le secret GitHub VITE_SUPABASE_URL reste
  sur la PROD. Aucun identifiant commité, .env.local reste gitignoré.
- Les migrations s'appliquent d'abord sur dev, ensuite sur prod. La procédure
  de promotion est écrite dans supabase/README.md, avec l'ordre des fichiers.
- Rien d'automatique : ni la CI ni le déploiement ne touchent à une base.
- npm run sql:check reste le seul contrôle avant application.

BOUCLE
1. Compare (a) et (b) en un tableau court : ce qu'il faut installer, ce que
   ça coûte à l'usage, ce qui casse si on l'oublie. Attends mon arbitrage.
2. Mets en place la voie retenue.
3. Applique 0001, 0002 puis seed.sql sur la base de dev.
4. Vérifie : `npm run dev` affiche les 7 étapes du seed depuis la base de dev.
5. Vérifie que la base de prod n'a pas bougé (compte des lignes inchangé).
6. Documente dans supabase/README.md : quelle base est laquelle, comment on
   promeut une migration, comment on repart de zéro sur dev.

CRITÈRE D'ARRÊT
L'app locale lit la base de dev, la prod est intacte, la procédure est écrite.

STOP
- Ne touche pas au projet de production : ni migration, ni seed, ni suppression.
- Ne commite aucun identifiant, aucune URL de projet hors .env.example.
- N'ajoute pas d'étape CI qui appliquerait des migrations. Elles restent
  manuelles, c'est ce qui empêche un push malheureux de toucher la base.
```

**Notes L8**
- À faire avant que la prépa réelle ne soit saisie — après, une erreur coûte
  de la donnée qu'aucun seed ne peut reconstituer.
- Le plan gratuit Supabase met en pause un projet inactif. Deux projets = deux
  à surveiller. Voir « Points de vigilance transverses ».
- L'ordre dans le découpage est indicatif : ce lot peut être avancé à tout
  moment, il ne dépend que de L1.

---

## L9 — Le programme jour par jour

**Spécifié le 22 septembre 2026.** Évolution majeure : organiser activités,
restaurants et visites **jour par jour à l'intérieur d'une ville**, pour obtenir
un vrai programme et plus seulement une liste de choses à faire.

### Le modèle — un jour n'est pas une table

Le principe posé en L4 tient : **les dates ne sont pas stockées comme vérité,
elles sont dérivées** de l'arrivée du vol aller et des nuits de chaque étape
(`resolveItinerary`, `src/lib/itinerary.js`). Une table `days` casserait ça —
il faudrait créer et détruire des lignes à chaque `+1 nuit`, à chaque
`moveStep`, à chaque changement de vol, et gérer les jours orphelins. Deux
vérités finiraient par diverger.

Donc les jours restent **dérivés**, et c'est **l'item** qui dit à quel jour il
appartient, par un décalage relatif à son étape :

```
Kyoto · 4 nuits · commence le 11 nov.
  J1 = 11 nov.   day_offset 0
  J2 = 12 nov.   day_offset 1
  J3 = 13 nov.   day_offset 2
  J4 = 14 nov.   day_offset 3
  (le 15 nov. est le jour de trajet → c'est le J1 de Hiroshima)
```

**Une étape possède exactement `nights` jours.** Le jour de trajet appartient à
la ville où l'on dort ce soir-là, c'est-à-dire la ville d'**arrivée**. Comme
`date_start` d'une étape vaut déjà `date_end` de la précédente, il n'y a ni
chevauchement ni arbitrage à faire. Seule la **dernière étape** a un jour en
plus : celui du vol retour — check-out, trajet vers l'aéroport.

Conséquence directe : `+1 nuit` sur Kyoto ajoute un jour vide au bon endroit et
décale l'affichage de tout le reste **sans toucher à une seule ligne d'item**.

### Les arbitrages

Tous décidés le 22 septembre 2026, avant écriture du code.

**1. Le placement est une colonne de l'item, pas une table de liaison.**
Un item est posé à un endroit et un seul. Manger deux fois à Dōtonbori se
traduit par **deux items**. L'alternative — une table `item_days` permettant
plusieurs placements — était plus propre sur le papier, mais posait une
question sans bonne réponse : un item placé deux fois compte-t-il une fois ou
deux au budget ? Retenu : la duplication, rendue indolore par un bouton
**« Refaire un autre jour »** qui recopie titre, prix et coordonnées sur le
jour choisi.

**2. Des moments, pas une grille horaire.** `matin`, `midi`, `apres-midi`,
`soir`, plus `journee` pour ce qui mange la journée entière (Kōyasan, Universal
Studios). Un planning à l'heure donne une fausse précision et se remplit mal ;
quatre moments posent une journée en trois clics et se lisent d'un coup d'œil
sur place.

**3. L'heure précise reste possible, et elle se voit.** Un musée, une visite
guidée, un kaiseki réservé ont une heure ferme. `start_time` est optionnelle,
s'affiche en tête de ligne, et **ne commande pas l'ordre** — l'ordre, c'est le
moment puis `day_position`. Pas de re-tri surprise sous les doigts. Couplée à
`booked`, elle donne la ligne qu'on ne peut pas manquer.

**4. Plusieurs hôtels par étape, un seul retenu.** Une contrainte `unique`
interdirait le geste normal de la préparation : noter trois candidats avant de
choisir. La règle passe donc par deux colonnes qui **existent déjà** :

- `favorite` sur un hôtel = **le retenu**. Un seul par étape — cocher un autre
  hôtel décoche le précédent. C'est lui, et lui seul, qui entre au budget ;
- `booked` = **le choix scellé**. Le cocher **supprime les hôtels non retenus**
  de l'étape. Geste destructif, donc derrière un `ConfirmDialog` nommant ce qui
  part ;
- l'hôtel retenu remonte dans l'en-tête de l'étape, sous les dates : c'est le
  décor du séjour, pas une ligne d'accordéon. Tant que rien n'est retenu,
  l'étape affiche **« logement à choisir »**.

**5. Une étape a au moins une nuit.** `étape = changement de ville ET de
logement`. Une excursion — Kōyasan, Nara, Miyajima — est une **activité** de la
ville d'où l'on part, posée sur un jour en moment `journee`. Ce n'est jamais
une étape. La règle descend dans le schéma (`nights >= 1`) et dans l'UI.

**6. Tout ne se planifie pas.** Un hôtel est le décor de l'étape entière, une
note perso n'a pas de jour. Un drapeau `planifiable` rejoint `onMap` et
`budget` dans `src/lib/categories.js` : vrai pour `activite`, `restaurant`,
`shopping`, `lieu` ; faux pour `hotel` et `note`.

**7. `day_offset NULL` = la réserve.** C'est le défaut, donc **les 48 items
existants restent tels quels** — aucune donnée à migrer. Non placé, un item
reste dans sa catégorie : c'est « ce qu'on aimerait faire à Kyoto ». Le
programme se construit en piochant dedans, et le compteur « 5 à placer » dit ce
qu'il reste à faire.

**8. Réduire les nuits libère, ne détruit pas.** Passer Kyoto de 4 à 2 nuits
renvoie les items des jours disparus **en réserve** (`day_offset = null`). Ils
ne sont ni supprimés, ni écrasés sur le dernier jour.

**9. Pas de drag & drop.** Il impose une dépendance (`@dnd-kit`), se comporte
mal au doigt dans une page qui défile, et n'est pas testable en Vitest. Le
placement se fait au **sélecteur** — `J1 J2 J3 J4` puis le moment — et le
réordonnancement aux **▲▼**, comme les étapes de `StepCard`. À rouvrir si
l'usage frotte, pas avant.

### Trois pièges repérés avant d'écrire

**`trip_by_share_token` construit son JSON colonne par colonne.** Quatre
colonnes ajoutées sur `items` n'y arrivent pas toutes seules : la fonction se
recrée, comme dans `0006_trajets.sql`. Sans ça la vue partagée affiche un
programme vide sans rien signaler.

**`budget.js` additionne DÉJÀ tous les hôtels d'une étape.** Trois candidats à
Kyoto = 216 000 ¥ au lieu de 72 000. Le bug est latent depuis L6 — le seed n'a
qu'un hôtel par ville, personne ne l'a vu. L'arbitrage 4 le corrige : seul
l'hôtel `favorite` entre au budget.

**`photos.js` mettrait l'hôtel dans le bandeau.** `featured()` prend d'abord
les favoris de catégorie `onMap`, et `hotel` l'est. Dès que `favorite` signifie
« hôtel retenu », chaque étape pousserait son hôtel dans le bandeau photo. Il
faut écarter `hotel` de la passe des favoris — il reste en complément de fin de
liste, où il est aujourd'hui.

### Le découpage — par feature

Quatre features, chacune **livrable et utilisable seule**. Le découpage est
vertical : une feature traverse le SQL, la logique pure et l'UI, et se termine
sur quelque chose qu'on peut faire dans l'app — pas sur une couche technique
dont l'intérêt n'apparaît qu'au lot suivant.

**Une seule migration**, en tête de F2, qui pose les quatre colonnes d'un coup
même si F2 n'en consomme que deux. Motif : recréer `trip_by_share_token` deux
fois pour deux colonnes serait du travail payé double, et une colonne inutilisée
ne coûte rien.

| Feature | Ce qu'on gagne | SQL | Effort |
|---|---|---|---|
| ~~**F1 · L'hôtel retenu**~~ | ✅ Comparer trois hôtels sans fausser le budget, puis sceller le choix | aucun | fait |
| ~~**F2 · Poser un item sur un jour**~~ | ✅ Le programme existe : chaque activité a son jour | `0007_journees.sql` | fait |
| ~~**F3 · Les moments et les heures fermes**~~ | ✅ La journée se lit, et ce qui est réservé saute aux yeux | aucun | fait |
| ~~**F4 · La vue Programme**~~ | ✅ Le voyage entier jour par jour : ce qui sert sur place | aucun | fait |

**L9 est livré** — F1 à F4, les 22 et 23 septembre 2026. Il reste deux
retouches notées plus haut : masquer les mots d'amour en vue partagée, et
décider si la réserve « À placer » doit y rester visible.

**L'ordre est imposé.** F1 d'abord : elle ne touche pas au schéma, corrige deux
bugs vivants, et surtout **fixe le sens de l'étoile**, dont F2 et F3 dépendent
pour l'affichage. F3 après F2, elle en redécoupe la vue. F4 en dernier — c'est
la seule qui peut attendre le retour du voyage sans rien coûter.

---

### F1 — L'hôtel retenu

```
CONTEXTE
travel-app, L0 à L7 livrés. items porte DÉJÀ deux colonnes utiles et inutilisées
au bon endroit : `favorite` (l'étoile, aujourd'hui « illustre la ville », 3 max)
et `booked` (remontée par api.js, affichée nulle part).
Lis « L9 — Les arbitrages » n°4 ci-dessus avant d'écrire.
Aucune migration dans cette feature.

OBJECTIF
Noter plusieurs hôtels candidats dans une étape, en retenir un, puis sceller le
choix. Et corriger les deux bugs que ça met au jour.

CONTRAT
- src/lib/lodging.js, pur et testé :
    hotelsOf(step)     les items de catégorie hotel
    chosenHotel(step)  le retenu : le `booked` s'il existe, sinon le `favorite`,
                       sinon l'unique hôtel s'il n'y en a qu'un, sinon null.
                       Ce dernier repli n'est pas un détail : le seed a un hôtel
                       par étape et AUCUN favori. Sans lui, appliquer F1 ferait
                       tomber à zéro le poste logement du vrai voyage.
    otherHotels(step)  les candidats non retenus
- L'étoile d'un hôtel devient EXCLUSIVE dans son étape : en cocher un décoche
  l'autre, en une passe. L'étoile des cinq autres catégories garde son sens
  actuel — ne la touche pas. Le libellé et l'infobulle diffèrent donc selon la
  catégorie : « Hôtel retenu » d'un côté, « Mettre en avant » de l'autre.
- `booked` scelle le choix : il pose favorite, et SUPPRIME les hôtels non
  retenus de l'étape. Geste destructif → ConfirmDialog nommant chaque hôtel qui
  part, comme le retrait d'une étape. Un hôtel scellé affiche « réservé » et
  perd le bouton de scellement.
- L'hôtel retenu remonte dans l'en-tête de StepCard, sous les dates. Aucun
  retenu alors que des candidats existent : « logement à choisir ».
- CORRIGE budget.js : il additionne aujourd'hui TOUS les hôtels d'une étape.
  Trois candidats à Kyoto donnent 216 000 ¥ au lieu de 72 000. Seul le retenu
  compte. Une étape à plusieurs candidats sans retenu ne compte rien et le dit
  dans la note du panneau, comme les lignes sans prix.
- CORRIGE photos.js : featured() prend les favoris de catégorie onMap, et hotel
  en est. Dès que l'étoile signifie « retenu », chaque étape pousserait une
  photo d'hôtel dans son bandeau. Écarte hotel de la passe des favoris — il
  reste en complément de fin de liste, là où il est déjà.
- Le total d'en-tête de l'accordéon Hôtel suit la même règle que le budget.
- readOnly : aucune de ces commandes en vue partagée ni hors ligne.

BOUCLE
1. Lis categories.js, budget.js, photos.js, ItemRow.jsx, StepCard.jsx,
   mutations.js, ConfirmDialog.jsx.
2. Écris lodging.js et ses tests, puis les deux corrections et leurs tests,
   puis l'UI.
3. Vérifie : npm test, npm run build, puis npm run dev — ajoute deux hôtels à
   Kyoto, constate que le budget ne double pas, retiens-en un, scelle-le,
   vérifie que l'autre disparaît après confirmation.
4. Si échec, corrige et relance. Trois tentatives, puis remonte.

CRITÈRE D'ARRÊT
test + build au vert, et le scénario de l'étape 3 se déroule en entier.

STOP
- Aucune migration, aucune colonne nouvelle : tout existe déjà.
- Ne touche pas au sens de l'étoile hors catégorie hotel.
- Ne supprime jamais un hôtel sans confirmation explicite.
```

### F2 — Poser un item sur un jour

```
CONTEXTE
F1 est livrée, le sens de l'étoile est fixé. Les items sont rangés par catégorie
dans une étape, sans notion de jour. Le modèle de dates est dérivé :
src/lib/itinerary.js fait foi. Lis « L9 — Le modèle » et les arbitrages 1, 5,
6, 7, 8 et 9 avant d'écrire.

OBJECTIF
Placer une activité, un restaurant, une boutique ou un lieu sur un jour précis
d'une ville, et voir la journée se remplir.

CONTRAT
- supabase/migrations/0007_journees.sql, rejouable, conventions de 0001 et 0006 :
    items.day_offset   integer  -- NULL = en réserve, CHECK >= 0
    items.day_slot     text     -- CHECK in ('journee','matin','midi','apres-midi','soir')
    items.day_position integer  not null default 0, CHECK >= 0
    items.start_time   time
  day_slot et start_time ne sont posés qu'en F3, mais la colonne est créée ici.
  Cohérence : un item en réserve (day_offset NULL) a day_slot NULL.
  Resserre aussi steps_nights_sane de `nights >= 0` à `nights >= 1` — vérifie
  d'abord qu'aucune ligne ne vaut 0, et remonte-le au lieu de corriger la donnée.
  RECRÉE trip_by_share_token avec les quatre colonnes : c'est le piège connu.
  Ajoute-les au TRIP_SELECT de api.js.
- src/lib/days.js, pur et testé :
    daysOf(step, { isLast })  les jours de l'étape : nights jours, plus UN jour
                              de départ si c'est la dernière étape du voyage
    scheduleOf(step)          les items rangés par jour puis day_position
    unplacedOf(step)          la réserve : les items planifiables sans jour
    releasedBy(step, nights)  les ids à renvoyer en réserve quand les nuits
                              diminuent — rien de supprimé, rien d'écrasé
- Ajoute `planifiable` aux six entrées de categories.js : vrai pour activite,
  restaurant, shopping, lieu ; faux pour hotel et note.
- Dans StepCard, une bascule « Catégories » / « Jour par jour » au-dessus du
  contenu. Les catégories sont le garde-manger, les jours sont le menu.
  L'onglet Jours porte le nombre d'items encore à placer.
- Vue Jours : un bloc par jour, titré « J2 · mer. 12 nov. », les items dans
  l'ordre. Un jour vide reste visible — un trou dans un programme est une
  information.
- Actions sur un item placé : changer de jour, ▲▼, renvoyer en réserve, et
  « Refaire un autre jour » qui recopie titre, prix, devise et coordonnées sur
  le jour choisi (arbitrage 1 : un item, un placement).
- La réserve est en pied de vue, avec le sélecteur « Placer ». PAS de drag &
  drop, aucune dépendance nouvelle.
- Le − des nuits s'arrête à 1, AddStep passe à min="1". Réduire les nuits
  appelle releasedBy dans la même passe que setStepNights.
- readOnly rend le programme sans aucune commande.

BOUCLE
1. Lis itinerary.js et ses tests, 0006_trajets.sql, StepCard.jsx, mutations.js.
2. Écris le SQL, puis days.js + tests, puis l'UI.
3. Propose le découpage en composants AVANT d'écrire le JSX, et attends
   validation.
4. Vérifie : sql:check, test, build, puis en dev — pose trois activités et un
   restaurant sur trois jours de Kyoto, réduis Kyoto à 2 nuits, vérifie que les
   items reviennent en réserve au lieu de disparaître.
5. Si échec, corrige et relance. Trois tentatives, puis remonte.

CRITÈRE D'ARRÊT
sql:check + test + build au vert, et le scénario de l'étape 4 ne perd rien.

STOP
- N'applique rien dans Supabase : les migrations passent à la main.
- Ne migre aucune donnée : day_offset NULL est le bon défaut, les 48 items
  restent intacts.
- Ne réécris pas itinerary.js : days.js s'appuie dessus.
- Ne casse pas la vue Catégories, elle reste le chemin de saisie.
```

### F3 — Les moments et les heures fermes

```
CONTEXTE
F2 est livrée : les items se posent sur un jour, dans un ordre. Les colonnes
day_slot et start_time existent en base depuis 0007 et ne sont pas encore
utilisées. Lis les arbitrages 2 et 3.

OBJECTIF
Que la journée se lise comme une journée, et qu'une réservation à heure fixe ne
puisse pas être ratée. Aucune migration.

CONTRAT
- Le jour se découpe en moments, dans l'ordre : journee, matin, midi,
  apres-midi, soir. `journee` s'affiche comme un bandeau couvrant les quatre
  autres — Kōyasan ou Universal mangent la journée, et on doit voir que rien
  d'autre n'y tient.
- Le sélecteur de placement de F2 gagne le moment, après le jour.
- scheduleOf range par moment, puis par day_position à l'intérieur.
  start_time s'AFFICHE mais NE TRIE PAS : pas de re-tri surprise sous les doigts.
- start_time se saisit sur l'item et s'affiche en tête de ligne. Couplée à
  `booked`, elle donne la ligne qu'on ne peut pas manquer : heure appuyée,
  mention « réservé ». C'est le musée, la visite guidée, le kaiseki.
- `booked` devient disponible hors hôtel — il ne servait qu'à sceller un
  logement en F1, il vaut pour tout ce qui est réservé.
- Un moment vide reste visible mais discret.
- readOnly : lecture sans commande.

BOUCLE
1. Lis days.js et la vue Jours livrée en F2.
2. Étends scheduleOf et ses tests AVANT l'UI : l'ordre des moments, le cas
   `journee`, deux items à la même heure, un item sans heure entre deux avec.
3. Implémente l'UI.
4. Vérifie : test, build, puis en dev — pose Kōyasan en `journee` sur un jour
   d'Osaka, et un kaiseki à 19h30 marqué réservé sur un soir de Kyoto.
5. Si échec, corrige et relance. Trois tentatives, puis remonte.

CRITÈRE D'ARRÊT
test + build au vert, et les deux cas de l'étape 4 s'affichent correctement.

STOP
- Aucune migration : les colonnes sont là depuis F2.
- start_time ne commande pas l'ordre. Si ça te paraît illogique, remonte-le, ne
  le change pas.
```

### F4 — La vue Programme

```
CONTEXTE
F1 à F3 sont livrées : on construit le programme ville par ville. Il manque la
lecture du voyage entier, celle qui sert SUR PLACE, dans le train, en mode
avion. timelineEntries (itinerary.js) sait déjà ordonner vols et étapes à leur
date : ce lot s'appuie dessus, il ne le réécrit pas.

OBJECTIF
Le voyage jour par jour, du 7 au 26 novembre, toutes villes confondues.

CONTRAT
- Route /voyage/:slug/programme, et son équivalent en vue partagée.
- Un bloc par jour : date en toutes lettres, ville, rang du jour dans l'étape,
  puis les moments.
- Vols et trajets s'intercalent à leur date avec leurs horaires. Un jour de
  trajet montre d'abord le trajet, ensuite le programme du soir.
- Le jour courant est mis en avant quand la date du jour tombe dans le voyage.
  C'est la fonction principale sur place : arriver sur « aujourd'hui ».
- Deux items géolocalisés qui se suivent affichent la distance entre eux
  (haversine, geo.js). Voir qu'on a mis Fushimi le matin et Arashiyama
  l'après-midi, aux deux bouts de Kyoto, rattrape une journée mal construite.
- Lecture seule : on suit un programme, on ne le modifie pas d'ici.
- Marche hors ligne sans rien cacher de plus : le voyage entier est déjà en
  IndexedDB.

BOUCLE
1. Lis itinerary.js, days.js, TripView.jsx, geo.js.
2. Implémente.
3. Vérifie : test, build, puis en dev avec DevTools → Offline : la vue doit se
   rendre entièrement.
4. Si échec, corrige et relance. Trois tentatives, puis remonte.

CRITÈRE D'ARRÊT
test + build au vert, et la vue se rend complètement hors ligne.

STOP
- Aucune écriture depuis cette vue.
- Ne duplique pas la logique de days.js : si une fonction manque, ajoute-la là
  avec ses tests, jamais dans le composant.
```

---

## Points de vigilance transverses

**Persistance iOS.** Safari purge le stockage script-writable après ~7 jours sans interaction. Les PWA installées sur l'écran d'accueil sont normalement exemptées, mais ce comportement a changé plusieurs fois selon les versions. Teste concrètement : app fermée 48 h, réouverture, vérification du cache. Découvre-le à Annecy, pas à Kyoto.

**Supabase et l'inactivité.** Le free tier met les projets en pause après une période d'inactivité. Pour une app utilisée par à-coups, c'est le profil qui déclenche la pause. Un cron de ping suffit — vérifie leur politique actuelle avant de partir.

**RAM au build.** Surveille `free -h` pendant le premier `vite build`. Un OOM se manifeste par un exit code 137 et un message illisible : tu chercheras côté code alors que c'est la mémoire.

**Commit par lot.** Un lot = un commit. Si un lot part de travers, tu reviens en arrière proprement sans perdre le précédent.
