-- seed.sql — le voyage Japon, 7 étapes, novembre 2026.
-- À exécuter après 0001_schema.sql et 0002_rls.sql.
--
-- Rejouable : le voyage 'japon-2026' est supprimé puis reconstruit. Le CASCADE
-- emporte étapes, items, liaisons, vols, expériences et appartenances — donc
-- TOUT ce qui a été saisi depuis l'app sur ce voyage. Voir supabase/README.md.
--
-- Source des données : design/Itinéraire Japon.dc.html (seedSteps/seed/TIMES)
-- et les 25 villes géolocalisées de design/README.md.
--
-- Deux choses ne sont pas de la donnée réelle :
--   · les PRIX sont des ordres de grandeur, posés pour que le budget de L6 ait
--     quelque chose à additionner. À remplacer par les vrais montants ;
--   · lat/lng des items restent NULL, ils seront géocodés depuis l'app (L4).
--     Les 5 coordonnées que le design portait déjà sont en bas du fichier,
--     en commentaire.

begin;

-- ---------------------------------------------------------------------------
-- Voyage
-- ---------------------------------------------------------------------------

delete from public.trips where slug = 'japon-2026';

insert into public.trips (id, slug, title, subtitle, start_date, end_date, theme) values
  ('5eed0000-0000-4000-8000-000000000000', 'japon-2026', 'Japon',
   'Itinéraire interactif, jour par jour', '2026-11-07', '2026-11-26', 'japan');

-- ---------------------------------------------------------------------------
-- Étapes — 19 nuits enchaînées, chaque date_end est le date_start du suivant
-- ---------------------------------------------------------------------------

insert into public.steps (id, trip_id, "position", name, date_start, date_end, nights, lat, lng) values
  ('5eed0000-0000-4000-8000-000000000001', '5eed0000-0000-4000-8000-000000000000', 1, 'Tokyo',                        '2026-11-07', '2026-11-09', 2, 35.680000, 139.690000),
  ('5eed0000-0000-4000-8000-000000000002', '5eed0000-0000-4000-8000-000000000000', 2, 'Matsumoto & Alpes japonaises', '2026-11-09', '2026-11-10', 1, 36.240000, 137.970000),
  ('5eed0000-0000-4000-8000-000000000003', '5eed0000-0000-4000-8000-000000000000', 3, 'Shirakawa-go',                 '2026-11-10', '2026-11-11', 1, 36.260000, 136.900000),
  ('5eed0000-0000-4000-8000-000000000004', '5eed0000-0000-4000-8000-000000000000', 4, 'Kyoto',                        '2026-11-11', '2026-11-15', 4, 35.010000, 135.770000),
  ('5eed0000-0000-4000-8000-000000000005', '5eed0000-0000-4000-8000-000000000000', 5, 'Hiroshima',                    '2026-11-15', '2026-11-17', 2, 34.390000, 132.460000),
  ('5eed0000-0000-4000-8000-000000000006', '5eed0000-0000-4000-8000-000000000000', 6, 'Osaka',                        '2026-11-17', '2026-11-20', 3, 34.690000, 135.500000),
  ('5eed0000-0000-4000-8000-000000000007', '5eed0000-0000-4000-8000-000000000000', 7, 'Tokyo',                        '2026-11-20', '2026-11-26', 6, 35.680000, 139.690000);

-- ---------------------------------------------------------------------------
-- Items — les 6 catégories sont représentées sur au moins une étape.
-- La jointure par numéro d'étape évite de recopier 7 UUID sur 45 lignes.
-- ---------------------------------------------------------------------------

