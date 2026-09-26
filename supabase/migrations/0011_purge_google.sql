-- 0011_purge_google.sql — la règle des 30 jours, côté base (L10, F3).
-- À exécuter après 0010_google.sql. Rejouable.
--
-- Les conditions de Google Maps Platform (§ 14) autorisent à garder les
-- coordonnées d'un lieu Google 30 jours au plus, puis à les effacer ou les
-- redemander. L'app les redemande quand on ouvre un voyage, au-delà de 25 jours
-- (src/lib/placeFreshness.js). Cette purge couvre le reste : les voyages que
-- personne n'ouvre — un voyage passé, un voyage abandonné.
--
-- Elle n'efface QUE ce qui vient de Google (`place_id` renseigné). Les
-- coordonnées à nous — seed, saisie à la main, Nominatim — ne sont jamais
-- touchées. Le place_id, lui, reste : c'est avec lui qu'on redemandera la
-- position à la prochaine ouverture.
--
-- PRÉREQUIS : l'extension pg_cron. Ce fichier l'active lui-même, avec la
-- commande que donne la documentation de Supabase (guides/cron/install). Si
-- l'activation est refusée, l'activer depuis le dashboard — Integrations →
-- Cron — puis rejouer ce fichier.

begin;

create or replace function public.purge_google_coordinates()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  purged  integer := 0;
  touched integer;
begin
  update public.items
     set lat = null, lng = null, place_synced_at = null
   where place_id is not null
     and place_synced_at < now() - interval '30 days';
  get diagnostics touched = row_count;
  purged := purged + touched;

  update public.steps
     set lat = null, lng = null, place_synced_at = null
   where place_id is not null
     and place_synced_at < now() - interval '30 days';
  get diagnostics touched = row_count;
  purged := purged + touched;

  return purged;
end;
$$;

comment on function public.purge_google_coordinates() is
  'Efface les coordonnées Google de plus de 30 jours (conditions Google Maps Platform, § 14). Garde le place_id. Lancée chaque nuit par pg_cron. Rend le nombre de lignes purgées.';

-- Personne d'autre que la base elle-même n'a à la lancer. Supabase accorde par
-- défaut l'exécution des fonctions de `public` à anon et authenticated : on la
-- retire nommément, en plus de `public`.
revoke execute on function public.purge_google_coordinates() from public;
revoke execute on function public.purge_google_coordinates() from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Chaque nuit, à 3 h 17 UTC — midi au Japon, en pleine nuit en Europe.
-- Un job du même nom est remplacé, pas doublé : ce bloc se rejoue sans risque.
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

select cron.schedule(
  'travel-app-purge-google-30j',
  '17 3 * * *',
  'select public.purge_google_coordinates()'
);

commit;
