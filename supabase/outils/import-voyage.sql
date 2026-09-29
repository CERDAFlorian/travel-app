-- import-voyage.sql — recharge un voyage exporté par export-voyage.sql.
--
-- À passer sur la base de DEV, dans le SQL Editor. JAMAIS sur la prod.
--
-- C'est un REMPLACEMENT : le voyage de même identifiant ou de même slug est
-- supprimé, avec en cascade ses étapes, items, liaisons, vols, expériences et
-- appartenances, puis reconstruit à l'identique — mêmes UUID, mêmes dates de
-- création. Tout ce qui avait été saisi sur la copie de dev part.
--
-- Rejouable à volonté : on rapatrie la prod juste avant de tester une
-- évolution, et on recommence dès qu'on veut repartir d'une copie fraîche.
--
-- MODE D'EMPLOI — les trois zones « À REMPLIR » ci-dessous, puis Run.
--   1. Décommenter la ligne du garde-fou.
--   2. Mettre les adresses des comptes de DEV qui doivent voir le voyage.
--      Personne d'autre n'est rattaché : pas de « tous les comptes », c'est ce
--      qui a rendu seed.sql dangereux.
--   3. Coller le JSON de export-voyage.sql entre les deux balises $export_voyage$.
--      Si une note contenait elle-même « $export_voyage$ », le SQL Editor
--      refuserait le fichier entier avant d'exécuter quoi que ce soit.
--
-- Le résultat affiché est une ligne de comptages. Si quoi que ce soit ne
-- correspond pas à l'export, tout est annulé et la base reste telle quelle.
--
-- NE PAS COMMITER ce fichier rempli : il contiendrait des adresses et le
-- voyage de quelqu'un.

begin;

drop table if exists pg_temp.membres_dev;
drop table if exists pg_temp.voyage_importe;

-- ===========================================================================
-- À REMPLIR 1/3 — le garde-fou. Décommenter la ligne suivante, après avoir
-- vérifié en haut du dashboard que le projet ouvert est bien celui de DEV.
-- ===========================================================================

-- create temporary table oui_c_est_la_base_de_dev on commit drop as select 1;

-- ===========================================================================
-- À REMPLIR 2/3 — les comptes de dev qui verront le voyage, par adresse.
-- ===========================================================================

create temporary table membres_dev (email text not null);
insert into membres_dev (email) values
  ('adresse-du-compte-de-dev@exemple.fr');

-- ===========================================================================
-- À REMPLIR 3/3 — le JSON rendu par export-voyage.sql, tel quel.
-- ===========================================================================

create temporary table voyage_importe (doc jsonb not null);
insert into voyage_importe (doc) values ($export_voyage$
COLLER ICI LE JSON DE export-voyage.sql
$export_voyage$);

-- ---------------------------------------------------------------------------
-- Rien à modifier en dessous.
-- ---------------------------------------------------------------------------

do $$
declare
  d jsonb := (select doc from voyage_importe);
begin
  if to_regclass('pg_temp.oui_c_est_la_base_de_dev') is null then
    raise exception E'import-voyage.sql REMPLACE un voyage entier.\n\nIl ne se lance que sur la base de DEV : vérifie le nom du projet en haut du dashboard, puis décommente la ligne « create temporary table oui_c_est_la_base_de_dev » (zone 1/3).';
  end if;

  if d->>'format' is distinct from 'travel-app/voyage@1' then
    raise exception 'Le JSON collé ne vient pas de export-voyage.sql (format attendu : travel-app/voyage@1, reçu : %).',
      coalesce(d->>'format', 'aucun');
  end if;

  -- Un voyage que personne ne peut ouvrir est un import raté qui se tait :
  -- RLS le rend invisible, et l'app affiche une liste vide.
  if not exists (
    select 1 from membres_dev m
      join auth.users u on lower(u.email) = lower(btrim(m.email))
  ) then
    raise exception 'Aucune adresse de la zone 2/3 n''existe dans auth.users de cette base : le voyage serait invisible pour tout le monde.';
  end if;
