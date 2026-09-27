-- 0013_photos_collees.sql — les photos collées par l'utilisateur (L10).
-- À exécuter après 0012_photos.sql. Rejouable.
--
-- Plus aucune photo de Google (27 septembre 2026). Quand Wikimedia ne trouve
-- rien — un hôtel, un restaurant, un titre vague —, l'utilisateur colle sa
-- propre image : copiée dans Google Images, depuis son téléphone, où il veut.
-- L'app la réduit (1 200 px, JPEG) et la range dans le stockage de Supabase.
--
-- `photo_source` dit d'où vient la photo d'un lieu :
--
--   · 'wikimedia' : trouvée toute seule, sous licence libre ;
--   · 'user'      : collée par l'utilisateur. Elle survit à un changement de
--                   position du lieu — c'est lui qui l'a choisie —, là où une
--                   photo Wikimedia est cherchée de nouveau.
--
-- LE STOCKAGE. Un espace « photos », PUBLIC en lecture : la vue partagée les
-- affiche, et une image se charge par son adresse, sans session. Les noms de
-- fichier sont aléatoires, donc impossibles à deviner. En ÉCRITURE, seuls les
-- membres qui peuvent modifier le voyage déposent ou retirent une photo :
--
--   items/<id de l'item>/<fichier>.jpg
--   steps/<id de l'étape>/<fichier>.jpg
--
-- Le premier dossier dit le genre, le second l'item ou l'étape ; c'est de là
-- que les règles remontent au voyage.

begin;

alter table public.items add column if not exists photo_source text;
alter table public.steps add column if not exists photo_source text;

-- `add constraint if not exists` n'existe pas : on retire avant d'ajouter.
alter table public.items drop constraint if exists items_photo_source_known;
alter table public.steps drop constraint if exists steps_photo_source_known;
alter table public.items
  add constraint items_photo_source_known check (photo_source is null or photo_source in ('wikimedia', 'user'));
alter table public.steps
  add constraint steps_photo_source_known check (photo_source is null or photo_source in ('wikimedia', 'user'));

-- Les photos déjà trouvées par 0012 viennent toutes de Wikimedia.
update public.items set photo_source = 'wikimedia' where photo_url is not null and photo_source is null;
update public.steps set photo_source = 'wikimedia' where photo_url is not null and photo_source is null;

comment on column public.items.photo_source is
  'D''où vient la photo : ''wikimedia'' (trouvée seule) ou ''user'' (collée). Une photo collée survit à un changement de position du lieu.';
comment on column public.steps.photo_source is
  'D''où vient la photo de la ville : ''wikimedia'' ou ''user''.';

-- ---------------------------------------------------------------------------
-- L'espace de stockage
-- ---------------------------------------------------------------------------

-- 1 Mo au plus : l'app réduit chaque image avant l'envoi, bien en dessous.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 1048576, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Ce chemin de fichier appartient-il à un voyage que l'utilisateur peut
-- modifier ? Comparaison en texte : un identifiant mal formé rend « non »,
-- jamais une erreur.
create or replace function public.can_edit_photo_path(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    case (storage.foldername(p_name))[1]
      when 'items' then public.is_trip_editor(public.trip_id_of_step(
        (select i.step_id from public.items i where i.id::text = (storage.foldername(p_name))[2])))
      when 'steps' then public.is_trip_editor(public.trip_id_of_step(
        (select s.id from public.steps s where s.id::text = (storage.foldername(p_name))[2])))
      else false
    end,
    false);
$$;

revoke execute on function public.can_edit_photo_path(text) from public;
revoke execute on function public.can_edit_photo_path(text) from anon;
grant  execute on function public.can_edit_photo_path(text) to authenticated;

-- Lire une photo passe par son adresse publique, sans règle. Ces règles-ci ne
-- valent que pour déposer, remplacer, retirer — et lister, que la suppression
-- demande aussi.
drop policy if exists photos_select on storage.objects;
drop policy if exists photos_insert on storage.objects;
drop policy if exists photos_update on storage.objects;
drop policy if exists photos_delete on storage.objects;

create policy photos_select on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.can_edit_photo_path(name));
create policy photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.can_edit_photo_path(name));
create policy photos_update on storage.objects for update to authenticated
  using (bucket_id = 'photos' and public.can_edit_photo_path(name))
  with check (bucket_id = 'photos' and public.can_edit_photo_path(name));
create policy photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.can_edit_photo_path(name));

commit;
