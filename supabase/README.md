# Supabase — schéma, RLS, seed

Trois fichiers, à exécuter **dans cet ordre**. Rien n'est appliqué
automatiquement : ni le repo, ni la CI, ni le déploiement ne parlent à Supabase.

| Ordre | Fichier | Contenu | Rejouable ? |
|---|---|---|---|
| 1 | `migrations/0001_schema.sql` | 7 tables, contraintes, index, droits | oui, sans effet si déjà passé |
| 2 | `migrations/0002_rls.sql` | fonctions d'accès, trigger, policies | oui, tout est en `create or replace` / `drop … if exists` |
| 3 | `migrations/0003_partage.sql` | jeton de partage + fonction de lecture publique | oui |
| 4 | `seed.sql` | le voyage Japon | oui, **il écrase le voyage `japon-2026`** |

## Application — pas à pas

Tout se fait depuis le dashboard : <https://supabase.com/dashboard> → choisir
le projet. Aucun outil à installer. Chaque fichier est encadré d'un `begin` /
`commit` : en cas d'erreur, rien n'est appliqué à moitié, on corrige et on
relance le fichier entier.

### 1. Le schéma

**SQL Editor** (icône `>_` dans la barre de gauche) → **New query** → coller
l'intégralité de `migrations/0001_schema.sql` → **Run** (ou `Ctrl/Cmd + Enter`).

Attendu : `Success. No rows returned`. C'est normal — un `create table` ne
renvoie rien.

### 2. Les policies

Même chose avec `migrations/0002_rls.sql`. Même résultat attendu.

À ce stade, **Table Editor** montre les 7 tables, toutes vides, chacune
marquée *RLS enabled*.

### 3. Les deux comptes

À faire **avant** le seed, et ça ne peut pas se faire depuis l'app : il n'y a
pas encore d'écran de connexion. Depuis le dashboard :

**Authentication** → **Users** → **Add user** → *Send invitation* (l'invité
reçoit un lien par mail) ou *Create new user* (email + mot de passe, à cocher
« auto confirm » pour ne pas passer par le mail).

Peu importe la méthode : ce qui compte est qu'une ligne existe dans
`auth.users`. Le seed s'appuie dessus.

### 4. Le seed

SQL Editor → coller `seed.sql` → **Run**.

Le fichier rattache le voyage à **tous les comptes présents dans
`auth.users`**. Si la table est vide, il n'échoue pas : il pose la donnée, émet
un `WARNING`, et le voyage reste invisible pour tout le monde — l'app afficherait
une page vide sans la moindre erreur. Le SQL Editor n'affiche pas toujours les
`NOTICE` et `WARNING`, donc ne t'y fie pas : passe par la requête de
vérification ci-dessous.

### 5. Vérifier

SQL Editor → coller et lancer :

```sql
select (select count(*) from public.steps)        as etapes,       -- 7
       (select count(*) from public.items)        as items,        -- 48
       (select count(*) from public.legs)         as liaisons,     -- 6
       (select count(*) from public.flights)      as vols,         -- 2
       (select count(*) from public.experiences)  as experiences,  -- 4
       (select count(*) from public.trip_members) as membres;      -- 2
```

`membres` à 0 est le seul chiffre qui doit alerter : reprendre l'étape 3, puis
relancer le seed.

### Avec la CLI, si elle est installée un jour

```sh
supabase db push                       # migrations/
psql "$DATABASE_URL" -f supabase/seed.sql
```

### Rattacher quelqu'un après coup

```sql
insert into public.trip_members (trip_id, user_id, role)
select t.id, u.id, 'editor'
from public.trips t, auth.users u
where t.slug = 'japon-2026' and u.email = 'adresse@exemple.fr';
```

## Reset

**Reseeder le voyage** — relancer `seed.sql`. Le `delete from public.trips
where slug = 'japon-2026'` en tête de fichier emporte en cascade étapes, items,
liaisons, vols, expériences et appartenances. Tout ce qui a été saisi depuis
l'app sur ce voyage disparaît. C'est voulu : le seed est une remise à zéro, pas
une mise à jour.

