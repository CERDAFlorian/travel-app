-- 0015_arrets_excursions.sql — les lieux qui en contiennent d'autres (L11, F5 et F6).
-- À exécuter après 0014_transports_activites.sql. Rejouable.
--
-- Deux retours, un seul objet :
--
--   · L'ARRÊT EN CHEMIN (F5). Entre Tokyo et Matsumoto, on s'arrête à la
--     distillerie Hakushu ; entre Takayama et Kyoto, on passe la journée à
--     Shirakawa-gō — on y visite un temple, on y mange. On n'y dort pas.
--   · L'EXCURSION (F6). Depuis Hiroshima, la journée à Miyajima : le torii, le
--     sanctuaire, le mont Misen.
--
-- Dans les deux cas, un LIEU QUI CONTIENT D'AUTRES ITEMS. Ce n'est pas une
-- étape : une étape est un changement de ville ET de logement (0007), et une
-- étape à zéro nuit ferait un trou dans l'enchaînement des dates. C'est donc un
-- ITEM, qui garde tout ce qu'un item sait déjà faire — position Google, photo,
-- épingle, transports (0014) — et qui peut en contenir d'autres :
--
--   items.kind       'arret' | 'excursion' — NULL pour un item ordinaire ;
--   items.parent_id  le lieu qui contient cet item.
--
-- UN SEUL NIVEAU. Un lieu contenant n'est jamais contenu, un item contenu ne
-- contient rien : pas d'excursion dans une excursion.
--
-- L'ARRÊT N'A PAS DE JOUR À LUI. Il appartient à la ville qu'on QUITTE
-- (step_id) et se tient le jour où l'on en part — le jour partagé de L11 F2.
-- Sa date se déduit donc des nuits de la ville, comme tout le reste : ajouter
-- une nuit à Tokyo déplace l'arrêt avec le départ, sans rien écrire. D'où
-- day_offset et day_slot NULL sur un arrêt.
--
-- CE QU'IL CONTIENT se range par moments (day_slot), dans le jour de son
-- lieu : il n'a pas de day_offset propre. Un item contenu sans moment est dans
-- la réserve de son lieu — « À placer à Shirakawa-gō ».
--
-- SUPPRIMER UN LIEU SUPPRIME CE QU'IL CONTIENT. Le temple de Shirakawa-gō n'a
-- pas de sens ailleurs qu'à Shirakawa-gō. L'app le dit avant de le faire.
--
-- Aucune donnée à migrer : tous les items existants sont ordinaires (kind NULL,
-- parent_id NULL).

begin;

alter table public.items add column if not exists kind      text;
alter table public.items add column if not exists parent_id uuid references public.items(id) on delete cascade;

-- `add constraint if not exists` n'existe pas : on retire avant d'ajouter.
alter table public.items drop constraint if exists items_kind_known;
alter table public.items drop constraint if exists items_one_level;
alter table public.items drop constraint if exists items_stop_has_no_day;
alter table public.items drop constraint if exists items_day_slot_needs_day;
alter table public.items
  add constraint items_kind_known check (kind is null or kind in ('arret', 'excursion')),
  -- Un lieu contenant n'est jamais contenu.
  add constraint items_one_level check (kind is null or parent_id is null),
  -- La date d'un arrêt vient de la ville qu'on quitte, pas d'un décalage.
  add constraint items_stop_has_no_day check (
    kind is distinct from 'arret' or (day_offset is null and day_slot is null)
  ),
  -- 0007 : « un moment sans jour ne veut rien dire ». Sauf pour un item
  -- contenu : son jour est celui de son lieu.
  add constraint items_day_slot_needs_day check (
    day_offset is not null or day_slot is null or parent_id is not null
  );

create index if not exists items_parent_idx on public.items (parent_id) where parent_id is not null;

comment on column public.items.kind is
  '''arret'' (sur la route, au départ de la ville de step_id) ou ''excursion'' (depuis la ville, un jour donné). NULL : item ordinaire. Un lieu de ce genre peut contenir d''autres items.';
comment on column public.items.parent_id is
  'Le lieu (arrêt ou excursion) qui contient cet item. Même étape que lui, un seul niveau.';

-- ---------------------------------------------------------------------------
-- Le parent doit être un lieu contenant, de la même étape. Une contrainte CHECK
-- ne lit pas une autre ligne : il faut un trigger.
--
-- DIFFÉRÉ en fin de transaction : import-voyage.sql réinsère tous les items
-- d'un coup, dans un ordre qui ne met pas forcément le lieu avant ce qu'il
-- contient. Vérifié trop tôt, l'enfant ne trouverait pas encore son parent.
-- ---------------------------------------------------------------------------

create or replace function public.items_parent_is_container()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent record;
begin
  if new.parent_id is null then
    return null;
  end if;

  select p.kind, p.step_id into parent from public.items p where p.id = new.parent_id;

  if parent.kind is null then
    raise exception 'Un item ne peut être rangé que dans un arrêt ou une excursion.';
  end if;
  if parent.step_id is distinct from new.step_id then
    raise exception 'Un item et le lieu qui le contient doivent appartenir à la même étape.';
  end if;

  return null;
end;
$$;

revoke execute on function public.items_parent_is_container() from public;

drop trigger if exists items_parent_is_container on public.items;
create constraint trigger items_parent_is_container
  after insert or update of parent_id, step_id on public.items
  deferrable initially deferred
  for each row execute function public.items_parent_is_container();

-- ---------------------------------------------------------------------------
-- La vue partagée. trip_by_share_token construit son JSON colonne par colonne :
-- reprise telle quelle de 0014, plus kind et parent_id — sans quoi Hakushu
-- s'afficherait comme un lieu de Tokyo, et le temple de Shirakawa-gō comme un
-- item en réserve.
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
                'day_position', i.day_position, 'start_time', i.start_time,
                'kind', i.kind, 'parent_id', i.parent_id
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
