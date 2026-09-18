-- 0002_rls.sql — Row Level Security. À exécuter après 0001_schema.sql.
--
-- Modèle d'accès, une seule règle : on voit une ligne si son voyage apparaît
-- dans trip_members pour auth.uid(). items remonte via step_id → trip_id.
--
-- Trois fonctions SECURITY DEFINER portent la règle. Elles ne sont pas un
-- confort d'écriture, elles sont nécessaires : une policy de trip_members qui
-- interrogerait trip_members en SQL direct déclencherait une récursion infinie
-- (PostgreSQL applique la policy à sa propre sous-requête). Une fonction
-- SECURITY DEFINER lit la table sans repasser par RLS et coupe le cycle.
--
-- Chaque fonction est en `set search_path = ''` avec des noms pleinement
-- qualifiés : sans ça, un objet homonyme dans un schéma accessible en écriture
-- pourrait être appelé à la place du bon, avec les droits du propriétaire.

begin;

-- ---------------------------------------------------------------------------
-- Prédicats d'accès
-- ---------------------------------------------------------------------------

create or replace function public.is_trip_member(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trip_members m
    where m.trip_id = p_trip_id
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_trip_editor(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trip_members m
    where m.trip_id = p_trip_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'editor')
  );
$$;

create or replace function public.is_trip_owner(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trip_members m
    where m.trip_id = p_trip_id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  );
$$;

