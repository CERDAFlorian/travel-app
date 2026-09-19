-- 0004_vols.sql — ouvre les directions de vol aux trajets intérieurs.
-- À exécuter après 0003_partage.sql. Rejouable.
--
-- Le contrat de L1 ne prévoyait qu'un aller et un retour. En pratique un
-- voyage en compte davantage : Paris → Tokyo, un ou deux sauts intérieurs,
-- puis Tokyo → Paris. Un vol Tokyo–Fukuoka n'est ni un aller ni un retour, et
-- le CHECK le refusait purement et simplement.
--
-- C'est exactement la raison pour laquelle L1 a choisi un CHECK sur du `text`
-- plutôt qu'un ENUM PostgreSQL : faire évoluer la liste tient en deux lignes,
-- là où un type demanderait une migration autrement plus lourde.

begin;

alter table public.flights drop constraint if exists flights_direction_known;

alter table public.flights
  add constraint flights_direction_known
  check (direction in ('aller', 'retour', 'interieur'));

comment on column public.flights.direction is
  'aller | retour | interieur. « interieur » couvre les sauts sur place, qui ne sont ni l''un ni l''autre.';

commit;