end $$;

-- Le remplacement. Par identifiant ET par slug : la copie de dev peut venir
-- du seed (même UUID) ou d'un import précédent.
delete from public.trips t
 using voyage_importe v
 where t.id = (v.doc->'trip'->>'id')::uuid
    or t.slug = v.doc->'trip'->>'slug';

-- Dans l'ordre des clés étrangères : le voyage, ses étapes, puis ce qui
-- pointe vers elles.
insert into public.trips
select r.* from voyage_importe v, jsonb_populate_record(null::public.trips, v.doc->'trip') r;

insert into public.steps
select r.* from voyage_importe v, jsonb_populate_recordset(null::public.steps, v.doc->'steps') r;

insert into public.items
select r.* from voyage_importe v, jsonb_populate_recordset(null::public.items, v.doc->'items') r;

insert into public.legs
select r.* from voyage_importe v, jsonb_populate_recordset(null::public.legs, v.doc->'legs') r;

insert into public.flights
select r.* from voyage_importe v, jsonb_populate_recordset(null::public.flights, v.doc->'flights') r;

insert into public.experiences
select r.* from voyage_importe v, jsonb_populate_recordset(null::public.experiences, v.doc->'experiences') r;

insert into public.trip_members (trip_id, user_id, role)
select distinct (v.doc->'trip'->>'id')::uuid, u.id, 'owner'
  from voyage_importe v
 cross join membres_dev m
  join auth.users u on lower(u.email) = lower(btrim(m.email));

-- Chaque table doit compter exactement ce que l'export annonçait. Sinon, tout
-- est annulé : un import partiel serait pire que pas d'import.
do $$
declare
  d   jsonb := (select doc from voyage_importe);
  tid uuid  := (d->'trip'->>'id')::uuid;
  n   integer;
begin
  select count(*) into n from public.steps where trip_id = tid;
  if n <> jsonb_array_length(d->'steps') then
    raise exception 'étapes : % en base, % dans l''export', n, jsonb_array_length(d->'steps');
  end if;

  select count(*) into n from public.items i join public.steps s on s.id = i.step_id where s.trip_id = tid;
  if n <> jsonb_array_length(d->'items') then
    raise exception 'items : % en base, % dans l''export', n, jsonb_array_length(d->'items');
  end if;

  select count(*) into n from public.legs where trip_id = tid;
  if n <> jsonb_array_length(d->'legs') then
    raise exception 'liaisons : % en base, % dans l''export', n, jsonb_array_length(d->'legs');
  end if;

  select count(*) into n from public.flights where trip_id = tid;
  if n <> jsonb_array_length(d->'flights') then
    raise exception 'vols : % en base, % dans l''export', n, jsonb_array_length(d->'flights');
  end if;

  select count(*) into n from public.experiences where trip_id = tid;
  if n <> jsonb_array_length(d->'experiences') then
    raise exception 'expériences : % en base, % dans l''export', n, jsonb_array_length(d->'experiences');
  end if;
end $$;

commit;

-- Le compte rendu : la seule ligne que le SQL Editor affiche.
select t.slug,
       t.title,
       (select count(*) from public.steps s where s.trip_id = t.id)       as etapes,
       (select count(*) from public.items i join public.steps s on s.id = i.step_id
         where s.trip_id = t.id)                                          as items,
       (select count(*) from public.legs l where l.trip_id = t.id)        as liaisons,
       (select count(*) from public.flights f where f.trip_id = t.id)     as vols,
       (select count(*) from public.experiences e where e.trip_id = t.id) as experiences,
       (select string_agg(u.email, ', ' order by u.email)
          from public.trip_members m join auth.users u on u.id = m.user_id
         where m.trip_id = t.id)                                          as membres
  from public.trips t
  join voyage_importe v on t.id = (v.doc->'trip'->>'id')::uuid;
