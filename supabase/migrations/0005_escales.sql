-- 0005_escales.sql — escales et vols à cheval sur deux jours.
-- À exécuter après 0004_vols.sql. Rejouable.
--
-- Deux manques constatés à l'usage :
--
-- 1. Un Paris → Tokyo passe souvent par Helsinki ou Doha. Le modéliser en deux
--    vols séparés serait faux : c'est un seul billet, un seul prix, et on ne
--    choisit pas ses correspondances comme on choisit une étape.
--    D'où `stops`, la liste ordonnée des escales.
--
-- 2. Un vol de nuit vers le Japon décolle un jour et atterrit le lendemain.
--    Sans cette information, l'heure d'arrivée affichée est un contresens :
--    « 13:05 → 08:55 » se lit comme un vol qui remonte le temps.
--    `arrival_offset_days` porte le « +1 » que les compagnies affichent.

begin;

alter table public.flights
  add column if not exists stops text[];

alter table public.flights
  add column if not exists arrival_offset_days smallint not null default 0;

-- Un CHECK ne peut pas contenir de sous-requête : on ne peut donc pas écrire
-- `bool_and(... from unnest(stops))`. On valide la liste entière d'un coup,
-- après l'avoir mise à plat — `array_to_string` est immuable, donc admise ici.
alter table public.flights drop constraint if exists flights_stops_iata;
alter table public.flights
  add constraint flights_stops_iata
  check (
    stops is null
    or cardinality(stops) = 0
    or array_to_string(stops, ',') ~ '^[A-Z]{3}(,[A-Z]{3})*$'
  );

-- De −1 à +2 : vers l'est on perd un jour, vers l'ouest on peut en gagner un
-- en franchissant la ligne de changement de date. Au-delà, c'est une faute de
-- saisie, pas un vol.
alter table public.flights drop constraint if exists flights_arrival_offset_sane;
alter table public.flights
  add constraint flights_arrival_offset_sane
  check (arrival_offset_days between -1 and 2);

comment on column public.flights.stops is
  'Escales, codes IATA dans l''ordre. NULL ou vide = vol direct.';
comment on column public.flights.arrival_offset_days is
  'Décalage du jour d''arrivée : 0 le jour même, 1 le lendemain. Le « +1 » des compagnies.';

-- ---------------------------------------------------------------------------
-- La fonction de partage est recréée : elle construit son JSON colonne par
-- colonne, donc deux colonnes ajoutées ailleurs n'y arrivent pas toutes
-- seules. Sans ça, un ami consultant le lien verrait les vols sans escales et
-- sans le décalage — silencieusement.
--
-- 0003_partage.sql n'est PAS modifié : il reste la version qui correspond au
-- schéma de son époque. Une migration se rejoue dans l'ordre, pas en réécrivant
-- le passé.
-- ---------------------------------------------------------------------------

create or replace function public.trip_by_share_token(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id',         t.id,
    'slug',       t.slug,
    'title',      t.title,
    'subtitle',   t.subtitle,
    'start_date', t.start_date,
    'end_date',   t.end_date,
    'theme',      t.theme,

    'steps', coalesce((
      select jsonb_agg(step order by pos)
      from (
        select s."position" as pos, jsonb_build_object(
          'id',         s.id,
          'position',   s."position",
          'name',       s.name,
          'date_start', s.date_start,
          'date_end',   s.date_end,
          'nights',     s.nights,
          'lat',        s.lat,
          'lng',        s.lng,
          'images',     s.images,
          'items', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', i.id, 'category', i.category, 'title', i.title,
                'url', i.url, 'address', i.address, 'price', i.price,
                'currency', i.currency, 'booked', i.booked, 'favorite', i.favorite,
                'position', i."position", 'notes', i.notes,
                'lat', i.lat, 'lng', i.lng, 'geocoded_at', i.geocoded_at
              ) order by i."position"
            )
            from public.items i where i.step_id = s.id
          ), '[]'::jsonb)
        ) as step
        from public.steps s where s.trip_id = t.id
      ) ordered
    ), '[]'::jsonb),

    'flights', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', f.id, 'direction', f.direction, 'from_code', f.from_code,
          'to_code', f.to_code, 'stops', f.stops, 'date', f."date",
          'dep', f.dep, 'arr', f.arr, 'arrival_offset_days', f.arrival_offset_days,
          'airline', f.airline, 'flight_no', f.flight_no, 'ref', f.ref,
          'price', f.price, 'currency', f.currency
        ) order by f."date"
      )
      from public.flights f where f.trip_id = t.id
    ), '[]'::jsonb),

    'legs', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', l.id, 'from_step', l.from_step, 'to_step', l.to_step,
          'mode', l.mode, 'duration_min', l.duration_min, 'note', l.note
        )
      )
      from public.legs l where l.trip_id = t.id
    ), '[]'::jsonb),

    'experiences', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', e.id, 'position', e."position", 'title', e.title,
          'description', e.description, 'image', e.image, 'price', e.price,
          'currency', e.currency, 'url', e.url, 'favorite', e.favorite
        ) order by e."position"
      )
      from public.experiences e where e.trip_id = t.id
    ), '[]'::jsonb)
  )
  from public.trips t
  where t.share_token = p_token;
$$;

revoke execute on function public.trip_by_share_token(uuid) from public;
grant  execute on function public.trip_by_share_token(uuid) to anon, authenticated;

commit;
