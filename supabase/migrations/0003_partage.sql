-- 0003_partage.sql — lien de partage en lecture seule.
-- À exécuter après 0002_rls.sql. Rejouable.
--
-- Objectif : qu'un ami sans compte puisse consulter l'itinéraire depuis une
-- URL, et rien d'autre.
--
-- Ce fichier NE DONNE AUCUN DROIT DE TABLE à `anon`. Le `revoke all … from
-- anon` de 0001 reste entier, et c'est le point : même une policy trop laxiste
-- écrite plus tard ne rendrait rien lisible au porteur de la clé publique.
-- L'accès passe par une seule fonction `security definer`, qui ne répond que
-- si on lui présente le bon jeton.
--
-- Pourquoi un jeton plutôt qu'un drapeau « public » : avec un drapeau, l'URL
-- serait /voyage/japon-2026, un slug qui se devine. Un UUID fait 122 bits
-- d'entropie — on ne tombe pas dessus par hasard.

begin;

alter table public.trips
  add column if not exists share_token uuid unique;

comment on column public.trips.share_token is
  'Jeton de partage en lecture seule. NULL = non partagé. Régénérer révoque le lien précédent.';

-- ---------------------------------------------------------------------------
-- Lecture publique par jeton
--
-- Une seule fonction, qui rend le voyage entier d'un coup — même forme que la
-- requête imbriquée de l'app, pour que le client réutilise le même
-- normaliseur.
--
-- `security definer` lit les tables sans repasser par RLS ; le filtre sur le
-- jeton EST le contrôle d'accès. `set search_path = ''` avec des noms
-- pleinement qualifiés : sans ça, un objet homonyme dans un schéma accessible
-- en écriture pourrait être appelé à la place du bon, avec les droits du
-- propriétaire.
--
-- Un jeton NULL ne peut pas correspondre : `where t.share_token = p_token` est
-- faux quand l'un des deux est NULL. Un voyage non partagé reste donc
-- invisible, y compris si l'appelant passe NULL.
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
      -- Tri sur la colonne entière, pas sur le texte du JSON : « 10 » passerait
      -- avant « 2 ». Sans effet à sept étapes, faux dès la dixième.
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
          'to_code', f.to_code, 'date', f."date", 'dep', f.dep, 'arr', f.arr,
          'airline', f.airline, 'flight_no', f.flight_no, 'ref', f.ref,
          'price', f.price, 'currency', f.currency
        ) order by f.direction
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

-- `public` inclut tout rôle présent et à venir : on retire, puis on accorde
-- nommément. `anon` n'obtient que ce droit d'exécution, rien d'autre.
revoke execute on function public.trip_by_share_token(uuid) from public;
grant  execute on function public.trip_by_share_token(uuid) to anon, authenticated;

commit;

-- ---------------------------------------------------------------------------
-- Usage
--
--   -- créer ou renouveler le lien (révoque le précédent) :
--   update public.trips set share_token = gen_random_uuid() where slug = 'japon-2026';
--
--   -- révoquer sans en créer un nouveau :
--   update public.trips set share_token = null where slug = 'japon-2026';
--
--   -- relire le jeton pour composer l'URL :
--   select slug, share_token from public.trips where slug = 'japon-2026';
--
-- L'app propose le même geste depuis la page du voyage ; ces requêtes servent
-- de secours et de documentation.
-- ---------------------------------------------------------------------------
