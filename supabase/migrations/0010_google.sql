-- 0010_google.sql — les lieux reliés à Google (L10, F2).
-- À exécuter après 0009_mots_doux.sql. Rejouable.
--
-- La recherche passe de Nominatim à Google Places. Les conditions de Google
-- Maps Platform (section 14, version du 10 juin 2026) décident du modèle :
--
--   · le `place_id` d'un lieu se garde INDÉFINIMENT : c'est lui qui relie
--     durablement un item ou une étape à Google ;
--   · ses coordonnées se gardent 30 JOURS au plus, puis s'effacent ou se
--     redemandent à partir du place_id (F3). `place_synced_at` dit quand elles
--     ont été obtenues ;
--   · le nom, l'adresse, la note ou les photos de Google ne se stockent pas du
--     tout : ils s'affichent en direct. Le titre reste celui de l'utilisateur.
--
-- Les coordonnées qui ne viennent pas de Google — seed, saisie à la main,
-- Nominatim (`geocoded_at`) — sont à nous : `place_id` NULL, hors règle des
-- 30 jours. Aucune ligne existante n'est modifiée : NULL veut dire « pas encore
-- relié », et la migration de l'existant (M) s'en chargera.

begin;

alter table public.items add column if not exists place_id        text;
alter table public.items add column if not exists place_synced_at timestamptz;
alter table public.steps add column if not exists place_id        text;
alter table public.steps add column if not exists place_synced_at timestamptz;

-- Une date de synchronisation va avec un lieu relié ET des coordonnées : c'est
-- d'elle que part le compte des 30 jours. L'inverse n'est pas vrai — après la
-- purge, un lieu garde son place_id sans coordonnées, en attendant qu'on les
-- redemande.
--
-- `add constraint if not exists` n'existe pas : on retire avant d'ajouter,
-- pour que le fichier reste rejouable.
alter table public.items drop constraint if exists items_place_sync_needs_geo;
alter table public.steps drop constraint if exists steps_place_sync_needs_geo;
alter table public.items
  add constraint items_place_sync_needs_geo
  check (place_synced_at is null or (place_id is not null and lat is not null));
alter table public.steps
  add constraint steps_place_sync_needs_geo
  check (place_synced_at is null or (place_id is not null and lat is not null));

-- La purge des 30 jours (F3) ne regarde que les lieux reliés à Google.
create index if not exists items_place_synced_idx on public.items (place_synced_at) where place_id is not null;
create index if not exists steps_place_synced_idx on public.steps (place_synced_at) where place_id is not null;

comment on column public.items.place_id is
  'Identifiant Google Places. Se garde indéfiniment (conditions Google Maps Platform, § 14). NULL : lieu pas relié à Google.';
comment on column public.items.place_synced_at is
  'Date à laquelle lat/lng ont été obtenues de Google. Au-delà de 30 jours, elles s''effacent ou se redemandent (F3).';
comment on column public.steps.place_id is
  'Identifiant Google Places de la ville. NULL : centre saisi à la main, venu du seed ou de Nominatim.';
comment on column public.steps.place_synced_at is
  'Date à laquelle lat/lng ont été obtenues de Google. Au-delà de 30 jours, elles s''effacent ou se redemandent (F3).';

-- ---------------------------------------------------------------------------
-- La vue partagée : place_id pour le bouton Plan, place_synced_at pour F3.
-- trip_by_share_token construit son JSON colonne par colonne : une colonne
-- ajoutée n'y arrive pas toute seule. Reprise telle quelle de 0009, plus ces
-- deux champs sur les étapes et les items.
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
    'love_notes', t.love_notes,

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
          'place_id',        s.place_id,
          'place_synced_at', s.place_synced_at,
          'images',     s.images,
          'items', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', i.id, 'category', i.category, 'title', i.title,
                'url', i.url, 'address', i.address, 'price', i.price,
                'currency', i.currency, 'booked', i.booked, 'favorite', i.favorite,
                'position', i."position", 'notes', i.notes,
                'lat', i.lat, 'lng', i.lng, 'geocoded_at', i.geocoded_at,
                'place_id', i.place_id, 'place_synced_at', i.place_synced_at,
                'day_offset', i.day_offset, 'day_slot', i.day_slot,
                'day_position', i.day_position, 'start_time', i.start_time
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
          'mode', l.mode, 'duration_min', l.duration_min, 'note', l.note,
          'dep', l.dep, 'arr', l.arr, 'price', l.price, 'currency', l.currency
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