**Repartir de zéro** — supprimer les objets puis rejouer les trois fichiers :

```sql
drop table if exists public.items, public.legs, public.flights,
                     public.experiences, public.steps, public.trip_members,
                     public.trips cascade;
drop function if exists public.is_trip_member(uuid), public.is_trip_editor(uuid),
                        public.is_trip_owner(uuid), public.trip_id_of_step(uuid),
                        public.claim_new_trip() cascade;
```

## Vérification

```sh
npm run sql:check
```

Contrôle statique, sans serveur — il tourne aussi en CI. Il attrape les quotes
et parenthèses déséquilibrées, une transaction non refermée, une FK vers une
table inexistante, une table sans RLS, une policy manquante ou permissive, une
fonction `security definer` au `search_path` ouvert, une catégorie de seed hors
`CHECK`, une chaîne de dates d'étapes rompue, une image en `.png`.

Il ne remplace pas l'exécution : un typage invalide ou un appel de fonction
inconnue ne se verront qu'à l'application des migrations.

Après application, le contrôle des comptages est à l'étape 5 ci-dessus.

Et le test qui compte vraiment — RLS vue depuis un utilisateur connecté :

```sql
set local role authenticated;
set local request.jwt.claims = '{"sub":"<un user_id de auth.users>"}';
select count(*) from public.items;   -- 48 si membre, 0 sinon
reset role;
```

## Partage en lecture seule

Un ami sans compte peut consulter un voyage depuis une URL, et rien d'autre.

`anon` ne reçoit **aucun droit de table** : le `revoke all … from anon` de
0001 reste entier. L'accès passe par une seule fonction `security definer`,
`trip_by_share_token(uuid)`, qui ne rend le voyage que si le jeton présenté
correspond à `trips.share_token`. Un voyage non partagé a un jeton `NULL`, et
`NULL = NULL` est faux : il reste invisible même si l'appelant passe `NULL`.

Le jeton est un UUID — 122 bits, on ne tombe pas dessus par hasard. C'est ce
qui permet de se passer d'un drapeau « public », dont l'URL serait le slug,
devinable en trois essais.

L'app gère le geste depuis la page du voyage : **Créer un lien de partage**,
**Copier**, **Révoquer**. Régénérer le jeton révoque le lien précédent — c'est
la seule reprise en main possible sur une URL déjà envoyée.

En SQL, si besoin :

```sql
update public.trips set share_token = gen_random_uuid() where slug = 'japon-2026';  -- créer/renouveler
update public.trips set share_token = null              where slug = 'japon-2026';  -- révoquer
select slug, share_token from public.trips where slug = 'japon-2026';               -- relire
```

**Ce que le lien expose** : tout ce que voit le propriétaire, prix compris. Pour
masquer le budget, retirer `price` et `currency` des `jsonb_build_object` de la
fonction — les panneaux correspondants se videront d'eux-mêmes.

## Modèle d'accès

Une seule règle : **on voit une ligne si son voyage apparaît dans
`trip_members` pour `auth.uid()`**. `items` n'a pas de `trip_id`, il remonte
par `step_id`.

Trois rôles : `owner` (gère les membres, supprime le voyage), `editor` (écrit),
`viewer` (lecture seule). Lecture ouverte à tout membre, écriture réservée à
`owner` et `editor`.

Quatre fonctions `security definer` portent la règle, en `set search_path = ''`
et noms pleinement qualifiés. Elles ne sont pas cosmétiques : une policy de
`trip_members` qui interrogerait `trip_members` en SQL direct partirait en
récursion infinie, PostgreSQL appliquant la policy à sa propre sous-requête.

`anon` n'a **aucun droit** sur ces tables : même une policy trop laxiste ne
rendrait rien lisible au porteur de la clé publique. Aucune policy n'utilise
`using (true)`, et chacune est restreinte à `to authenticated`.