insert into public.items (step_id, category, title, "position", notes, price, favorite)
select s.id, v.category, v.title, v.pos, nullif(v.notes, ''), v.price, v.favorite
from (values
  -- Étape 1 · Tokyo
  (1, 'hotel',      'Hôtel à Asakusa',                    1, '2 nuits',                 34000, false),
  (1, 'activite',   'Distillerie Hakushu',                2, 'sur la route · détour 2h', 4500, false),
  (1, 'activite',   'Balade Asakusa & Nakamise',          3, '',                          null, false),
  (1, 'restaurant', 'Izakaya à Shinjuku',                 4, '',                          null, false),
  (1, 'lieu',       'Temple Sensō-ji',                    5, '',                          null, true),
  (1, 'lieu',       'Shibuya Crossing',                   6, '',                          null, true),
  (1, 'note',       'Récupérer le JR Pass à l''aéroport', 7, '',                          null, false),

  -- Étape 2 · Matsumoto & Alpes japonaises
  (2, 'hotel',      'Ryokan avec onsen',                  1, '1 nuit',                   28000, false),
  (2, 'lieu',       'Château de Matsumoto',               2, '',                           700, true),
  (2, 'activite',   'Narai-juku, route du Nakasendō',     3, '',                          null, true),
  (2, 'restaurant', 'Soba de Shinshū',                    4, '',                          null, false),
  (2, 'note',       'Prévoir des vêtements chauds',       5, '',                          null, false),

  -- Étape 3 · Shirakawa-go
  (3, 'hotel',      'Nuit en maison gasshō-zukuri',       1, '1 nuit',                   22000, false),
  (3, 'lieu',       'Point de vue de Shiroyama',          2, '',                          null, true),
  (3, 'activite',   'Balade dans le village',             3, '',                          null, false),
  (3, 'restaurant', 'Bœuf de Hida',                       4, '',                          null, false),

  -- Étape 4 · Kyoto
  (4, 'hotel',      'Machiya à Gion',                     1, '4 nuits',                  72000, false),
  (4, 'lieu',       'Fushimi Inari',                      2, '',                          null, true),
  (4, 'lieu',       'Pavillon d''or',                     3, '',                           500, true),
  (4, 'lieu',       'Arashiyama & bambouseraie',          4, '',                          null, true),
  (4, 'activite',   'Atelier matcha',                     5, '',                          4500, false),
  (4, 'restaurant', 'Marché Nishiki',                     6, '',                          null, false),
  (4, 'restaurant', 'Dîner kaiseki',                      7, '',                          null, false),
  (4, 'shopping',   'Teramachi',                          8, '',                          null, false),
  (4, 'note',       'Réserver le kaiseki avant le départ', 9, '',                         null, false),

  -- Étape 5 · Hiroshima
  (5, 'hotel',      'Hôtel centre-ville',                 1, '2 nuits',                  30000, false),
  (5, 'activite',   'Miyajima & torii flottant',          2, 'env. 45 min',               null, true),
  (5, 'lieu',       'Mémorial de la Paix',                3, '',                          null, true),
  (5, 'lieu',       'Dôme de Genbaku',                    4, '',                          null, false),
  (5, 'restaurant', 'Okonomiyaki à Okonomi-mura',         5, '',                          null, false),
  (5, 'note',       'Ferry inclus dans le JR Pass',       6, '',                          null, false),

  -- Étape 6 · Osaka
  (6, 'hotel',      'Hôtel à Namba',                      1, '3 nuits',                  48000, false),
  (6, 'activite',   'Universal Studios Japan',            2, 'env. 30 min',               8600, true),
  (6, 'activite',   'Kōyasan',                            3, 'env. 2h30',                 null, false),
  (6, 'lieu',       'Château d''Osaka',                   4, '',                           600, true),
  (6, 'restaurant', 'Street food à Dōtonbori',            5, '',                          null, false),
  (6, 'restaurant', 'Marché Kuromon',                     6, '',                          null, false),
  (6, 'shopping',   'Shinsaibashi',                       7, '',                          null, false),
  (6, 'note',       'Billets Universal à réserver',       8, '',                          null, false),

  -- Étape 7 · Tokyo
  (7, 'hotel',      'Hôtel à Shinjuku',                   1, '6 nuits',                 102000, false),
  (7, 'activite',   'Tokyo Disneyland',                   2, 'env. 40 min',               7900, true),
  (7, 'activite',   'Sumo à Ryōgoku',                     3, '',                          4000, true),
  (7, 'activite',   'Atelier baguettes',                  4, '',                          3500, false),
  (7, 'restaurant', 'Sushi au marché de Toyosu',          5, '',                          null, false),
  (7, 'shopping',   'Ginza',                              6, '',                          null, false),
  (7, 'shopping',   'Akihabara',                          7, '',                          null, false),
  (7, 'lieu',       'Illuminations d''automne',           8, '',                          null, true),
  (7, 'note',       'Derniers souvenirs',                 9, '',                          null, false)
) as v(step_no, category, title, pos, notes, price, favorite)
join public.steps s
  on s.trip_id = '5eed0000-0000-4000-8000-000000000000'
 and s."position" = v.step_no;

-- ---------------------------------------------------------------------------
-- Liaisons — 6 trajets, durées relevées à la main (TIMES du design).
-- ---------------------------------------------------------------------------

