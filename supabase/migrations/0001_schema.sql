-- 0001_schema.sql — travel-app : tables, contraintes, index.
-- À exécuter en premier, puis 0002_rls.sql, puis seed.sql (voir supabase/README.md).
--
-- Conventions du fichier :
--   · tout vit dans le schéma public (PostgREST n'expose que celui-là par défaut) ;
--   · "position" et "date" sont entre guillemets : ce sont des mots-clés PostgreSQL
--     qui, non quotés, cassent la lecture dans certaines expressions (CHECK notamment) ;
--   · les CHECK remplacent les ENUM partout : ajouter une valeur = un ALTER, pas
--     une manipulation de type ;
--   · pas de budget en table — il est calculé depuis items.price + flights.price.

begin;

-- ---------------------------------------------------------------------------
-- trips
-- ---------------------------------------------------------------------------

create table if not exists public.trips (
  id          uuid primary key default gen_random_uuid(),
  slug        text        not null unique,
  title       text        not null,
  subtitle    text,
  start_date  date,
  end_date    date,
  -- Pas de CHECK sur une liste de thèmes : le registre fait foi côté code
  -- (src/theme/themes.js). Un thème inconnu retombe sur le défaut à l'exécution.
  theme       text        not null default 'japan',
  created_at  timestamptz not null default now(),

  constraint trips_slug_format  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint trips_title_filled check (length(btrim(title)) > 0),
  constraint trips_theme_format check (theme ~ '^[a-z][a-z0-9-]*$'),
  constraint trips_dates_order  check (start_date is null or end_date is null or end_date >= start_date)
);

comment on table  public.trips       is 'Un voyage. L''app est multi-voyages : rien de spécifique au Japon ici.';
comment on column public.trips.slug  is 'Identifiant d''URL et clé du cache IndexedDB (L2).';
comment on column public.trips.theme is 'Id de thème SCSS, cf. src/theme/themes.js. Alimente <html data-theme>.';

-- ---------------------------------------------------------------------------
-- trip_members — porte d'entrée de toutes les policies RLS
-- ---------------------------------------------------------------------------

create table if not exists public.trip_members (
  trip_id    uuid        not null references public.trips(id)   on delete cascade,
  user_id    uuid        not null references auth.users(id)     on delete cascade,
  role       text        not null default 'editor',
  created_at timestamptz not null default now(),

  primary key (trip_id, user_id),
  constraint trip_members_role_known check (role in ('owner', 'editor', 'viewer'))
);

create index if not exists trip_members_user_id_idx on public.trip_members (user_id);

comment on table public.trip_members is
  'Qui accède à quel voyage. Toute policy RLS remonte ici. owner : gère les membres et supprime le voyage ; editor : écrit ; viewer : lecture seule.';

-- ---------------------------------------------------------------------------
-- steps — les étapes de l'itinéraire, ordonnées par "position"
-- ---------------------------------------------------------------------------

create table if not exists public.steps (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid        not null references public.trips(id) on delete cascade,
  "position" integer     not null default 0,
  name       text        not null,
  date_start date,
  date_end   date,
  nights     integer     not null default 0,
  lat        numeric(9,6),
  lng        numeric(9,6),
  pin_x      numeric(6,5),
  pin_y      numeric(6,5),
  images     text[],
  created_at timestamptz not null default now(),

  -- Cible d'une FK composite depuis legs : garantit qu'une étape référencée
  -- appartient bien au voyage de la liaison. Une simple FK sur steps(id) ne
  -- l'empêche pas, et une liaison inter-voyages est invisible à l'œil nu.
  unique (id, trip_id),

  constraint steps_name_filled   check (length(btrim(name)) > 0),
  constraint steps_position_sane check ("position" >= 0),
  constraint steps_nights_sane   check (nights >= 0),
  constraint steps_lat_range     check (lat is null or lat between  -90 and  90),
  constraint steps_lng_range     check (lng is null or lng between -180 and 180),
  constraint steps_geo_pair      check ((lat is null) = (lng is null)),
  constraint steps_pin_x_unit    check (pin_x is null or pin_x between 0 and 1),
  constraint steps_pin_y_unit    check (pin_y is null or pin_y between 0 and 1),
  constraint steps_pin_pair      check ((pin_x is null) = (pin_y is null)),
  constraint steps_dates_order   check (date_start is null or date_end is null or date_end >= date_start)
);

create index if not exists steps_trip_position_idx on public.steps (trip_id, "position");

comment on column public.steps.lat    is 'Centre de la ville. Sert au contrôle de cohérence du géocodage (L4).';
comment on column public.steps.pin_x  is 'Placement manuel 0–1 dans le SVG. Inutilisé : la carte projette lat/lng (L5). Repli si une étape doit être forcée à un endroit précis.';
comment on column public.steps.images is 'Surcharge du bandeau photo. NULL = appariement automatique par mots-clés du titre d''item (L3).';

-- ---------------------------------------------------------------------------
-- items — le contenu d'une étape, réparti en 6 catégories
-- ---------------------------------------------------------------------------

create table if not exists public.items (
  id          uuid primary key default gen_random_uuid(),
  step_id     uuid        not null references public.steps(id) on delete cascade,
  category    text        not null,
  title       text        not null,
  url         text,
  address     text,
  price       numeric(10,2),
  currency    text        not null default 'JPY',
  booked      boolean     not null default false,
  favorite    boolean     not null default false,
  "position"  integer     not null default 0,
  notes       text,
  lat         numeric(9,6),
  lng         numeric(9,6),
  geocoded_at timestamptz,
  created_at  timestamptz not null default now(),

  constraint items_category_known check (category in ('hotel', 'activite', 'restaurant', 'shopping', 'lieu', 'note')),
  constraint items_title_filled   check (length(btrim(title)) > 0),
  constraint items_price_sane     check (price is null or price >= 0),
  constraint items_currency_iso   check (currency ~ '^[A-Z]{3}$'),
  constraint items_position_sane  check ("position" >= 0),
  constraint items_lat_range      check (lat is null or lat between  -90 and  90),
  constraint items_lng_range      check (lng is null or lng between -180 and 180),
  constraint items_geo_pair       check ((lat is null) = (lng is null)),
  constraint items_geocoded_needs_geo check (geocoded_at is null or lat is not null)
);

create index if not exists items_step_position_idx on public.items (step_id, "position");

comment on column public.items.category    is 'hotel | activite | restaurant | shopping | lieu | note. « restaurant » et non « resto » : le design dit resto, la spec tranche.';
comment on column public.items.favorite    is 'Étoile de ItemRow (L3). Sert aussi à choisir les 3 photos du bandeau d''étape.';
comment on column public.items.geocoded_at is 'Renseigné par LOCALISER (L4). NULL avec lat/lng = coordonnées saisies à la main.';

-- ---------------------------------------------------------------------------
-- flights — saisie manuelle, aucune API de vols
-- ---------------------------------------------------------------------------

create table if not exists public.flights (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid        not null references public.trips(id) on delete cascade,
  direction  text        not null,
  from_code  text,
  to_code    text,
  "date"     date,
  dep        time,
  arr        time,
  airline    text,
  flight_no  text,
  ref        text,
  price      numeric(10,2),
  currency   text        not null default 'EUR',
  created_at timestamptz not null default now(),

  constraint flights_direction_known check (direction in ('aller', 'retour')),
  constraint flights_from_iata       check (from_code is null or from_code ~ '^[A-Z]{3}$'),
  constraint flights_to_iata         check (to_code   is null or to_code   ~ '^[A-Z]{3}$'),
  constraint flights_price_sane      check (price is null or price >= 0),
  constraint flights_currency_iso    check (currency ~ '^[A-Z]{3}$')
);

create index if not exists flights_trip_idx on public.flights (trip_id, direction);

comment on column public.flights.currency is 'Défaut EUR : un vol s''achète en euros, un item se paie en yens. Sans cette colonne, le budget de L6 additionne deux devises.';
comment on column public.flights.arr      is 'Heure locale d''arrivée. Pas de fuseau : le vol est lu, pas calculé.';

-- ---------------------------------------------------------------------------
-- legs — temps de trajet entre deux étapes, saisis à la main
-- ---------------------------------------------------------------------------

create table if not exists public.legs (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid        not null references public.trips(id) on delete cascade,
  from_step    uuid        not null,
  to_step      uuid        not null,
  mode         text        not null default 'train',
  duration_min integer,
  note         text,
  created_at   timestamptz not null default now(),

  -- FK composites : une liaison ne peut pas pointer vers l'étape d'un autre voyage.
  constraint legs_from_step_fk foreign key (from_step, trip_id)
    references public.steps (id, trip_id) on delete cascade,
  constraint legs_to_step_fk   foreign key (to_step, trip_id)
    references public.steps (id, trip_id) on delete cascade,

  constraint legs_mode_known    check (mode in ('shinkansen', 'train', 'bus', 'voiture', 'ferry', 'avion', 'marche')),
  constraint legs_distinct_ends check (from_step <> to_step),
  constraint legs_duration_sane check (duration_min is null or duration_min > 0),
  unique (from_step, to_step)
);

create index if not exists legs_trip_idx on public.legs (trip_id);

comment on table public.legs is
  'Durées saisies à la main : le vol d''oiseau ne dit rien d''un Shinkansen.';

-- ---------------------------------------------------------------------------
-- experiences — vitrine, indépendante des étapes
-- ---------------------------------------------------------------------------

create table if not exists public.experiences (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid        not null references public.trips(id) on delete cascade,
  title       text        not null,
  description text,
  image       text,
  price       numeric(10,2),
  currency    text        not null default 'JPY',
  url         text,
  favorite    boolean     not null default false,
  "position"  integer     not null default 0,
  created_at  timestamptz not null default now(),

  constraint experiences_title_filled  check (length(btrim(title)) > 0),
  constraint experiences_price_sane    check (price is null or price >= 0),
  constraint experiences_currency_iso  check (currency ~ '^[A-Z]{3}$'),
  constraint experiences_position_sane check ("position" >= 0)
);

create index if not exists experiences_trip_position_idx on public.experiences (trip_id, "position");

comment on column public.experiences.image is 'Nom de fichier servi depuis /img/, en .webp. Ex. « matcha.webp ».';

-- ---------------------------------------------------------------------------
-- Droits — anon n'a rien à faire ici. L'accès passe par un utilisateur connecté,
-- filtré par les policies de 0002_rls.sql. Ceinture et bretelles : même une
-- policy trop laxiste ne rendrait rien lisible à un porteur de la clé publique.
-- ---------------------------------------------------------------------------

revoke all on public.trips, public.trip_members, public.steps, public.items,
              public.flights, public.legs, public.experiences
  from anon;

grant select, insert, update, delete
  on public.trips, public.trip_members, public.steps, public.items,
     public.flights, public.legs, public.experiences
  to authenticated;

commit;
