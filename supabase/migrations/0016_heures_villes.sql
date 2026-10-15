-- 0016_heures_villes.sql — l'heure d'arrivée et l'heure de départ d'une ville (L11).
-- À exécuter après 0015_arrets_excursions.sql. Rejouable.
--
-- Le jour où l'on change de ville appartient aux deux (L11, F2) : le matin à
-- Tokyo, le soir à Matsumoto. Sans heures, rien ne disait où passait la
-- frontière — on pouvait placer un après-midi à Tokyo alors qu'on part à
-- 10 h. Avec elles, le jour du départ ne propose plus que les moments
-- possibles dans chaque ville.
--
--   steps.arrival_time    l'heure où l'on arrive dans la ville ;
--   steps.departure_time  l'heure où on la quitte.
--
-- Facultatives : on les connaît rarement en ajoutant la ville. Elles se
-- saisissent sur la ville, puis LE TRAJET PRIME (Florian, 15 octobre 2026) :
-- enregistrer le train Tokyo → Matsumoto règle le départ de Tokyo et
-- l'arrivée à Matsumoto. C'est l'app qui les écrit, pas un trigger : avec des
-- arrêts en chemin, le départ de Tokyo est celui du premier tronçon, et cette
-- règle vit avec les autres, dans le code testé.
--
-- Aucune donnée à migrer : NULL veut dire « pas d'heure connue », et la
-- journée reste alors entièrement ouverte, comme avant.

begin;

alter table public.steps add column if not exists arrival_time   time;
alter table public.steps add column if not exists departure_time time;

comment on column public.steps.arrival_time is
  'Heure d''arrivée dans la ville. NULL : inconnue, la journée d''arrivée reste ouverte. Réglée par le trajet qui y mène quand il a un horaire.';
comment on column public.steps.departure_time is
  'Heure de départ de la ville. NULL : inconnue, le jour du départ reste ouvert. Réglée par le premier tronçon de la route quand il a un horaire.';

-- ---------------------------------------------------------------------------
-- La vue partagée. trip_by_share_token construit son JSON colonne par colonne :
-- reprise telle quelle de 0015, plus les deux heures — sans quoi la vue
-- partagée proposerait un après-midi à Tokyo le jour où l'on part à 10 h.
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
          'arrival_time',   s.arrival_time,
          'departure_time', s.departure_time,
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
