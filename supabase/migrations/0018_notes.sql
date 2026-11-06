-- 0018_notes.sql — les notes du voyage.
-- À exécuter après 0017_partage_sans_prix.sql. Rejouable.
--
-- Un troisième onglet à côté de « Villes » et « Jour par jour » : un bloc-notes
-- du voyage, des notes libres qui s'empilent l'une sous l'autre dans l'ordre
-- où on les écrit (Florian, 4 novembre 2026).
--
-- Une table et non une colonne de `trips` : chaque note est un geste à part,
-- datée, et deux voyageurs qui en ajoutent une en même temps ne s'écrasent pas.
--
-- Pas dans la vue partagée : trip_by_share_token n'est pas touchée et ne les
-- rend donc pas. Elles s'écrivent pour soi, comme le budget.

begin;

create table if not exists public.trip_notes (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid        not null references public.trips(id) on delete cascade,
  body        text        not null,
  created_at  timestamptz not null default now(),

  constraint trip_notes_body_filled check (length(btrim(body)) > 0)
);

create index if not exists trip_notes_trip_created_idx on public.trip_notes (trip_id, created_at);

-- Les mêmes droits que les autres tables du voyage (0001, 0002).
revoke all on public.trip_notes from anon;
grant select, insert, update, delete on public.trip_notes to authenticated;

alter table public.trip_notes enable row level security;

drop policy if exists trip_notes_select on public.trip_notes;
create policy trip_notes_select on public.trip_notes
  for select to authenticated
  using (public.is_trip_member(trip_id));

drop policy if exists trip_notes_insert on public.trip_notes;
create policy trip_notes_insert on public.trip_notes
  for insert to authenticated
  with check (public.is_trip_editor(trip_id));

drop policy if exists trip_notes_update on public.trip_notes;
create policy trip_notes_update on public.trip_notes
  for update to authenticated
  using (public.is_trip_editor(trip_id))
  with check (public.is_trip_editor(trip_id));

drop policy if exists trip_notes_delete on public.trip_notes;
create policy trip_notes_delete on public.trip_notes
  for delete to authenticated
  using (public.is_trip_editor(trip_id));

commit;
