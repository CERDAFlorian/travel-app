-- 0007_journees.sql — le programme jour par jour.
-- À exécuter après 0006_trajets.sql. Rejouable.
--
-- UN JOUR N'EST PAS UNE TABLE. Les dates d'un itinéraire sont dérivées de
-- l'arrivée du vol aller et des nuits de chaque étape (src/lib/itinerary.js) ;
-- une table `days` obligerait à créer et détruire des lignes à chaque nuit
-- ajoutée, à chaque étape déplacée, à chaque vol modifié — et deux vérités
-- finiraient par diverger. Le jour reste donc calculé, et c'est l'ITEM qui dit
-- auquel il appartient, par un décalage relatif à son étape :
--
--   Kyoto, 4 nuits, commence le 11 nov.
--   day_offset 0 → 11 nov.   day_offset 2 → 13 nov.
--   day_offset 1 → 12 nov.   day_offset 3 → 14 nov.
--
-- Une étape possède exactement `nights` jours : le 15 novembre est le jour de
-- trajet, donc le premier jour de Hiroshima, la ville où l'on dort ce soir-là.
-- Seule la dernière étape a un jour de plus, celui du vol retour.
--
-- `day_slot` et `start_time` ne sont lus qu'en F3 ; la colonne est créée ici
-- pour ne pas recréer trip_by_share_token deux fois. Une colonne inutilisée ne
-- coûte rien, la fonction de partage si.

begin;

-- ---------------------------------------------------------------------------
-- items — où et quand, dans le séjour
-- ---------------------------------------------------------------------------

alter table public.items add column if not exists day_offset   integer;
alter table public.items add column if not exists day_slot     text;
alter table public.items add column if not exists day_position integer not null default 0;
alter table public.items add column if not exists start_time   time;

-- `add constraint if not exists` n'existe pas : on retire avant d'ajouter,
-- c'est ce qui rend le fichier rejouable.
alter table public.items drop constraint if exists items_day_offset_sane;
alter table public.items drop constraint if exists items_day_slot_known;
alter table public.items drop constraint if exists items_day_position_sane;
alter table public.items drop constraint if exists items_day_slot_needs_day;

alter table public.items
  add constraint items_day_offset_sane   check (day_offset is null or day_offset >= 0),
  add constraint items_day_slot_known    check (day_slot is null or day_slot in
    ('journee', 'matin', 'midi', 'apres-midi', 'soir')),
  add constraint items_day_position_sane check (day_position >= 0),
  -- Un moment sans jour ne veut rien dire : « le matin » de quoi ?
  add constraint items_day_slot_needs_day check (day_offset is not null or day_slot is null);

comment on column public.items.day_offset is
  'Jour dans l''étape, à partir de 0. NULL = en réserve : l''item est souhaité mais pas encore placé. C''est le défaut, et c''est ce qui permet d''ajouter la colonne sans migrer une seule ligne.';
comment on column public.items.day_slot is
  'journee | matin | midi | apres-midi | soir. Des moments plutôt qu''une grille horaire : personne ne tient un créneau de 14h15 à Arashiyama, et quatre moments se remplissent en trois clics. « journee » couvre les quatre autres — une excursion mange la journée.';
comment on column public.items.day_position is
  'Ordre dans le moment. C''est LUI qui ordonne, pas start_time : une heure saisie ne doit pas réarranger la liste sous les doigts.';
comment on column public.items.start_time is
  'Heure ferme, quand il y en a une : musée, visite guidée, table réservée. Reste autorisée sur un item en réserve — on connaît souvent l''horaire avant d''avoir choisi le jour.';

-- ---------------------------------------------------------------------------
-- steps — une étape a au moins une nuit
-- ---------------------------------------------------------------------------
--
-- Une étape est un changement de ville ET de logement. Une excursion à la
-- journée — Kōyasan, Nara, Miyajima — est une ACTIVITÉ de la ville d'où l'on
-- part, posée sur un jour en moment « journee ». Jamais une étape : elle
-- n'aurait aucun jour à elle, et ferait un trou dans l'enchaînement des dates.

do $$
declare n integer;
begin
  select count(*) into n from public.steps where nights < 1;
  if n > 0 then
    raise exception '% étape(s) à 0 nuit. Une étape est un changement de ville ET de logement — si ce sont des excursions, elles doivent devenir des items de catégorie « activite » AVANT cette migration. Rien n''a été modifié.', n;
  end if;
end $$;

alter table public.steps drop constraint if exists steps_nights_sane;
alter table public.steps add constraint steps_nights_sane check (nights >= 1);

-- ---------------------------------------------------------------------------
-- La fonction de partage est recréée.
--
-- Elle construit son JSON colonne par colonne : quatre colonnes ajoutées
-- ailleurs n'y arrivent pas toutes seules, et la vue partagée afficherait un
-- programme vide sans rien signaler. Même piège qu'en 0005 et 0006.
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
          'dep', l.dep, 'arr', l.arr
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