**Création d'un voyage.** `trips` est la seule table dont la policy `insert` ne
dépend pas de `trip_members` — la ligne n'existe pas encore, elle n'appartient
à personne. Le trigger `trips_claim_creator` inscrit immédiatement son auteur
comme `owner`. Sans lui, la page « nouveau voyage » se bloquerait elle-même.

Une conséquence à retenir pour le jour où cette page existera : **l'insertion
ne doit pas demander la ligne en retour**.

```js
await supabase.from('trips').insert(row);            // OK
await supabase.from('trips').insert(row).select();   // refusé par RLS
```

Avec `RETURNING`, PostgreSQL évalue la policy `SELECT` sur la ligne insérée au
moment de l'insertion, avant que le trigger `AFTER` n'ait posé l'appartenance.
Insérer, puis relire dans un second appel.

## Notes de schéma

**`items.category`** — `hotel` · `activite` · `restaurant` · `shopping` ·
`lieu` · `note`. Un `CHECK` sur du `text`, pas un `enum` : ajouter une valeur
est un `ALTER … DROP CONSTRAINT` puis `ADD CONSTRAINT`, pas une manipulation de
type. Le design dit `resto`, la clé canonique est `restaurant`.

**Pas de table budget.** Il est calculé depuis `items.price` + `flights.price`.
Une table se désynchroniserait au premier prix modifié.

**`steps.pin_x` / `pin_y`** — 0–1, présentes mais **vides**. Elles supposaient un
placement manuel dans le SVG ; la carte de L5 projette `lat`/`lng`. Gardées
comme repli si une étape doit un jour être forcée à un endroit précis.

**`steps.images`** — `NULL` partout dans le seed. Le bandeau photo de L3 se
compose par mots-clés du titre d'item (voir `design/README.md`). La colonne
sert de surcharge quand l'appariement automatique ne donne rien de bon.

**Devises.** `items` par défaut en `JPY`, `flights` en `EUR`. Sans devise sur
les vols, le budget de L6 additionnerait des euros et des yens.

**Prix du seed** — des ordres de grandeur, posés pour que le budget de L6 ait
quelque chose à additionner. Total actuel des lignes budgétées (hôtels,
activités, lieux) : **370 800 ¥**. À remplacer par les vrais montants.

**Liaisons inter-voyages impossibles.** `legs.from_step` / `to_step` pointent
vers `steps (id, trip_id)` par une FK composite : une liaison ne peut pas
référencer l'étape d'un autre voyage. Une simple FK sur `steps(id)` le
permettrait, et l'erreur serait invisible à la lecture.

## Contenu du seed

Voyage `japon-2026`, thème `japan`, du 7 au 26 novembre 2026 — 19 nuits,
7 étapes, 48 items, 6 liaisons, 2 vols, 4 expériences.

| # | Étape | Dates | Nuits |
|---|---|---|---|
| 1 | Tokyo | 07 → 09 nov. | 2 |
| 2 | Matsumoto & Alpes japonaises | 09 → 10 nov. | 1 |
| 3 | Shirakawa-go | 10 → 11 nov. | 1 |
| 4 | Kyoto | 11 → 15 nov. | 4 |
| 5 | Hiroshima | 15 → 17 nov. | 2 |
| 6 | Osaka | 17 → 20 nov. | 3 |
| 7 | Tokyo | 20 → 26 nov. | 6 |

Items par catégorie : 7 hôtels, 11 activités, 11 lieux, 9 restaurants,
4 shopping, 6 notes.

`lat`/`lng` des items sont à `NULL` : ils seront géocodés depuis l'app (L4).
Les 5 coordonnées que le design portait déjà (Hakushu, Miyajima, Universal,
Kōyasan, Disneyland) sont en commentaire en fin de `seed.sql`, à décommenter
pour s'épargner autant d'appels à Nominatim.

Les 4 images d'expériences (`baguettes`, `sumo`, `matcha`, `sushi`) font partie
des 9 PNG restés dans le canvas Claude Design. Tant qu'elles ne sont pas
exportées vers `design/img/` puis compressées par `npm run img`, les cartes
s'affichent sans visuel — rien ne casse.
