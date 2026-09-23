-- seed-japon-octobre.sql — le second voyage au Japon, 17 octobre → 5 novembre 2026.
--
-- Un troisième compte utilise l'app, pour son propre séjour. Ce fichier pose le
-- voyage, RIEN DE PLUS : ni étape, ni vol. Tout le reste se saisit depuis
-- l'app, c'est exactement ce à quoi elle sert — et une ligne posée d'office
-- qu'on doit commencer par supprimer coûte plus qu'elle ne rend.
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
-- Pas de vols
-- ---------------------------------------------------------------------------
--
-- Une première version en posait deux, datés mais vides, pour borner le séjour :
-- le modèle s'en sert (src/lib/itinerary.js) et l'app aurait annoncé « il reste
-- 19 nuits à placer ». Mauvais calcul — à l'écran, deux cartes sans compagnie,
-- sans aéroport, sans horaire et sans prix ne se lisent pas comme des repères
-- mais comme des lignes ratées, et le premier geste est de les supprimer.
--
-- Un voyage vide ne ment plus pour autant : l'en-tête annonce la période saisie
-- tant qu'aucune étape n'existe, au lieu de faire finir le séjour le jour où il
-- commence.
--
-- Les vols se saisissent depuis le panneau, quand les billets sont pris. Et
-- c'est à ce moment-là, quand ils portent leurs vraies dates, que le compteur
-- de nuits restantes prend son sens.

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
