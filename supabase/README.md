# Supabase — schéma, RLS, seed

Neuf fichiers, à exécuter **dans cet ordre**. Rien n'est appliqué
automatiquement : ni le repo, ni la CI, ni le déploiement ne parlent à Supabase.

> **Deux bases depuis le 23 septembre 2026.** Toute migration se pose d'abord
> sur **dev**, puis sur **prod**. Voir la section suivante — et, en cas de
> doute sur la base qu'on regarde, `npm run dev` affiche son ref dans la
> console du navigateur.

| Ordre | Fichier | Contenu | Rejouable ? |
|---|---|---|---|
| 1 | `migrations/0001_schema.sql` | 7 tables, contraintes, index, droits | oui, sans effet si déjà passé |
| 2 | `migrations/0002_rls.sql` | fonctions d'accès, trigger, policies | oui, tout est en `create or replace` / `drop … if exists` |
| 3 | `migrations/0003_partage.sql` | jeton de partage + fonction de lecture publique | oui |
| 4 | `migrations/0004_vols.sql` | ouvre la direction « interieur » sur les vols | oui |
| 5 | `migrations/0005_escales.sql` | escales et jour d'arrivée des vols | oui |
| 6 | `migrations/0006_trajets.sql` | horaires des trajets entre étapes | oui |
| 7 | `migrations/0007_journees.sql` | le programme jour par jour ; une étape a au moins une nuit | oui |
| 8 | `migrations/0008_prix_trajets.sql` | prix des trajets entre étapes | oui |
| 9 | `migrations/0009_mots_doux.sql` | les mots d'amour deviennent une option du voyage | oui |
| 10 | `seed.sql` | le voyage Japon de novembre | oui, **il écrase `japon-2026`** — garde-fou en tête de fichier |
| 11 | `seed-japon-octobre.sql` | le voyage Japon d'octobre, second compte | oui, **il écrase `japon-octobre-2026`** |

## Deux bases : dev et prod

Une seule base servait tout : `.env.local` et le déploiement pointaient le même
projet. Toute migration, tout seed, toute suppression s'appliquait donc à la
base que l'app déployée lit — et `seed.sql` s'ouvre sur un
`delete from public.trips`, qui emporte la préparation réelle en cascade.

Tant que la base était vide il n'y avait rien à perdre. Ça a cessé d'être vrai
le jour où le vrai programme a été saisi.

| | Dev | Prod |
|---|---|---|
| Sert à | essayer, casser, recommencer | le voyage réel, l'app déployée |
| Configurée dans | `.env.local`, gitignoré | secrets GitHub du dépôt |
| Qui l'écrit | `npm run dev` en local | l'image Docker déployée sur Coolify |
| On peut y rejouer `seed.sql` | oui, c'est fait pour | **non**, il efface tout |

**Aucun identifiant n'est commité.** `.env.example` ne contient que des
placeholders, `.env.local` est gitignoré, et les valeurs de prod ne vivent que
dans les secrets GitHub.

### Monter la base de dev

1. <https://supabase.com/dashboard> → **New project**. Le plan gratuit en
   autorise deux : c'est exactement ce qu'il faut, et ça ne coûte rien.
2. Le schéma d'un coup, plutôt que neuf copier-coller :

   ```sh
   npm run sql:bundle | pbcopy     # macOS : directement dans le presse-papier
   npm run sql:bundle > /tmp/schema.sql
   ```

   SQL Editor → coller → **Run**. Chaque migration garde son `begin`/`commit` :
   si l'une échoue, les précédentes restent posées et on reprend à celle qui a
   cassé. **Le seed n'en fait pas partie** — on ne mélange pas un geste
   destructeur avec la construction du schéma.
