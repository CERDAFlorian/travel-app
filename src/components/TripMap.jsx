import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES } from '@/lib/categories.js';
import { MAP_ID, hasGoogleMaps, loadGoogleMaps, onGoogleAuthFailure } from '@/lib/googleMaps.js';
import { groupSteps, legArcs, nextSelection, placeItems, placeLabels } from '@/lib/mapGeometry.js';
import { useOnline } from '@/hooks/useOnline.js';
import './TripMap.scss';

// La carte du voyage, sur Google Maps (L10, F1).
//
// Google ne fournit que le fond : le style cloud du Map ID reprend la carte SVG
// d'avant — mer crème, terre kaki, et rien d'autre de Google (voir
// design/carte-google-style.json). Tout ce qu'on voit par-dessus est à nous :
// épingles numérotées, pastilles de catégorie, couronne des lieux non
// localisés, arcs des trajets saisis, pointillés vers les lieux.
//
// Toute la géométrie qui se calcule sans carte vit dans lib/mapGeometry.js,
// testée. Ce composant ne fait que la poser sur la carte.

// Au-delà, les noms des lieux s'affichent. En deçà, seules les étapes sont
// nommées : à l'échelle du pays, quarante noms ne forment plus qu'une tache.
const ITEM_LABEL_ZOOM = 11;
const FIT_PADDING = 40;

// Rayons, en pixels, de ce qui fait obstacle à un nom : une épingle, une
// pastille. Et l'écart entre le point et le début du nom.
const PIN_RADIUS = 15;
const DOT_RADIUS = 7;
const PIN_LABEL_GAP = 20;
const ITEM_LABEL_GAP = 11;

const STATUS_MESSAGE = {
  config: 'Carte indisponible : la clé Google n’est pas configurée.',
  offline: 'La carte a besoin du réseau. Tout le reste de l’itinéraire reste disponible hors ligne.',
  error: 'Google a refusé d’afficher la carte.',
};

// Les couleurs viennent du thème : une Polyline Google veut une vraie couleur,
// pas une variable CSS. Lues sur le cadre, elles suivent le thème du voyage.
function themeColors(element) {
  const style = getComputedStyle(element);
  const read = (name, fallback) => style.getPropertyValue(name).trim() || fallback;
  const colors = { accent: read('--accent', '#8f1d24'), sea: read('--map-sea', '#fbf3e3') };
  for (const category of CATEGORIES) colors[category.key] = read(`--cat-${category.key}`, '#8a6a2f');
  return colors;
}

// Une Polyline se retire par setMap(null), un marqueur avancé par sa propriété
// `map`. Les deux vivent dans la même liste.
function remove(overlay) {
  if (typeof overlay.setMap === 'function') overlay.setMap(null);
  else overlay.map = null;
}

