import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { JAPAN_PATH } from '@/data/japan-geometry.js';
import { MAP_HEIGHT, MAP_WIDTH, isInsideMap, projectPoint } from '@/lib/projection.js';
import { CATEGORIES, categoryOf } from '@/lib/categories.js';
import { boxOf, measureText, placeLabel, zoomTier } from '@/lib/labels.js';
import './TripMap.scss';

const MIN_ZOOM = 1;
const MAX_ZOOM = 12;
// Au-delà, les noms d'items s'affichent. En deçà, seules les étapes sont
// nommées : à vue d'ensemble, quarante libellés ne forment plus qu'une tache.
// 2,1 est la valeur du design ; le contrat de L5 disait « palier 3 », mais on
// reprend le design à l'identique.
const ITEM_LABEL_ZOOM = 2.1;

// Couronne des items sans coordonnées, autour de leur ville. Valeurs du design :
// on démarre en haut à gauche et on avance de 43° par item, le rayon alternant
// sur trois crans pour éviter que deux voisins se touchent.
const RING_START_DEG = -104;
const RING_STEP_DEG = 43;
const RING_RADII = [19, 26, 33];

// Au-delà de ce déplacement, en pixels écran, on considère qu'on a fait
// glisser la carte et non cliqué. Valeur du design.
//
// Le seuil compte : trop bas, le tremblement normal de la main annule tous les
// clics — une épingle devient impossible à sélectionner à la souris comme au
// doigt. La mesure se fait depuis le point d'appui, pas d'une image à l'autre.
const DRAG_SLOP_PX = 6;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Le fond doit toujours couvrir le cadre : sans cette contrainte, un glisser
// emmène la carte hors de l'écran et on se retrouve devant du vide.
function clampView({ k, x, y }) {
  return {
    k,
    x: clamp(x, MAP_WIDTH * (1 - k), 0),
    y: clamp(y, MAP_HEIGHT * (1 - k), 0),
  };
}

