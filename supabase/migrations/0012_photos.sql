-- 0012_photos.sql — les photos des lieux et des villes, depuis Wikimedia (L10).
-- À exécuter après 0011_purge_google.sql. Rejouable.
--
-- Google interdit de garder ses photos : chaque affichage serait facturé. Les
-- photos de Wikimedia Commons, elles, sont sous licence libre — on a le droit
-- de les garder et de les réafficher, à condition de citer l'auteur et la
-- licence. On enregistre donc, pour un item ou une étape :
--
--   · photo_url     : la vignette sur upload.wikimedia.org ;
--   · photo_credit  : l'auteur, à afficher ;
--   · photo_license : la licence (CC BY-SA 4.0…), à afficher ;
--   · photo_page    : la page du fichier sur Commons, où tout est détaillé ;
--   · photo_checked_at : quand on a cherché. Renseignée même quand rien n'a
--     été trouvé — c'est ce qui empêche de chercher à chaque ouverture.
--
-- Pour l'instant : les lieux touristiques, les hôtels et les villes (décidé le
-- 27 septembre 2026). Aucune ligne existante n'est modifiée : les photos
-- arrivent à la première ouverture du voyage par qui peut l'écrire.

begin;

alter table public.items add column if not exists photo_url        text;
alter table public.items add column if not exists photo_credit     text;
alter table public.items add column if not exists photo_license    text;
alter table public.items add column if not exists photo_page       text;
alter table public.items add column if not exists photo_checked_at timestamptz;
alter table public.steps add column if not exists photo_url        text;
alter table public.steps add column if not exists photo_credit     text;
alter table public.steps add column if not exists photo_license    text;
alter table public.steps add column if not exists photo_page       text;
alter table public.steps add column if not exists photo_checked_at timestamptz;

comment on column public.items.photo_url is
  'Photo Wikimedia Commons (licence libre, conservable). NULL : pas de photo trouvée, ou pas encore cherchée (voir photo_checked_at).';
comment on column public.items.photo_checked_at is
  'Date de la recherche de photo, même infructueuse. NULL : à chercher. Remise à NULL quand le lieu change.';
comment on column public.steps.photo_url is
  'Photo Wikimedia Commons de la ville (licence libre, conservable).';
comment on column public.steps.photo_checked_at is
  'Date de la recherche de photo, même infructueuse. NULL : à chercher.';

-- ---------------------------------------------------------------------------
-- La vue partagée : les photos s'y affichent aussi. trip_by_share_token
-- construit son JSON colonne par colonne — reprise telle quelle de 0010, plus
-- les champs de photo (sans photo_checked_at, qui ne regarde que l'app).
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
          'photo_url',       s.photo_url,
          'photo_credit',    s.photo_credit,
          'photo_license',   s.photo_license,
          'photo_page',      s.photo_page,
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
                'photo_url', i.photo_url, 'photo_credit', i.photo_credit,
                'photo_license', i.photo_license, 'photo_page', i.photo_page,
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
