-- 0008_prix_trajets.sql — ce que coûtent les trajets entre étapes.
-- À exécuter après 0007_journees.sql. Rejouable.
--
-- Le budget comptait les vols et les items, jamais les trajets terrestres. Sur
-- un voyage au Japon c'est le poste qui manque le plus : six liaisons en
-- Shinkansen pèsent plus lourd que toutes les entrées de temples réunies, et
-- le total annonçait un voyage moins cher qu'il ne l'est.
--
-- `currency` vaut EUR par défaut, comme pour les vols et contrairement aux
-- items : un billet de train se réserve depuis la France, souvent avant le
-- départ, et se paie donc en euros. Le budget ramène tout sur la même échelle
-- de toute façon.

begin;

alter table public.legs add column if not exists price    numeric(10,2);
alter table public.legs add column if not exists currency text not null default 'EUR';

alter table public.legs drop constraint if exists legs_price_sane;
alter table public.legs drop constraint if exists legs_currency_iso;

alter table public.legs
  add constraint legs_price_sane   check (price is null or price >= 0),
  add constraint legs_currency_iso check (currency ~ '^[A-Z]{3}$');

comment on column public.legs.price is
  'Coût du trajet, pour le voyage entier et non par personne — comme les items et les vols. NULL = pas encore connu, ce qui n''est pas zéro : le budget le signale au lieu de le compter.';
comment on column public.legs.currency is
  'EUR par défaut : un billet de train s''achète souvent avant le départ. Les items restent en JPY.';

-- ---------------------------------------------------------------------------
-- La fonction de partage est recréée : elle construit son JSON colonne par
-- colonne, et deux colonnes ajoutées ailleurs n'y arrivent pas toutes seules.
-- Même piège qu'en 0005, 0006 et 0007.
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
