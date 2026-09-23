-- 0009_mots_doux.sql — les mots d'amour deviennent une option du voyage.
-- À exécuter après 0008_prix_trajets.sql. Rejouable.
--
-- L'app est parsemée de mots écrits pour deux : le compte à rebours de
-- l'en-tête, les lignes du bandeau, le titre des temps de trajet, ceux du
-- panneau des vols, le proverbe du pied de page. Ils font l'app, et il n'est
-- pas question de les retirer.
--
-- Mais elle sert maintenant à quelqu'un d'autre, sur son propre voyage. « Nous
-- partons célébrer ce "nous" que je choisirais encore mille fois » n'a rien à
-- faire sur l'itinéraire d'un tiers.
--
-- D'où un drapeau PAR VOYAGE et non par compte : c'est le voyage qui est un
-- voyage de noces, pas la personne qui le regarde. Les deux futurs mariés
-- voient les mots sur le leur ; personne ne les voit sur les autres.
--
-- `true` par défaut : le voyage existant garde ce qui fait son caractère, et
-- c'est l'exception qui se déclare.

begin;

alter table public.trips add column if not exists love_notes boolean not null default true;

comment on column public.trips.love_notes is
  'Affiche les mots d''amour sur ce voyage. Par voyage et non par compte : c''est le voyage qui est un voyage de noces. Voir src/hooks/useLoveNotes.js.';

-- ---------------------------------------------------------------------------
-- La fonction de partage est recréée.
--
-- Une vue partagée masque déjà tous les mots doux, quel que soit ce drapeau —
-- ils sont personnels, et un lien envoyé ne les emporte pas. La colonne y est
-- tout de même exposée pour que les deux lectures rendent EXACTEMENT la même
-- forme : une charge utile qui diverge finit par produire un composant qui se
-- comporte autrement d'un côté que de l'autre, sans que rien ne le signale.
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
          'images',     s.images,
          'items', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', i.id, 'category', i.category, 'title', i.title,
                'url', i.url, 'address', i.address, 'price', i.price,
                'currency', i.currency, 'booked', i.booked, 'favorite', i.favorite,
                'position', i."position", 'notes', i.notes,
                'lat', i.lat, 'lng', i.lng, 'geocoded_at', i.geocoded_at,
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