-- items n'a pas de trip_id : on le résout ici plutôt qu'en sous-requête sur
-- steps, dont la policy s'appliquerait à chaque ligne évaluée.
create or replace function public.trip_id_of_step(p_step_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.trip_id from public.steps s where s.id = p_step_id;
$$;

revoke execute on function
  public.is_trip_member(uuid), public.is_trip_editor(uuid),
  public.is_trip_owner(uuid),  public.trip_id_of_step(uuid)
  from public, anon;

grant execute on function
  public.is_trip_member(uuid), public.is_trip_editor(uuid),
  public.is_trip_owner(uuid),  public.trip_id_of_step(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Création d'un voyage : le créateur devient membre owner
--
-- Sans ce trigger, la page « nouveau voyage » se bloque elle-même : la ligne
-- insérée n'appartient à personne, donc son auteur ne peut ni la relire ni
-- s'y ajouter. SECURITY DEFINER parce que la policy de trip_members exige
-- d'être déjà owner du voyage — ce qu'on est précisément en train de devenir.
--
-- ATTENTION, à l'usage : l'insertion d'un voyage ne doit pas demander la ligne
-- en retour dans la même requête.
--
--   supabase.from('trips').insert(row)                 -- OK
--   supabase.from('trips').insert(row).select()        -- refusé par RLS
--
-- Avec RETURNING, PostgreSQL évalue la policy SELECT sur la ligne insérée au
-- moment de l'insertion — donc avant que ce trigger AFTER n'ait posé
-- l'appartenance. Insérer, puis relire dans un second appel.
-- ---------------------------------------------------------------------------

create or replace function public.claim_new_trip()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- auth.uid() est NULL quand le seed tourne depuis l'éditeur SQL : on ne
  -- fabrique pas un membre fantôme, l'appartenance est posée par le seed.
  if (select auth.uid()) is not null then
    insert into public.trip_members (trip_id, user_id, role)
    values (new.id, (select auth.uid()), 'owner')
    on conflict (trip_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trips_claim_creator on public.trips;
create trigger trips_claim_creator
  after insert on public.trips
  for each row execute function public.claim_new_trip();

-- ---------------------------------------------------------------------------
-- Activation
-- ---------------------------------------------------------------------------

alter table public.trips        enable row level security;
alter table public.trip_members enable row level security;
alter table public.steps        enable row level security;
alter table public.items        enable row level security;
alter table public.flights      enable row level security;
alter table public.legs         enable row level security;
alter table public.experiences  enable row level security;

-- ---------------------------------------------------------------------------
-- trips
-- ---------------------------------------------------------------------------

drop policy if exists trips_select on public.trips;
create policy trips_select on public.trips
  for select to authenticated
  using (public.is_trip_member(id));

-- Seul cas où l'accès ne dépend pas de trip_members : la ligne n'existe pas
-- encore. Le trigger ci-dessus la rattache immédiatement à son auteur.
drop policy if exists trips_insert on public.trips;
create policy trips_insert on public.trips
  for insert to authenticated
  with check ((select auth.uid()) is not null);

drop policy if exists trips_update on public.trips;
create policy trips_update on public.trips
  for update to authenticated
  using (public.is_trip_editor(id))
  with check (public.is_trip_editor(id));

drop policy if exists trips_delete on public.trips;
create policy trips_delete on public.trips
  for delete to authenticated
  using (public.is_trip_owner(id));

-- ---------------------------------------------------------------------------
-- trip_members — lecture par les membres, gestion par les owners
-- ---------------------------------------------------------------------------

drop policy if exists trip_members_select on public.trip_members;
create policy trip_members_select on public.trip_members
  for select to authenticated
  using (public.is_trip_member(trip_id));

drop policy if exists trip_members_insert on public.trip_members;
create policy trip_members_insert on public.trip_members
  for insert to authenticated
  with check (public.is_trip_owner(trip_id));

drop policy if exists trip_members_update on public.trip_members;
create policy trip_members_update on public.trip_members
  for update to authenticated
  using (public.is_trip_owner(trip_id))
  with check (public.is_trip_owner(trip_id));

drop policy if exists trip_members_delete on public.trip_members;
create policy trip_members_delete on public.trip_members
  for delete to authenticated
  using (public.is_trip_owner(trip_id));

-- ---------------------------------------------------------------------------
-- steps
-- ---------------------------------------------------------------------------

drop policy if exists steps_select on public.steps;
create policy steps_select on public.steps
  for select to authenticated
  using (public.is_trip_member(trip_id));

drop policy if exists steps_insert on public.steps;
create policy steps_insert on public.steps
  for insert to authenticated
  with check (public.is_trip_editor(trip_id));

-- USING et WITH CHECK sur le même prédicat : sans le WITH CHECK, un éditeur
-- pourrait déplacer une étape vers un voyage auquel il n'a pas accès.
drop policy if exists steps_update on public.steps;
create policy steps_update on public.steps
  for update to authenticated
  using (public.is_trip_editor(trip_id))
  with check (public.is_trip_editor(trip_id));

drop policy if exists steps_delete on public.steps;
create policy steps_delete on public.steps
  for delete to authenticated
  using (public.is_trip_editor(trip_id));

-- ---------------------------------------------------------------------------
-- items — remontée via step_id
-- ---------------------------------------------------------------------------

drop policy if exists items_select on public.items;
create policy items_select on public.items
  for select to authenticated
  using (public.is_trip_member(public.trip_id_of_step(step_id)));

drop policy if exists items_insert on public.items;
create policy items_insert on public.items
  for insert to authenticated
  with check (public.is_trip_editor(public.trip_id_of_step(step_id)));

drop policy if exists items_update on public.items;
create policy items_update on public.items
  for update to authenticated
  using (public.is_trip_editor(public.trip_id_of_step(step_id)))
  with check (public.is_trip_editor(public.trip_id_of_step(step_id)));

drop policy if exists items_delete on public.items;
create policy items_delete on public.items
  for delete to authenticated
  using (public.is_trip_editor(public.trip_id_of_step(step_id)));

-- ---------------------------------------------------------------------------
-- flights
-- ---------------------------------------------------------------------------

drop policy if exists flights_select on public.flights;
create policy flights_select on public.flights
  for select to authenticated
  using (public.is_trip_member(trip_id));

drop policy if exists flights_insert on public.flights;
create policy flights_insert on public.flights
  for insert to authenticated
  with check (public.is_trip_editor(trip_id));

drop policy if exists flights_update on public.flights;
create policy flights_update on public.flights
  for update to authenticated
  using (public.is_trip_editor(trip_id))
  with check (public.is_trip_editor(trip_id));

drop policy if exists flights_delete on public.flights;
create policy flights_delete on public.flights
  for delete to authenticated
  using (public.is_trip_editor(trip_id));

-- ---------------------------------------------------------------------------
-- legs
-- ---------------------------------------------------------------------------

drop policy if exists legs_select on public.legs;
create policy legs_select on public.legs
  for select to authenticated
  using (public.is_trip_member(trip_id));

drop policy if exists legs_insert on public.legs;
create policy legs_insert on public.legs
  for insert to authenticated
  with check (public.is_trip_editor(trip_id));

drop policy if exists legs_update on public.legs;
create policy legs_update on public.legs
  for update to authenticated
  using (public.is_trip_editor(trip_id))
  with check (public.is_trip_editor(trip_id));

drop policy if exists legs_delete on public.legs;
create policy legs_delete on public.legs
  for delete to authenticated
  using (public.is_trip_editor(trip_id));

-- ---------------------------------------------------------------------------
-- experiences
-- ---------------------------------------------------------------------------

drop policy if exists experiences_select on public.experiences;
create policy experiences_select on public.experiences
  for select to authenticated
  using (public.is_trip_member(trip_id));

drop policy if exists experiences_insert on public.experiences;
create policy experiences_insert on public.experiences
  for insert to authenticated
  with check (public.is_trip_editor(trip_id));

drop policy if exists experiences_update on public.experiences;
create policy experiences_update on public.experiences
  for update to authenticated
  using (public.is_trip_editor(trip_id))
  with check (public.is_trip_editor(trip_id));

drop policy if exists experiences_delete on public.experiences;
create policy experiences_delete on public.experiences
  for delete to authenticated
  using (public.is_trip_editor(trip_id));

commit;
