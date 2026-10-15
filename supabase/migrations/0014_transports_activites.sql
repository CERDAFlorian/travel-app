-- 0014_transports_activites.sql — le transport d'une activité (L11, F4).
-- À exécuter après 0013_photos_collees.sql. Rejouable.
--
-- Un trajet ne reliait que deux villes. Le ferry de Miyajima, le téléphérique
-- du mont Misen, le bus de Kōyasan ne se notaient nulle part, sinon dans le
-- titre de l'activité. Un trajet peut désormais se rattacher :
--
--   · à DEUX ÉTAPES, comme avant : from_step + to_step, item_id NULL ;
--   · à UNE ACTIVITÉ : item_id, from_step et to_step NULL.
--
-- Jamais aux deux, jamais à rien : la contrainte legs_anchor_one le garantit.
--
-- POURQUOI `legs` ET PAS UNE TABLE À PART. Un transport reste un transport :
-- même mode, mêmes horaires, même prix, même saisie. Le budget « Trajets »
-- additionne déjà `legs` et les compte sans rien changer, et une seule notion
-- de trajet évite deux formulaires qui finiraient par diverger. C'est aussi ce
-- que les arrêts en chemin (F5) utiliseront : le tronçon qui MÈNE à un arrêt
-- est le transport de cet arrêt.
--
-- `direction` — 'aller' s'affiche avant l'activité, 'retour' après : le dernier
-- ferry de Miyajima ne se rate pas. Un trajet entre deux villes est toujours
-- un aller.
--
-- `position` ordonne les transports d'une même activité : train PUIS ferry.
--
-- Aucune donnée à migrer : les trajets existants relient deux étapes, et
-- restent valides tels quels (direction 'aller', position 0 par défaut).

begin;

alter table public.legs add column if not exists item_id    uuid references public.items(id) on delete cascade;
alter table public.legs add column if not exists direction  text    not null default 'aller';
alter table public.legs add column if not exists "position" integer not null default 0;

-- Un trajet d'activité n'a pas d'étapes : les deux colonnes deviennent
-- facultatives. La clé étrangère composite (from_step, trip_id) ne se vérifie
-- pas quand from_step est NULL, et l'unicité (from_step, to_step) tient : deux
-- NULL ne sont jamais égaux.
alter table public.legs alter column from_step drop not null;
alter table public.legs alter column to_step   drop not null;

-- `add constraint if not exists` n'existe pas : on retire avant d'ajouter.
alter table public.legs drop constraint if exists legs_anchor_one;
alter table public.legs drop constraint if exists legs_direction_known;
alter table public.legs drop constraint if exists legs_direction_city;
alter table public.legs drop constraint if exists legs_position_sane;
alter table public.legs
  add constraint legs_anchor_one check (
    (item_id is null and from_step is not null and to_step is not null)
    or (item_id is not null and from_step is null and to_step is null)
  ),
  add constraint legs_direction_known check (direction in ('aller', 'retour')),
  -- On ne « revient » pas d'une ville vers la précédente : le trajet suivant
  -- relie deux autres étapes.
  add constraint legs_direction_city  check (item_id is not null or direction = 'aller'),
  add constraint legs_position_sane   check ("position" >= 0);

create index if not exists legs_item_idx on public.legs (item_id) where item_id is not null;

comment on column public.legs.item_id is
  'L''activité que ce trajet dessert (L11 F4). NULL pour un trajet entre deux étapes.';
comment on column public.legs.direction is
  '''aller'' (avant l''activité) ou ''retour'' (après). Toujours ''aller'' entre deux étapes.';
comment on column public.legs."position" is
  'Ordre des transports d''une même activité, dans une direction : train puis ferry.';

-- ---------------------------------------------------------------------------
-- Même voyage. La FK composite garde un trajet entre étapes dans son voyage ;
-- `items` n'a pas de trip_id, donc rien de tel pour une activité. Sans ce
-- contrôle, l'éditeur d'un voyage pourrait accrocher un trajet à l'activité
-- d'un autre — il faudrait en connaître l'identifiant, mais la donnée serait
-- fausse sans que rien ne le dise.
-- ---------------------------------------------------------------------------

create or replace function public.legs_item_same_trip()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.item_id is not null and new.trip_id is distinct from public.trip_id_of_step(
       (select i.step_id from public.items i where i.id = new.item_id)) then
    raise exception 'Ce trajet et son activité n''appartiennent pas au même voyage.';
  end if;
  return new;
end;
$$;

revoke execute on function public.legs_item_same_trip() from public;

drop trigger if exists legs_item_same_trip on public.legs;
create trigger legs_item_same_trip
  before insert or update of item_id, trip_id on public.legs
  for each row execute function public.legs_item_same_trip();

-- ---------------------------------------------------------------------------
-- La vue partagée. trip_by_share_token construit son JSON colonne par colonne :
-- reprise telle quelle de 0013, plus item_id, direction et position — sans
-- quoi le ferry de Miyajima s'afficherait comme un trajet entre deux villes
-- inconnues, c'est-à-dire nulle part.
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
          'photo_source',    s.photo_source,
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
                'photo_source', i.photo_source,
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
          'item_id', l.item_id, 'direction', l.direction, 'position', l."position",
          'mode', l.mode, 'duration_min', l.duration_min, 'note', l.note,
          'dep', l.dep, 'arr', l.arr, 'price', l.price, 'currency', l.currency
        ) order by l."position"
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
