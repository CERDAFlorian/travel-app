-- sauvegarde-base.sql — TOUTE la base applicative en une seule valeur JSON.
--
-- À passer sur la PROD, dans le SQL Editor, avant toute migration. LECTURE
-- SEULE : ce fichier ne contient qu'un `select`, et `npm run sql:check`
-- refuse qu'il contienne la moindre écriture. Il ne peut rien abîmer.
--
-- MODE D'EMPLOI
--   1. Run. Une seule ligne revient, colonne « sauvegarde ».
--   2. Copier la valeur de la cellule — ou Export → JSON — et l'enregistrer
--      dans ~/Documents/travel-app-sauvegarde/base-AAAA-MM-JJ.json.
--      JAMAIS dans le dépôt : ce sont les voyages et les adresses de chacun.
--
-- Contrairement à export-voyage.sql (un voyage, pour le rapatrier sur dev),
-- c'est une photo brute de tout : chaque table en entier, ligne par ligne
-- (`to_jsonb`, une colonne ajoutée plus tard part sans toucher ce fichier),
-- avec le jeton de partage et les membres — de quoi tout reconstruire.
-- Les membres portent leur adresse : un compte recréé n'aurait pas le même id.
--
-- CE QUI N'EST PAS DEDANS :
--   · les comptes eux-mêmes (auth.users, mots de passe) : Supabase les garde ;
--   · les FICHIERS des photos collées (bucket Storage) : seule leur liste
--     part, dans « photos ». Les fichiers se récupèrent depuis Storage.
--
-- Pas de begin/commit : le SQL Editor n'affiche que le résultat de la dernière
-- instruction, et un `commit` final masquerait le JSON.

select jsonb_build_object(
  'format',       'travel-app/base@1',
  'exporte_le',   now(),
  'trips',        coalesce((select jsonb_agg(to_jsonb(t) order by t.slug)
                              from public.trips t), '[]'::jsonb),
  'trip_members', coalesce((select jsonb_agg(to_jsonb(m) || jsonb_build_object('email', u.email)
                                             order by m.trip_id, u.email)
                              from public.trip_members m
                              left join auth.users u on u.id = m.user_id), '[]'::jsonb),
  'steps',        coalesce((select jsonb_agg(to_jsonb(s) order by s.trip_id, s."position")
                              from public.steps s), '[]'::jsonb),
  'items',        coalesce((select jsonb_agg(to_jsonb(i) order by i.step_id, i."position")
                              from public.items i), '[]'::jsonb),
  'legs',         coalesce((select jsonb_agg(to_jsonb(l) order by l.trip_id)
                              from public.legs l), '[]'::jsonb),
  'flights',      coalesce((select jsonb_agg(to_jsonb(f) order by f.trip_id)
                              from public.flights f), '[]'::jsonb),
  'experiences',  coalesce((select jsonb_agg(to_jsonb(e) order by e.trip_id, e."position")
                              from public.experiences e), '[]'::jsonb),
  'photos',       coalesce((select jsonb_agg(jsonb_build_object('bucket', o.bucket_id, 'name', o.name,
                                                                'size', o.metadata->'size')
                                             order by o.name)
                              from storage.objects o), '[]'::jsonb)
) as sauvegarde;
