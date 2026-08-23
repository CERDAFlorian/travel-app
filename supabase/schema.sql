-- Schema initial pour une app de voyage personnelle.
-- A executer dans Supabase SQL Editor apres creation du projet.

create extension if not exists pgcrypto;

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  destination text,
  starts_on date,
  ends_on date,
  travelers integer not null default 1 check (travelers > 0),
  cover_image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_steps (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  city_key text not null,
  city_name text not null,
  position integer not null,
  nights integer not null default 1 check (nights > 0),
  latitude numeric,
  longitude numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, position)
);

create table if not exists public.trip_flights (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  label text not null,
  route text not null,
  flight_number text,
  flies_on date,
  price numeric(10, 2),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_items (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null references public.trip_steps(id) on delete cascade,
  category text not null check (category in ('hotel', 'activite', 'resto', 'shopping', 'lieu', 'note')),
  name text not null,
  meta text,
  price numeric(10, 2),
  latitude numeric,
  longitude numeric,
  image_path text,
  is_featured boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_trips_updated_at on public.trips;
create trigger set_trips_updated_at
before update on public.trips
for each row execute function public.set_updated_at();

drop trigger if exists set_trip_steps_updated_at on public.trip_steps;
create trigger set_trip_steps_updated_at
before update on public.trip_steps
for each row execute function public.set_updated_at();

drop trigger if exists set_trip_flights_updated_at on public.trip_flights;
create trigger set_trip_flights_updated_at
before update on public.trip_flights
for each row execute function public.set_updated_at();

drop trigger if exists set_trip_items_updated_at on public.trip_items;
create trigger set_trip_items_updated_at
before update on public.trip_items
for each row execute function public.set_updated_at();

alter table public.trips enable row level security;
alter table public.trip_steps enable row level security;
alter table public.trip_flights enable row level security;
alter table public.trip_items enable row level security;

create policy "Users can manage their trips"
on public.trips
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage steps from their trips"
on public.trip_steps
for all
using (
  exists (
    select 1 from public.trips
    where trips.id = trip_steps.trip_id
      and trips.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.trips
    where trips.id = trip_steps.trip_id
      and trips.user_id = auth.uid()
  )
);

create policy "Users can manage flights from their trips"
on public.trip_flights
for all
using (
  exists (
    select 1 from public.trips
    where trips.id = trip_flights.trip_id
      and trips.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.trips
    where trips.id = trip_flights.trip_id
      and trips.user_id = auth.uid()
  )
);

create policy "Users can manage items from their trip steps"
on public.trip_items
for all
using (
  exists (
    select 1
    from public.trip_steps
    join public.trips on trips.id = trip_steps.trip_id
    where trip_steps.id = trip_items.step_id
      and trips.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.trip_steps
    join public.trips on trips.id = trip_steps.trip_id
    where trip_steps.id = trip_items.step_id
      and trips.user_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public)
values ('trip-media', 'trip-media', false)
on conflict (id) do nothing;