// Deux étapes à la même ville partagent une épingle — Tokyo est l'étape 1 ET
// l'étape 7. Deux cercles superposés donneraient un badge illisible et une
// cible de clic ambiguë.
function groupSteps(steps) {
  const groups = new Map();

  for (const step of steps) {
    const point = projectPoint(step.lat, step.lng);
    if (!point || !isInsideMap(point, 40)) continue;

    const key = `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    const group = groups.get(key);
    if (group) group.steps.push(step);
    else groups.set(key, { key, point, steps: [step] });
  }

  return [...groups.values()];
}

export default function TripMap({ trip, selectedStepId, onSelectStep }) {
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const [filters, setFilters] = useState(
    () => new Set(['steps', ...CATEGORIES.filter((c) => c.onMap).map((c) => c.key)]),
  );

  const svgRef = useRef(null);
  const pointers = useRef(new Map());
  const pinchStart = useRef(null);
  const drag = useRef(null);

  const toggle = (key) =>
    setFilters((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // --- géométrie ---------------------------------------------------------

  const stepGroups = useMemo(() => groupSteps(trip.steps), [trip.steps]);

  // Chaque étape est ramenée à l'épingle de sa ville — Tokyo 1 et Tokyo 7
  // partagent la même.
  const anchorOfStep = useMemo(() => {
    const map = new Map();
    for (const group of stepGroups) {
      for (const step of group.steps) map.set(step.id, group);
    }
    return map;
  }, [stepGroups]);

  // TOUS les items d'une catégorie géographique sont placés, pas seulement les
  // géocodés. Sans coordonnées, l'item prend place sur une couronne autour de
  // sa ville : c'est ce qui fait qu'on voit son itinéraire se remplir avant
  // même d'avoir localisé quoi que ce soit. Le losange distingue ensuite un
  // point réellement géocodé d'un point simplement rattaché à sa ville.
  const itemPoints = useMemo(() => {
    const points = [];

    // Le compteur de couronne est tenu PAR VILLE, pas par étape. Tokyo est
    // l'étape 1 et l'étape 7 : les deux séries partagent une épingle, et deux
    // compteurs repartant de zéro les superposeraient exactement.
    const ringCount = new Map();

    for (const step of trip.steps) {
      const group = anchorOfStep.get(step.id);
      const base = group?.point;

      for (const item of step.items) {
        if (!categoryOf(item.category)?.onMap) continue;

        const own = projectPoint(item.lat, item.lng);
        const common = { id: item.id, title: item.title, category: item.category, stepId: step.id, base };

        // Un item mal géocodé peut tomber hors du cadre : on le rabat sur la
        // couronne plutôt que de le dessiner dans le vide. L'avertissement des
        // 50 km le signale déjà dans la liste.
        if (own && isInsideMap(own, 10)) {
          points.push({ ...common, point: own, geo: true });
          continue;
        }
        if (!base) continue;

        const ringIndex = ringCount.get(group.key) ?? 0;
        ringCount.set(group.key, ringIndex + 1);

        const angle = ((RING_START_DEG + ringIndex * RING_STEP_DEG) * Math.PI) / 180;
        const radius = RING_RADII[ringIndex % RING_RADII.length];
        points.push({
          ...common,
          point: { x: base.x + radius * Math.cos(angle), y: base.y + radius * Math.sin(angle) },
          geo: false,
        });
      }
    }
    return points;
  }, [trip.steps, anchorOfStep]);

  // Les liaisons, en arcs d'une ville à l'autre. Le gauchissement alterne de
  // part et d'autre pour que deux trajets successifs ne se superposent pas.
  const legArcs = useMemo(() => {
    const arcs = [];
    let index = 0;

    for (const leg of trip.legs) {
      const from = anchorOfStep.get(leg.from_step)?.point;
      const to = anchorOfStep.get(leg.to_step)?.point;
      if (!from || !to) continue;

      const bow = (index % 2 ? -1 : 1) * (0.1 + (index % 3) * 0.03);
      const mx = (from.x + to.x) / 2;
      const my = (from.y + to.y) / 2;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      arcs.push({
        id: leg.id,
        d: `M ${from.x} ${from.y} Q ${mx - dy * bow} ${my + dx * bow} ${to.x} ${to.y}`,
      });
      index += 1;
    }
    return arcs;
  }, [trip.legs, anchorOfStep]);

  const tier = zoomTier(view.k);
  const showItemLabels = view.k >= ITEM_LABEL_ZOOM;

  // --- placement des labels, une fois par palier -------------------------
  //
  // Les positions sont calculées dans l'espace écran du PALIER (coordonnées
  // carte × tier), parce que les libellés sont contre-échelonnés : leur
  // empreinte en unités carte rétrécit à mesure qu'on zoome. Placer au palier
  // inférieur est donc conservateur — en zoomant dans un palier, les labels ne
  // peuvent que s'écarter davantage, jamais se rapprocher.
  const layout = useMemo(() => {
    const hard = [];
    const visibleItems = itemPoints.filter((item) => filters.has(item.category));

    const pins = filters.has('steps')
      ? stepGroups.map((group) => {
          const selected = group.steps.some((step) => step.id === selectedStepId);
          const radius = selected ? 17 : 13;
          const cx = group.point.x * tier;
          const cy = group.point.y * tier;
          hard.push({ x1: cx - radius - 3, x2: cx + radius + 3, y1: cy - radius - 3, y2: cy + radius + 3 });
          return { group, selected, radius, cx, cy };
        })
      : [];

    // Les étapes sont nommées en premier : elles ont la priorité sur les items
    // pour les bonnes positions.
    const stepLabels = pins.map((pin) => {
      const name = pin.group.steps[0].name.split(' ')[0];
      const placed = placeLabel(pin.cx, pin.cy, pin.radius, name, 18, hard);
      hard.push(placed.box);
      return { ...pin, name, dx: placed.x - pin.cx, dy: placed.y - pin.cy, anchor: placed.anchor };
    });

    // Un point géocodé est à sa vraie place : un libellé ne doit pas le
    // recouvrir. Un point de couronne est déjà un arrangement, on accepte de
    // le frôler plutôt que de repousser le libellé à l'autre bout.
    const soft = [];
    const dots = visibleItems.map((item) => {
      const cx = item.point.x * tier;
      const cy = item.point.y * tier;
      const box = { x1: cx - 6, x2: cx + 6, y1: cy - 6, y2: cy + 6 };
      (item.geo ? hard : soft).push(box);
      return { ...item, cx, cy };
    });

    const itemLabels = showItemLabels
      ? dots.map((dot) => {
          const placed = placeLabel(dot.cx, dot.cy, 5, dot.title, 22, hard, soft);
          hard.push(placed.box);
          return { id: dot.id, dx: placed.x - dot.cx, dy: placed.y - dot.cy, anchor: placed.anchor, title: dot.title };
        })
      : [];

    return { pins: stepLabels, dots, itemLabels: new Map(itemLabels.map((l) => [l.id, l])) };
  }, [stepGroups, itemPoints, filters, selectedStepId, tier, showItemLabels]);

  // --- pan / zoom --------------------------------------------------------

  const toViewBox = useCallback((clientX, clientY) => {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * MAP_WIDTH,
      y: ((clientY - rect.top) / rect.height) * MAP_HEIGHT,
    };
  }, []);

  // Zoom centré sur un point : ce point reste sous le curseur ou sous les deux
  // doigts. Zoomer vers le centre du cadre donne une sensation de glissement.
  const zoomAt = useCallback((factor, vx, vy) => {
    setView((current) => {
      const k = clamp(current.k * factor, MIN_ZOOM, MAX_ZOOM);
      const ratio = k / current.k;
      return clampView({ k, x: vx - ratio * (vx - current.x), y: vy - ratio * (vy - current.y) });
    });
  }, []);

  // addEventListener plutôt que onWheel : React pose un écouteur passif, et un
  // écouteur passif ne peut pas appeler preventDefault — la page défilerait
  // sous la carte à chaque coup de molette.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;

    const onWheel = (event) => {
      event.preventDefault();
      const { x, y } = toViewBox(event.clientX, event.clientY);
      zoomAt(Math.exp(-event.deltaY * 0.0015), x, y);
    };

    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [toViewBox, zoomAt]);

  const distanceBetween = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function onPointerDown(event) {
    pointers.current.set(event.pointerId, toViewBox(event.clientX, event.clientY));
    // On retient le point d'appui en coordonnées écran : le déplacement
    // perçu par la main ne dépend pas du zoom de la carte.
    //
    // PAS de setPointerCapture ici. La capture redirige l'événement `click`
    // vers l'élément capturant : les épingles recevaient le focus mais jamais
    // le clic, et aucune sélection ne partait. On ne capture qu'au moment où
    // le geste devient un glisser — voir onPointerMove.
    drag.current = { x: event.clientX, y: event.clientY, moved: 0, captured: false };
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = { distance: distanceBetween(a, b), k: view.k };
    }
  }

  function onPointerMove(event) {
    if (!pointers.current.has(event.pointerId)) return;

    const previous = pointers.current.get(event.pointerId);
    const current = toViewBox(event.clientX, event.clientY);
    pointers.current.set(event.pointerId, current);

    if (drag.current) {
      const travelled =
        Math.abs(event.clientX - drag.current.x) + Math.abs(event.clientY - drag.current.y);
      drag.current.moved = Math.max(drag.current.moved, travelled);

      // À partir d'ici c'est un glisser : on capture, pour continuer à suivre
      // le pointeur même s'il sort du cadre de la carte. Le clic est de toute
      // façon perdu, puisqu'on ne cliquait pas.
      if (!drag.current.captured && drag.current.moved > DRAG_SLOP_PX) {
        svgRef.current.setPointerCapture(event.pointerId);
        drag.current.captured = true;
      }
    }

    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      const ratio = distanceBetween(a, b) / pinchStart.current.distance;
      const target = clamp(pinchStart.current.k * ratio, MIN_ZOOM, MAX_ZOOM);
      const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      setView((v) => {
        const factor = target / v.k;
        return clampView({
          k: target,
          x: midpoint.x - factor * (midpoint.x - v.x),
          y: midpoint.y - factor * (midpoint.y - v.y),
        });
      });
      return;
    }

    if (pointers.current.size === 1) {
      const dx = current.x - previous.x;
      const dy = current.y - previous.y;
      setView((v) => clampView({ ...v, x: v.x + dx, y: v.y + dy }));
    }
  }

  function onPointerUp(event) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (drag.current?.captured && svgRef.current?.hasPointerCapture(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId);
    }
  }

  // useCallback n'est pas décoratif ici : une fonction recréée à chaque rendu
  // invaliderait la mémoïsation de <Markers> et annulerait tout le bénéfice.
  const selectGroup = useCallback(
    (group) => {
      // Un glisser qui se termine sur une épingle ne la sélectionne pas : on
      // déplaçait la carte. En deçà du seuil, c'est un clic.
      if (drag.current && drag.current.moved > DRAG_SLOP_PX) return;
      const index = group.steps.findIndex((step) => step.id === selectedStepId);
      // Sur une épingle groupée — Tokyo, étapes 1 et 7 — les clics successifs
      // passent d'une étape à l'autre, puis désélectionnent.
      const next = group.steps[index + 1] ?? (index === -1 ? group.steps[0] : null);
      onSelectStep(next?.id ?? null);
    },
    [selectedStepId, onSelectStep],
  );

  return (
    <div className="map">
      <div className="map__frame">
        <svg
          ref={svgRef}
          className="map__svg"
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          role="img"
          aria-label={`Carte du voyage ${trip.title}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* La mer ne bouge pas : elle est hors de la transformation, sinon
              elle se déplacerait avec la carte et découvrirait le fond. */}
          <defs>
            <radialGradient id="map-sea" cx="50%" cy="45%" r="70%">
              <stop offset="0%" stopColor="var(--map-sea)" />
              <stop offset="100%" stopColor="var(--map-sea-edge)" />
            </radialGradient>
          </defs>
          <rect x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#map-sea)" />

          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            <path className="map__land" d={JAPAN_PATH} />

            {/* L'itinéraire d'une ville à l'autre, en arcs. C'est ce qui fait
                lire la carte comme un voyage et non comme un semis de points. */}
            <g className="map__legs">
              {legArcs.map((arc) => (
                <path key={arc.id} d={arc.d} />
              ))}
            </g>

            <Markers layout={layout} tier={tier} k={view.k} onSelect={selectGroup} />
          </g>
        </svg>

        <div className="map__zoom">
          <button type="button" onClick={() => zoomAt(1.4, MAP_WIDTH / 2, MAP_HEIGHT / 2)} aria-label="Zoomer">
            +
          </button>
          <button type="button" onClick={() => zoomAt(1 / 1.4, MAP_WIDTH / 2, MAP_HEIGHT / 2)} aria-label="Dézoomer">
            −
          </button>
          <button type="button" onClick={() => setView({ k: 1, x: 0, y: 0 })} aria-label="Vue d'ensemble">
            ⟲
          </button>
        </div>

        <p className="map__hint">
          {view.k > 1.02
            ? `zoom ×${view.k.toFixed(1)}${showItemLabels ? '' : ' · zoome encore pour les noms'}`
            : 'molette, glisser, ou pincer pour zoomer'}
        </p>
      </div>

      <ul className="map__filters">
        <li>
          <button
            type="button"
            className="map__filter"
            data-on={filters.has('steps') || undefined}
            onClick={() => toggle('steps')}
          >
            Étapes
          </button>
        </li>
        {CATEGORIES.filter((category) => category.onMap).map((category) => (
          <li key={category.key}>
            <button
              type="button"
              className="map__filter"
              data-cat={category.key}
              data-on={filters.has(category.key) || undefined}
              onClick={() => toggle(category.key)}
            >
              {category.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Calque des marqueurs, isolé et mémoïsé.
//
// Pendant un glisser, seul le transform du <g> parent change : `layout`, `tier`
// et `k` restent identiques, donc React saute entièrement ce sous-arbre. Sans
// cette séparation, les cinquante marqueurs se reconcilieraient à chaque image
// de pan — c'est précisément le recalcul superflu que le contrat interdit.
const Markers = memo(function Markers({ layout, tier, k, onSelect }) {
  const counter = 1 / k;

  // Les points se resserrent quand on dézoome : à vue d'ensemble, six pastilles
  // de 6 px autour d'une même ville forment une bouillie.
  const radius = k >= 1.6 ? 6 : 4.6;

  return (
    <>
      {/* Le rattachement de chaque lieu à sa ville. Tracé dans l'espace carte,
          donc il s'étire avec le zoom ; l'épaisseur, elle, ne bouge pas. */}
      <g className="map__links">
        {layout.dots.map((dot) =>
          dot.base ? (
            <line
              key={dot.id}
              data-cat={dot.category}
              x1={dot.base.x}
              y1={dot.base.y}
              x2={dot.cx / tier}
              y2={dot.cy / tier}
            />
          ) : null,
        )}
      </g>

      {layout.dots.map((dot) => {
        const label = layout.itemLabels.get(dot.id);
        return (
          <g key={dot.id} transform={`translate(${dot.cx / tier} ${dot.cy / tier}) scale(${counter})`}>
            {label && (
              <>
                <line className="map__leader" x1="0" y1="0" x2={label.dx} y2={label.dy} />
                <text className="map__item-label" x={label.dx} y={label.dy} textAnchor={label.anchor}>
                  {label.title}
                </text>
              </>
            )}
            {/* Losange : coordonnées réelles. Cercle : simplement rattaché à sa
                ville, en attente de géocodage. La forme dit l'état, sans
                légende à lire. */}
            {dot.geo ? (
              <rect
                className="map__dot"
                data-cat={dot.category}
                x={-radius}
                y={-radius}
                width={radius * 2}
                height={radius * 2}
                transform="rotate(45)"
              />
            ) : (
              <circle className="map__dot" data-cat={dot.category} r={radius} />
            )}
          </g>
        );
      })}

      {/* Les épingles ne sont ni focusables ni des `role="button"` : l'anneau
          de focus du navigateur encadrait la boîte entière du groupe, pastille
          ET libellé, ce qui barrait la carte d'un rectangle bleu au moindre
          clic. La sélection d'étape reste accessible au clavier par la frise,
          faite de vrais boutons — inutile de la dupliquer sur un dessin. */}
      {layout.pins.map((pin) => (
        <g
          key={pin.group.key}
          className="map__pin"
          transform={`translate(${pin.cx / tier} ${pin.cy / tier}) scale(${counter})`}
          onClick={() => onSelect(pin.group)}
        >
          <line className="map__leader" x1="0" y1="0" x2={pin.dx} y2={pin.dy} />
          <text className="map__step-label" x={pin.dx} y={pin.dy} textAnchor={pin.anchor}>
            {pin.name}
          </text>
          {pin.selected && <circle className="map__halo" r={pin.radius + 7} />}
          <circle className="map__pin-disc" r={pin.radius} />
          <text className="map__badge" y="5" textAnchor="middle">
            {pin.group.steps.map((step) => step.position).join('·')}
          </text>
        </g>
      ))}
    </>
  );
});
