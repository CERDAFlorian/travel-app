# travel-app — Découpage en lots & prompts Claude Code

Stack figée : React + Vite + SCSS + Supabase + IndexedDB. Déploiement Coolify via image
Docker (nginx, fallback SPA — le README décrivait un build pack static, c'était périmé).
Offline en **lecture seule**. Carte SVG unique zoomable, ancres géographiques + labels déportés.

> **Design importé.** Le MCP `claude_design` est configuré (scope user) et le projet
> [Itinéraire Japon interactif](https://claude.ai/design/p/ffcea357-0409-407c-94cb-8441582baff1)
> a été importé dans `design/`. **Lire `design/README.md` avant tout lot** : palette,
> couleurs des catégories, 25 villes géolocalisées, appariement photo ↔ item.

---

## État du projet — 24 août 2026

Branche de travail : `dev`, synchronisée avec `origin/dev`. `main` est en retard,
la fusion se fera par PR. **L0 est terminé.** L1 est le prochain.

### Ce qui est en place

| | |
|---|---|
| Stack | React 18 + Vite 8 + SCSS (`sass`), `@supabase/supabase-js` |
| Thème | `src/theme/`, multi-voyages, validé à la compilation (voir plus bas) |
| Build | `npm run build` → ~150 ms, `dist` = 452 Ko, aucun warning |
| Dev | `npm run dev` → http://localhost:5173 |
| Images | 28 WebP dans `public/img/` (251 Ko), sources PNG dans `design/img/` |
| CI | `check.yml` sur push `dev` et PR `main` : `img:check` + build |
| Déploiement | image Docker → GHCR → Coolify. `nginx.conf` fait le fallback SPA |

### Commandes

```sh
npm run dev          # serveur de développement
npm run build        # build production
npm run img          # compresse design/img/*.png → public/img/*.webp
npm run img:check    # vérifie sans compresser (tourne en CI)
```

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

**Bascule** : `<html data-theme="…">` via `applyTheme()`, alimenté par `trips.theme`
une fois la donnée branchée en L2. Aujourd'hui figé sur `japan` dans `main.jsx`.

### Reste à faire hors lots

**3 images bloquent L3** — à exporter du canvas vers `design/img/` puis `npm run img` :
`deco-momiji.png`, `deco-fuji.png`, `hero-pagode.png` (décor du header et bandeau hero).

6 autres sont optionnelles (`sushi`, `sumo`, `shirakawago2`, `narai`, `matcha`,
`baguettes`) : leur absence laisse l'item sans photo, rien ne casse. Le plafond de
256 Ko de `get_file` empêche de les récupérer via le MCP.

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

**L3 — le bandeau photo n'est pas un champ de l'étape.** Le design apparie les
photos par **mots-clés du titre d'item** (`.dc.html`, lignes 366-381), pas via un
tableau sur l'étape. À arbitrer avec `steps.images text[]` prévu en L1.

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
| **L1** | Schéma Supabase + RLS + seed Japon | 0,5 j | La donnée existe |
| **L2** | Couche données + cache IndexedDB + hook `useTrip` | 1 j | L'app lit online et offline |
| **L3** | Shell + étapes + catégories + items (lecture) | 1,5 j | **App utilisable** |
| **L4** | Édition items + LOCALISER (Nominatim) + Haversine | 1,5 j | Prépa autonome dans l'app |
| **L5** | Carte SVG : pan/zoom, ancres, labels déportés, filtres tags | 2 j | La pièce maîtresse |
| **L6** | Vols, trajets, expériences, budget | 1 j | Périmètre complet |
| **L7** | PWA, précache, bouton sync, QA mobile | 1 j | Prêt pour le voyage |

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
4. Test manuel obligatoire : charge la page online, passe l'onglet en mode offline
   (DevTools → Network → Offline), recharge. L'app doit afficher la donnée cachée.
5. Si échec, corrige et relance l'étape 4.

CRITÈRE D'ARRÊT
Rechargement en mode offline → la donnée s'affiche, isOffline = true.

STOP
- N'installe ni RxDB, ni WatermelonDB, ni PowerSync. Surdimensionné pour ce volume.
- N'implémente pas d'écriture offline ni de queue de mutations.
```

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

## Points de vigilance transverses

**Persistance iOS.** Safari purge le stockage script-writable après ~7 jours sans interaction. Les PWA installées sur l'écran d'accueil sont normalement exemptées, mais ce comportement a changé plusieurs fois selon les versions. Teste concrètement : app fermée 48 h, réouverture, vérification du cache. Découvre-le à Annecy, pas à Kyoto.

**Supabase et l'inactivité.** Le free tier met les projets en pause après une période d'inactivité. Pour une app utilisée par à-coups, c'est le profil qui déclenche la pause. Un cron de ping suffit — vérifie leur politique actuelle avant de partir.

**RAM au build.** Surveille `free -h` pendant le premier `vite build`. Un OOM se manifeste par un exit code 137 et un message illisible : tu chercheras côté code alors que c'est la mémoire.

**Commit par lot.** Un lot = un commit. Si un lot part de travers, tu reviens en arrière proprement sans perdre le précédent.
