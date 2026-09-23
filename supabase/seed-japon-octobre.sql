-- seed-japon-octobre.sql — le second voyage au Japon, 17 octobre → 5 novembre 2026.
--
-- Un troisième compte utilise l'app, pour son propre séjour. Ce fichier pose le
-- voyage ; son contenu — villes, items, trajets — se saisit depuis l'app, c'est
-- exactement ce à quoi elle sert.
--
-- IL NE RATTACHE PERSONNE, et c'est délibéré : l'adresse d'un tiers n'a pas à
-- vivre dans un dépôt Git. La ligne `trip_members` se pose à la main, juste
-- après — voir supabase/README.md, « Rattacher quelqu'un après coup ». Sans
-- elle, RLS rend le voyage invisible à tout le monde, y compris à toi.
--
-- REJOUABLE, et destructeur comme tout seed : il supprime le voyage
-- 'japon-octobre-2026' avant de le reconstruire. Le CASCADE emporte les étapes,
-- les items et l'appartenance. À ne rejouer qu'en sachant ce qu'on efface.

begin;

delete from public.trips where slug = 'japon-octobre-2026';

-- ---------------------------------------------------------------------------
-- Le voyage
-- ---------------------------------------------------------------------------
--
-- `theme = 'japan'` : la charte d'un pays vaut à l'intérieur d'un voyage, quel
-- que soit celui qui le prépare. Deux voyages au Japon portent les mêmes
-- couleurs, et la liste des voyages reste sur la charte de l'app.
--
-- `love_notes = false` : les mots d'amour sont écrits pour deux personnes
-- précises. Ils feraient une intrusion sur l'itinéraire de quelqu'un d'autre.
-- C'est tout l'objet de 0009.

insert into public.trips (slug, title, subtitle, start_date, end_date, theme, love_notes) values
  ('japon-octobre-2026', 'Japon', 'Itinéraire jour par jour',
   '2026-10-17', '2026-11-05', 'japan', false);

-- ---------------------------------------------------------------------------
-- Les vols — dates seulement
-- ---------------------------------------------------------------------------
--
-- Ce ne sont pas des billets : ce sont les DEUX BORNES du séjour. Le modèle
-- s'en sert (src/lib/itinerary.js) — l'arrivée du vol aller fait commencer le
-- voyage, le départ du retour le ferme — et l'app annonce alors « il reste
-- 19 nuits à placer » au lieu d'un itinéraire d'un seul jour.
--
-- Codes, horaires et prix restent NULL : ils se saisissent depuis le panneau
-- des vols quand les billets seront pris.

insert into public.flights (trip_id, direction, "date", currency)
select id, v.direction, v.date::date, 'EUR'
from public.trips, (values
  ('aller',  '2026-10-17'),
  ('retour', '2026-11-05')
) as v(direction, date)
where slug = 'japon-octobre-2026';

-- ---------------------------------------------------------------------------
-- Vérification
-- ---------------------------------------------------------------------------

do $$
declare n integer;
begin
  select count(*) into n from public.trip_members tm
    join public.trips t on t.id = tm.trip_id
   where t.slug = 'japon-octobre-2026';

  if n = 0 then
    raise warning 'Voyage posé, mais rattaché à PERSONNE : il est invisible. Pose la ligne trip_members avec l''adresse du compte concerné (supabase/README.md).';
  end if;
end $$;

commit;
