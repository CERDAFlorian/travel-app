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
const ITEM_LABEL_ZOOM = 3;

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
  const dragged = useRef(false);

  const toggle = (key) =>
    setFilters((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // --- géométrie ---------------------------------------------------------

  const stepGroups = useMemo(() => groupSteps(trip.steps), [trip.steps]);

  const itemPoints = useMemo(() => {
    const points = [];

    for (const step of trip.steps) {
      for (const item of step.items) {
        if (!categoryOf(item.category)?.onMap) continue;
        const point = projectPoint(item.lat, item.lng);
        // Un item mal géocodé peut tomber hors du cadre. On ne le dessine pas
        // dans le vide — l'avertissement des 50 km le signale déjà dans la liste.
        if (!point || !isInsideMap(point, 10)) continue;
        points.push({ id: item.id, title: item.title, category: item.category, stepId: step.id, point });
      }
    }
    return points;
  }, [trip.steps]);

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
      const placed = placeLabel(pin.cx, pin.cy, pin.radius, name, 15, hard);
      hard.push(placed.box);
      return { ...pin, name, dx: placed.x - pin.cx, dy: placed.y - pin.cy, anchor: placed.anchor };
    });

    const dots = visibleItems.map((item) => {
      const cx = item.point.x * tier;
      const cy = item.point.y * tier;
      hard.push({ x1: cx - 6, x2: cx + 6, y1: cy - 6, y2: cy + 6 });
      return { ...item, cx, cy };
    });

    const itemLabels = showItemLabels
      ? dots.map((dot) => {
          const placed = placeLabel(dot.cx, dot.cy, 5, dot.title, 12, hard);
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
    svgRef.current.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, toViewBox(event.clientX, event.clientY));
    dragged.current = false;
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

    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      const ratio = distanceBetween(a, b) / pinchStart.current.distance;
      const target = clamp(pinchStart.current.k * ratio, MIN_ZOOM, MAX_ZOOM);
      const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      dragged.current = true;
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
      if (Math.abs(dx) + Math.abs(dy) > 0.5) dragged.current = true;
      setView((v) => clampView({ ...v, x: v.x + dx, y: v.y + dy }));
    }
  }

  function onPointerUp(event) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
  }

  // Un glisser qui se termine sur une épingle ne doit pas la sélectionner :
  // on déplaçait la carte, on ne cliquait pas.
  //
  // useCallback n'est pas décoratif ici : une fonction recréée à chaque rendu
  // invaliderait la mémoïsation de <Markers> et annulerait tout le bénéfice.
  const selectGroup = useCallback(
    (group) => {
      if (dragged.current) return;
      const index = group.steps.findIndex((step) => step.id === selectedStepId);
      // Sur une épingle groupée — Tokyo, étapes 1 et 7 — les clics successifs
      // passent d'une étape à l'autre, puis désélectionnent.
      const next = group.steps[index + 1] ?? (index === -1 ? group.steps[0] : null);
      onSelectStep(next?.id ?? null);
    },
    [selectedStepId, onSelectStep],
  );

  return (
    <section className="map" aria-label="Carte de l'itinéraire">
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
          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            <path className="map__land" d={JAPAN_PATH} />
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
    </section>
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

  return (
    <>
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
            <circle className="map__dot" data-cat={dot.category} r="4" />
          </g>
        );
      })}

      {layout.pins.map((pin) => (
        <g
          key={pin.group.key}
          className="map__pin"
          transform={`translate(${pin.cx / tier} ${pin.cy / tier}) scale(${counter})`}
          onClick={() => onSelect(pin.group)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelect(pin.group);
            }
          }}
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