function element(tag, className, attributes = {}) {
  const node = document.createElement(tag);
  node.className = className;
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

// Un point sans taille, posé exactement sur sa coordonnée : ses enfants se
// placent autour de lui en pixels. Un marqueur avancé ancre son contenu par le
// milieu du bas ; à taille nulle, ce point est la coordonnée elle-même.
function anchor() {
  return element('div', 'map__anchor');
}

export default function TripMap({ trip, selectedStepId, onSelectStep }) {
  const [filters, setFilters] = useState(
    () => new Set(['steps', ...CATEGORIES.filter((c) => c.onMap).map((c) => c.key)]),
  );
  const [status, setStatus] = useState(() => (hasGoogleMaps() ? 'idle' : 'config'));
  const [zoom, setZoom] = useState(null);
  const online = useOnline();

  const frameRef = useRef(null);
  const canvasRef = useRef(null);
  // La carte Google et tout ce qu'on y a posé. Un ref, pas un état : rien de
  // tout ça ne doit provoquer de rendu React.
  const google = useRef(null);

  const groups = useMemo(() => groupSteps(trip.steps), [trip.steps]);
  const items = useMemo(() => placeItems(trip.steps, groups), [trip.steps, groups]);
  const arcs = useMemo(() => legArcs(trip.legs, groups), [trip.legs, groups]);
  const showItemLabels = zoom != null && zoom >= ITEM_LABEL_ZOOM;

  // Les écouteurs de clic posés sur les épingles vivent hors de React : ils
  // lisent la sélection courante ici, jamais une valeur figée à leur création.
  const selectGroup = useRef(null);
  selectGroup.current = (group) => onSelectStep(nextSelection(group, selectedStepId));

  const toggle = (key) =>
    setFilters((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // --- chargement ------------------------------------------------------------

  useEffect(() => onGoogleAuthFailure(() => setStatus('error')), []);

  // Hors ligne, on n'essaie même pas. Au retour du réseau, on réessaie.
  useEffect(() => {
    if (status === 'idle' && !online) setStatus('offline');
    if (status === 'offline' && online) setStatus('idle');
  }, [status, online]);

  // Google n'est chargé que quand la carte approche de l'écran : une visite qui
  // ne descend pas jusqu'à elle ne coûte aucun affichage facturé.
  useEffect(() => {
    if (status !== 'idle' || !online) return undefined;

    const start = () => {
      setStatus('loading');
      loadGoogleMaps()
        .then((lib) => {
          if (!canvasRef.current) return;
          if (!google.current) google.current = createMap(lib, canvasRef.current, frameRef.current);
          setStatus('ready');
        })
        .catch((error) => setStatus(error.kind === 'network' ? 'offline' : 'error'));
    };

    if (typeof IntersectionObserver === 'undefined') {
      start();
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        start();
      },
      { rootMargin: '200px' },
    );
    observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, [status, online]);

  function createMap(lib, canvas, frame) {
    const map = new lib.Map(canvas, {
      mapId: MAP_ID,
      // Le style est clair : le mode sombre de Google ne doit jamais s'y
      // substituer, même sur un téléphone réglé en sombre.
      colorScheme: lib.ColorScheme?.LIGHT,
      backgroundColor: themeColors(frame).sea,
      disableDefaultUI: true,
      zoomControl: true,
      clickableIcons: false,
      // Un doigt déplace la carte, comme sur la carte SVG : `cooperative`
      // demanderait deux doigts et se lirait comme une carte cassée.
      gestureHandling: 'greedy',
    });

    // Un OverlayView vide, pour une seule chose : sa projection, qui convertit
    // une coordonnée en pixels. C'est elle qui dit si deux noms se chevauchent.
    // Google appelle `draw` dès que la projection existe, puis à chaque
    // changement de zoom : c'est le bon moment pour trier les noms. Au premier
    // dessin des marqueurs, la projection n'existe souvent pas encore.
    const projector = new lib.OverlayView();
    const state = { lib, map, projector, overlays: [], labels: [], obstacles: [] };
    projector.onAdd = () => {};
    projector.draw = () => layoutLabels(state);
    projector.onRemove = () => {};
    projector.setMap(map);

    map.addListener('zoom_changed', () => setZoom(map.getZoom()));
    map.addListener('idle', () => layoutLabels(state));
    fitTrip(state, groups, items);
    setZoom(map.getZoom());
    return state;
  }

  // --- dessin ----------------------------------------------------------------

  useEffect(() => {
    const state = google.current;
    if (status !== 'ready' || !state) return;

    const { lib, map } = state;
    for (const overlay of state.overlays) remove(overlay);
    state.overlays = [];
    state.labels = [];
    state.obstacles = [];

    const colors = themeColors(frameRef.current);
    const add = (overlay) => state.overlays.push(overlay);

    // Les trajets saisis, en arcs pointillés de la couleur d'accent.
    for (const arc of arcs) {
      add(
        new lib.Polyline({
          map,
          path: arc.path,
          clickable: false,
          strokeOpacity: 0,
          zIndex: 1,
          icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.6, strokeColor: colors.accent, scale: 2 }, offset: '0', repeat: '13px' }],
        }),
      );
    }

    for (const item of items) {
      if (!filters.has(item.category)) continue;
      const color = colors[item.category];
      const root = anchor();
      const label = element('span', 'map__label map__label--item');
      label.textContent = item.title;

      if (item.kind === 'geo') {
        // Losange : coordonnées réelles. Relié à sa ville par un pointillé
        // tracé sur la carte, donc qui s'étire avec le zoom.
        root.append(element('span', 'map__dot map__dot--geo', { 'data-cat': item.category }), label);
        if (item.group) {
          add(
            new lib.Polyline({
              map,
              path: [item.group, item],
              clickable: false,
              strokeOpacity: 0,
              zIndex: 2,
              icons: [{ icon: { path: 'M 0,0 0,0.01', strokeOpacity: 0.55, strokeColor: color, strokeWeight: 2.2 }, offset: '0', repeat: '6px' }],
            }),
          );
        }
        add(new lib.AdvancedMarkerElement({ map, position: item, content: root, zIndex: 20 }));
        state.labels.push({ id: item.id, owner: item.id, point: item, dx: 0, dy: 0, text: item.title, size: 13, gap: ITEM_LABEL_GAP, el: label, item: true });
        state.obstacles.push({ owner: item.id, kind: 'dot', point: item, dx: 0, dy: 0, r: DOT_RADIUS });
        continue;
      }

      // Rond : rattaché à sa ville en attendant d'être localisé. La couronne est
      // en pixels, et son pointillé aussi : elle garde sa taille à tout zoom.
      const { dx, dy } = item;
      const pad = 8;
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'map__ring-link');
      svg.setAttribute('width', Math.abs(dx) + pad * 2);
      svg.setAttribute('height', Math.abs(dy) + pad * 2);
      svg.style.left = `${Math.min(0, dx) - pad}px`;
      svg.style.top = `${Math.min(0, dy) - pad}px`;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', pad - Math.min(0, dx));
      line.setAttribute('y1', pad - Math.min(0, dy));
      line.setAttribute('x2', pad - Math.min(0, dx) + dx);
      line.setAttribute('y2', pad - Math.min(0, dy) + dy);
      line.setAttribute('stroke', color);
      svg.append(line);

      const dot = element('span', 'map__dot map__dot--ring', { 'data-cat': item.category });
      dot.style.left = `${dx}px`;
      dot.style.top = `${dy}px`;
      root.append(svg, dot, label);
      add(new lib.AdvancedMarkerElement({ map, position: item.group, content: root, zIndex: 15 }));
      state.labels.push({ id: item.id, owner: item.id, point: item.group, dx, dy, text: item.title, size: 13, gap: ITEM_LABEL_GAP, el: label, item: true });
      state.obstacles.push({ owner: item.id, kind: 'dot', point: item.group, dx, dy, r: DOT_RADIUS });
    }

    if (filters.has('steps')) {
      // Les étapes, par priorité de nom : la sélectionnée d'abord, puis dans
      // l'ordre du voyage.
      const ordered = [...groups].sort((a, b) => {
        const selected = (group) => (group.steps.some((step) => step.id === selectedStepId) ? 0 : 1);
        return selected(a) - selected(b) || a.steps[0].position - b.steps[0].position;
      });

      for (const group of ordered) {
        const selected = group.steps.some((step) => step.id === selectedStepId);
        const root = anchor();
        const pin = element('button', `map__pin${selected ? ' is-selected' : ''}`, {
          type: 'button',
          'aria-label': `Étape ${group.steps.map((step) => step.position).join(' et ')} : ${group.steps[0].name}`,
        });
        pin.textContent = group.steps.map((step) => step.position).join('·');
        pin.addEventListener('click', (event) => {
          event.stopPropagation();
          selectGroup.current(group);
        });
        // L'épingle s'allonge avec ses numéros (« 1·9 ») : le nom s'écarte
        // d'autant, et l'obstacle qu'elle oppose aux autres noms aussi.
        const half = Math.max(PIN_RADIUS - 2, (pin.textContent.length * 7 + 17) / 2);
        const label = element('span', 'map__label map__label--step');
        label.textContent = group.steps[0].name;
        root.append(pin, label);

        add(new lib.AdvancedMarkerElement({ map, position: group, content: root, zIndex: selected ? 40 : 30 }));
        state.labels.push({ id: group.key, owner: group.key, point: group, dx: 0, dy: 0, text: group.steps[0].name, size: 16, gap: half + PIN_LABEL_GAP - PIN_RADIUS + 2, el: label, item: false });
        state.obstacles.push({ owner: group.key, kind: 'pin', point: group, dx: 0, dy: 0, r: half + 2 });
      }

      // Les noms d'étapes passent avant ceux des lieux : on les remet en tête.
      state.labels.sort((a, b) => Number(a.item) - Number(b.item));
    }

    for (const label of state.labels) label.enabled = !label.item || showItemLabels;
    layoutLabels(state);
  }, [status, groups, items, arcs, filters, selectedStepId, showItemLabels]);

  // Les marqueurs appartiennent à la carte, pas à React : on les retire quand
  // le composant disparaît, faute de quoi ils survivraient à la navigation.
  useEffect(
    () => () => {
      const state = google.current;
      if (!state) return;
      for (const overlay of state.overlays) remove(overlay);
      state.projector.setMap(null);
      google.current = null;
    },
    [],
  );

  const overview = () => {
    if (google.current) fitTrip(google.current, groups, items);
  };

  const message = STATUS_MESSAGE[status];

  return (
    <div className="map">
      <div className="map__frame" ref={frameRef}>
        <div ref={canvasRef} className="map__canvas" role="region" aria-label={`Carte du voyage ${trip.title}`} />

        {message && <p className="map__status">{message}</p>}

        {status === 'ready' && (
          <div className="map__zoom">
            <button type="button" onClick={overview} aria-label="Vue d'ensemble" title="Vue d'ensemble">
              ⟲
            </button>
          </div>
        )}

        {status === 'ready' && items.length > 0 && !showItemLabels && (
          <p className="map__hint">zoome pour voir les noms des lieux</p>
        )}
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

// Cadre le voyage entier : les villes, ou à défaut les lieux localisés. Sans
// rien de situé, le monde entier — un voyage vide ne se passe nulle part.
function fitTrip(state, groups, items) {
  const { lib, map } = state;
  const points = groups.length ? groups : items.filter((item) => item.kind === 'geo');
  if (points.length === 0) {
    map.setCenter({ lat: 20, lng: 0 });
    map.setZoom(2);
    return;
  }
  if (points.length === 1) {
    map.setCenter(points[0]);
    map.setZoom(11);
    return;
  }
  const bounds = new lib.LatLngBounds();
  for (const point of points) bounds.extend(point);
  map.fitBounds(bounds, FIT_PADDING);
}

// Qui a droit à son nom, à ce zoom-ci. Recalculé à chaque arrêt de la carte
// (`idle`) : un déplacement ne change rien, un zoom écarte ou rapproche.
function layoutLabels(state) {
  const projection = state.projector.getProjection();
  if (!projection) return;

  const pixel = ({ point, dx, dy }) => {
    const at = projection.fromLatLngToContainerPixel(new state.lib.LatLng(point.lat, point.lng));
    return { x: at.x + dx, y: at.y + dy };
  };

  const candidates = state.labels
    .filter((label) => label.enabled)
    .map((label) => ({
      ...pixel(label),
      id: label.id,
      owner: label.owner,
      text: label.text,
      size: label.size,
      gap: label.gap,
      // Un nom d'étape n'évite que les autres épingles, comme sur la carte
      // SVG : il passe par-dessus les pastilles des lieux, qu'il ne masque pas.
      against: label.item ? 'all' : 'pin',
    }));
  const obstacles = state.obstacles.map((obstacle) => {
    const { x, y } = pixel(obstacle);
    return { owner: obstacle.owner, kind: obstacle.kind, x1: x - obstacle.r, x2: x + obstacle.r, y1: y - obstacle.r, y2: y + obstacle.r };
  });

  // Chaque nom est posé du côté retenu, en pixels depuis son point.
  const placed = placeLabels(candidates, obstacles);
  for (const label of state.labels) {
    const side = placed.get(label.id);
    label.el.hidden = !side;
    if (!side) continue;
    label.el.style.left = `${label.dx + (side === 'right' ? label.gap : -label.gap)}px`;
    label.el.style.top = `${label.dy}px`;
    label.el.dataset.side = side;
  }
}