insert into public.legs (trip_id, from_step, to_step, mode, duration_min, note)
select '5eed0000-0000-4000-8000-000000000000', f.id, t.id, v.mode, v.duration_min, v.note
from (values
  (1, 2, 'train',      160, 'Ltd. Express Azusa depuis Shinjuku'),
  (2, 3, 'bus',        210, 'Via Takayama, correspondance en gare routière'),
  (3, 4, 'bus',        210, 'Bus jusqu''à Kanazawa, puis Thunderbird'),
  (4, 5, 'shinkansen', 105, 'Sanyō Shinkansen'),
  (5, 6, 'shinkansen',  90, 'Sanyō Shinkansen'),
  (6, 7, 'shinkansen', 150, 'Tōkaidō Shinkansen, Shin-Ōsaka → Tokyo')
) as v(from_no, to_no, mode, duration_min, note)
join public.steps f on f.trip_id = '5eed0000-0000-4000-8000-000000000000' and f."position" = v.from_no
join public.steps t on t.trip_id = '5eed0000-0000-4000-8000-000000000000' and t."position" = v.to_no;

-- ---------------------------------------------------------------------------
-- Vols — saisie manuelle, à compléter quand les billets seront pris
-- ---------------------------------------------------------------------------

insert into public.flights (trip_id, direction, from_code, to_code, "date", currency) values
  ('5eed0000-0000-4000-8000-000000000000', 'aller',  'CDG', 'HND', '2026-11-07', 'EUR'),
  ('5eed0000-0000-4000-8000-000000000000', 'retour', 'HND', 'CDG', '2026-11-26', 'EUR');

-- ---------------------------------------------------------------------------
-- Expériences
--
-- Les 4 images sont parmi les 9 PNG restés dans le canvas (voir design/README.md,
-- « 9 images à récupérer »). Tant qu'elles ne sont pas exportées, la carte
-- s'affiche sans visuel — rien ne casse.
-- ---------------------------------------------------------------------------

insert into public.experiences (trip_id, "position", title, description, image, price) values
  ('5eed0000-0000-4000-8000-000000000000', 1, 'Création de baguettes', 'Atelier artisanal : repartez avec vos propres baguettes. · Tokyo ou Kyoto', 'baguettes.webp', 3500),
  ('5eed0000-0000-4000-8000-000000000000', 2, 'Combat de sumo',        'Entraînement du matin ou tournoi dans une salle mythique. · Tokyo, Ryōgoku', 'sumo.webp',      4000),
  ('5eed0000-0000-4000-8000-000000000000', 3, 'Atelier matcha',        'Cérémonie du thé et gestes traditionnels. · Kyoto',                          'matcha.webp',    4500),
  ('5eed0000-0000-4000-8000-000000000000', 4, 'Expérience sushi',      'Atelier ou dégustation dans un cadre authentique. · Osaka ou Tokyo',         'sushi.webp',     6000);

-- ---------------------------------------------------------------------------
-- Appartenance
--
-- Sans ligne ici, RLS rend le voyage invisible à tout le monde et l'app affiche
-- une page vide. Tous les comptes existants deviennent owner : l'app a deux
-- utilisateurs, tous deux légitimes sur ce voyage. Si un jour ce n'est plus
-- vrai, remplacer ce bloc par un INSERT nommant les user_id voulus.
-- ---------------------------------------------------------------------------

insert into public.trip_members (trip_id, user_id, role)
select '5eed0000-0000-4000-8000-000000000000', u.id, 'owner'
from auth.users u
on conflict (trip_id, user_id) do nothing;

do $$
declare n integer;
begin
  select count(*) into n from public.trip_members
   where trip_id = '5eed0000-0000-4000-8000-000000000000';
  if n = 0 then
    raise warning 'Aucun compte dans auth.users : le voyage n''est visible par personne. Connecte-toi une fois par magic link, puis rejoue ce bloc.';
  else
    raise notice '% membre(s) rattaché(s) au voyage japon-2026.', n;
  end if;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- Coordonnées portées par le design, à décommenter pour éviter de les
-- re-géocoder. Les autres items passeront par LOCALISER (L4).
-- ---------------------------------------------------------------------------
--
-- update public.items set lat = 35.790000, lng = 138.310000 where title = 'Distillerie Hakushu';
-- update public.items set lat = 34.300000, lng = 132.320000 where title = 'Miyajima & torii flottant';
-- update public.items set lat = 34.670000, lng = 135.430000 where title = 'Universal Studios Japan';
-- update public.items set lat = 34.210000, lng = 135.580000 where title = 'Kōyasan';
-- update public.items set lat = 35.630000, lng = 139.880000 where title = 'Tokyo Disneyland';