3. Créer au moins un compte : **Authentication → Users → Add user**, en cochant
   *auto confirm*. Sans ligne dans `auth.users`, le seed pose la donnée mais
   personne ne la voit (voir l'étape 3 plus bas).
4. `seed.sql` dans le SQL Editor.
5. **Project Settings → API** : recopier l'URL et la clé publishable dans
   `.env.local`.
6. `npm run dev`. La console du navigateur annonce la base lue :
   `[supabase] base « xxxxxxxx »`. Vérifier que c'est bien la nouvelle.

### Promouvoir une migration vers la prod

Dans cet ordre, sans exception :

1. écrire la migration dans `supabase/migrations/`, numérotée à la suite ;
2. `npm run sql:check` — il tourne aussi en CI, mais autant le savoir avant ;
3. **inscrire le fichier dans la liste `files` de `scripts/check-sql.mjs`.**
   Elle est FIXE : une migration non déclarée n'est contrôlée par rien, pas
   même par le garde-fou qui vérifie que la fonction de partage filtre bien sur
   son jeton ;
4. l'appliquer sur **dev**, dans le SQL Editor du projet de dev ;
5. `npm run dev` et éprouver la fonctionnalité pour de vrai ;
6. seulement ensuite, l'appliquer sur **prod**, dans le SQL Editor du projet de
   prod ;
7. vérifier les comptages sur prod (requête de l'étape 5 plus bas).

**Rien n'est automatique, et c'est le point.** Ni la CI ni le déploiement ne
parlent à une base : c'est ce qui empêche un `git push` malheureux de toucher
la production. Le prix à payer est ce pas-à-pas ; il est volontaire.

**Une colonne ajoutée à une table lue par `trip_by_share_token` impose de
recréer la fonction** — elle construit son JSON colonne par colonne. C'est le
piège du projet : 0005, 0006, 0007 et 0008 s'y sont tous heurtés. Une vue
partagée qui affiche un champ vide sans rien signaler, c'est toujours ça.

### Repartir de zéro sur dev

```sh
npm run sql:bundle | pbcopy
```

… après avoir supprimé les objets (voir « Reset » plus bas). Ou, plus radical
et souvent plus rapide : supprimer le projet de dev et en créer un neuf. C'est
une base jetable, elle ne contient rien qu'on regretterait.

**Ne jamais faire ça sur prod.**

### Le projet gratuit s'endort

Supabase met en pause un projet gratuit inactif au bout d'environ une semaine.
La base de dev est la première concernée, puisqu'on ne la touche que par
à-coups. Le réveil se fait d'un clic depuis le dashboard, mais il faut y penser
avant de se demander pourquoi `npm run dev` ne ramène rien.

---

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

## Plusieurs personnes, plusieurs voyages

L'app est multi-voyages et **RLS isole chacun** : on ne voit que les voyages
dont on est membre. Deux personnes peuvent préparer deux séjours dans la même
base sans jamais se croiser.

Ce qui n'existe pas encore : **aucune interface pour créer un compte ou un
voyage.** C'est assumé — le formulaire viendra avec le créateur d'itinéraires.
En attendant, les deux gestes sont manuels.

### 1. Le compte

Dashboard → **Authentication** → **Users** → **Add user** → *Create new user*,
avec un mot de passe et **« Auto Confirm User » coché**. L'app se connecte par
mot de passe (`signInWithPassword`), pas par lien magique : sans confirmation,
le compte ne passe pas.

Le mot de passe ne vit que là. Il n'a rien à faire dans ce dépôt.

### 2. Le voyage

Soit un fichier dédié — `seed-japon-octobre.sql` en est l'exemple —, soit
directement :

```sql
insert into public.trips (slug, title, subtitle, start_date, end_date, theme, love_notes)
values ('son-voyage-2027', 'Portugal', 'Itinéraire jour par jour',
        '2027-04-10', '2027-04-20', 'neutral', false);
```

`love_notes = false` sur tout voyage qui n'est pas le vôtre : les mots d'amour
sont écrits pour deux personnes précises, ils feraient une intrusion ailleurs.

Le trigger `trips_claim_creator` ne fait **rien** ici : `auth.uid()` est `NULL`
depuis l'éditeur SQL, et il a été écrit pour ne pas fabriquer de membre
fantôme. L'appartenance est donc à poser à la main, juste en dessous.

### 3. Le rattachement

```sql
insert into public.trip_members (trip_id, user_id, role)
select t.id, u.id, 'owner'
from public.trips t, auth.users u
where t.slug = 'son-voyage-2027' and u.email = 'adresse@exemple.fr';
```

`owner` pour la personne dont c'est le voyage — elle gère ses membres et peut
le supprimer. `editor` pour quelqu'un qui écrit sans décider, `viewer` pour la
lecture seule.

**Vérifier que la ligne existe** : sans elle, RLS rend le voyage invisible à
tout le monde, y compris à toi, et l'app affiche une page vide sans la moindre
erreur.

```sql
select t.slug, u.email, tm.role
from public.trip_members tm
join public.trips t on t.id = tm.trip_id
join auth.users u on u.id = tm.user_id
order by t.slug;
```

### Les mots d'amour

`trips.love_notes` — un drapeau **par voyage**, pas par compte : c'est le
voyage qui est un voyage de noces, pas la personne qui le regarde.

```sql
update public.trips set love_notes = false where slug = 'japon-octobre-2026';
```

Sept textes en dépendent, dans six composants : le compte à rebours de
l'en-tête, les deux lignes du bandeau, le titre des temps de trajet, l'en-tête
du panneau des vols, la note sous le vol retour, le proverbe du pied de page.
Ils sont coupés **aussi** en vue partagée, quel que soit ce drapeau.

## Changer l'adresse d'un utilisateur

**L'`id` du compte ne change pas**, donc `trip_members` reste valide et les
voyages restent rattachés : il n'y a rien à relier après coup. Ce n'est vrai
que si l'on MODIFIE le compte — le supprimer pour en recréer un perd
l'appartenance, qu'il faut alors reposer (voir « Rattacher quelqu'un après
coup »).

L'`user_id` se lit dans le SQL Editor :

```sql
select id, email, created_at from auth.users order by created_at;
```

**Depuis le dashboard** : Authentication → Users → ouvrir le compte. Selon la
version, l'édition de l'e-mail y est proposée ou non.

**Sinon, par l'API admin**, depuis un script jetable en local :

```js
import { createClient } from '@supabase/supabase-js';

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await admin.auth.admin.updateUserById('<user_id>', {
  email: 'nouvelle@adresse.fr',
  email_confirm: true, // sinon le compte attend une confirmation par mail
});
console.log(error ?? data.user.email);
```

```sh
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node change-email.mjs
```

⚠️ **La clé `service_role` contourne RLS entièrement.** Elle ne doit jamais
porter le préfixe `VITE_` ni entrer dans `.env.local` : Vite embarque les
variables `VITE_*` dans le bundle public. On la passe en ligne de commande, et
le script ne se commite pas.

**À éviter : `update auth.users set email = …` en SQL.** GoTrue tient sa propre
cohérence entre `auth.users` et `auth.identities` ; modifier une table sans
l'autre peut casser la connexion par magic link.

Après le changement, **le magic link part sur la nouvelle adresse** : s'assurer
que la personne y a accès avant de basculer.

## Reset

**Reseeder le voyage** — relancer `seed.sql`, après avoir décommenté la ligne
`create temporary table oui_je_reseede_japon_2026` en tête de fichier. Sans
elle, le fichier refuse de tourner : il efface la préparation réelle et
rattache tous les comptes de la base, ce qui n'a plus de sens depuis qu'un
troisième compte existe. Le `delete from public.trips
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

**Directions de vol.** `aller` · `retour` · `interieur`. La troisième a été
ouverte par 0004 : un voyage compte souvent plus de deux vols, et un saut
Tokyo–Fukuoka n'est ni un aller ni un retour. C'est précisément pour cette
raison que L1 avait choisi un `CHECK` sur du `text` plutôt qu'un `ENUM` —
faire évoluer la liste tient en deux lignes.

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
