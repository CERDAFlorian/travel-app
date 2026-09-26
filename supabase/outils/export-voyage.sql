-- export-voyage.sql — un voyage entier en une seule valeur JSON.
--
-- À passer sur la PROD, dans le SQL Editor. LECTURE SEULE : ce fichier ne
-- contient qu'un `select`, et `npm run sql:check` refuse qu'il contienne la
-- moindre écriture. Il ne peut rien abîmer.
--
-- Il sert deux fois :
--   · à rapatrier le vrai voyage sur la base de dev, avec import-voyage.sql ;
--   · de SAUVEGARDE, avant toute migration qui réécrit la donnée de prod.
--
-- MODE D'EMPLOI
--   1. Changer le slug tout en bas si ce n'est pas 'japon-2026'.
--   2. Run. Une seule ligne revient, colonne « voyage ». Aucune ligne : le
--      slug n'existe pas sur cette base.
--   3. Copier la valeur de la cellule — ou Export → JSON — et la garder.
--
-- Pas de begin/commit : le SQL Editor n'affiche que le résultat de la dernière
-- instruction, et un `commit` final masquerait le JSON. Un `select` seul ne
-- peut de toute façon rien écrire.
--
-- CE QUI N'EST PAS EXPORTÉ, volontairement :
--   · `share_token` : le lien de partage de la prod n'a rien à faire ailleurs ;
--   · `trip_members` : les comptes ne sont pas les mêmes d'une base à l'autre.
--     L'import rattache des comptes nommés par adresse.
--
-- Chaque ligne part complète (`to_jsonb`) : une colonne ajoutée plus tard
-- voyage sans qu'on ait à toucher ce fichier.

select jsonb_build_object(
  'format',      'travel-app/voyage@1',
  'exporte_le',  now(),
  'trip',        to_jsonb(t) - 'share_token',
  'steps',       coalesce((select jsonb_agg(to_jsonb(s) order by s."position")
                             from public.steps s
                            where s.trip_id = t.id), '[]'::jsonb),
  'items',       coalesce((select jsonb_agg(to_jsonb(i) order by s."position", i."position")
                             from public.items i
                             join public.steps s on s.id = i.step_id
                            where s.trip_id = t.id), '[]'::jsonb),
  'legs',        coalesce((select jsonb_agg(to_jsonb(l))
                             from public.legs l
                            where l.trip_id = t.id), '[]'::jsonb),
  'flights',     coalesce((select jsonb_agg(to_jsonb(f))
                             from public.flights f
                            where f.trip_id = t.id), '[]'::jsonb),
  'experiences', coalesce((select jsonb_agg(to_jsonb(e) order by e."position")
                             from public.experiences e
                            where e.trip_id = t.id), '[]'::jsonb)
) as voyage
from public.trips t
where t.slug = 'japon-2026';
