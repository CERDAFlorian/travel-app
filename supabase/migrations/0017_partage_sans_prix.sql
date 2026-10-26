-- 0017_partage_sans_prix.sql — la vue partagée ne montre plus aucun prix (L12).
-- À exécuter après 0016_heures_villes.sql. Rejouable.
--
-- Un lien de partage circule : chez des amis, chez un assistant IA à qui on
-- le donne pour qu'il lise le voyage. Ce qu'on a payé ne regarde que les
-- voyageurs (Florian, 26 octobre 2026). trip_by_share_token ne rend donc
-- plus ni prix ni devise — lieux, vols, trajets —, ni les expériences à
-- vivre, retirées de la vue partagée.
--
-- Masquer à l'écran ne suffisait pas : la fonction est appelable par `anon`
-- avec le seul jeton, et sa réponse se lit telle quelle. L'app filtre aussi
-- de son côté (src/lib/sharedView.js) : un cache écrit avant cette migration
-- garde ses prix, et ne doit pas les afficher.
--
-- Reprise de 0016 telle quelle, moins ces champs. Aucune donnée touchée.

begin;

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
                'url', i.url, 'address', i.address,
                'booked', i.booked, 'favorite', i.favorite,
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
          'airline', f.airline, 'flight_no', f.flight_no, 'ref', f.ref
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
          'dep', l.dep, 'arr', l.arr
        ) order by l."position"
      )
      from public.legs l where l.trip_id = t.id
    ), '[]'::jsonb),

    -- Plus d'expériences à vivre dans la vue partagée : la clé reste, vide,
    -- pour qu'un client plus ancien ne tombe pas sur une liste absente.
    'experiences', '[]'::jsonb
  )
  from public.trips t
  where t.share_token = p_token;
$$;

revoke execute on function public.trip_by_share_token(uuid) from public;
grant  execute on function public.trip_by_share_token(uuid) to anon, authenticated;

commit;
