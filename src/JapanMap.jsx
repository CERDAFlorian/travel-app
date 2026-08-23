import { useEffect, useMemo, useRef, useState } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import topo from 'world-atlas/countries-110m.json';

const BBOX = { type: 'MultiPoint', coordinates: [[130.0, 32.0], [142.6, 38.8]] };
const W = 620, H = 420;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const LAND = feature(topo, topo.objects.countries).features.filter(
  (f) => (f.properties && f.properties.name) === 'Japan' || String(f.id) === '392'
);

// Libellé de carte, cerné d'un liseré couleur fond pour rester lisible sur la terre.
function Label({ text, x, y, anchor, fill, size = 19, weight = 600 }) {
  return (
    <text
      x={x} y={y} textAnchor={anchor || 'start'} fontFamily="'EB Garamond', Georgia, serif"
      fontSize={size} fontWeight={weight} fill={fill} stroke="#f8ecd9" strokeWidth={4.5}
      paintOrder="stroke" style={{ pointerEvents: 'none' }}
    >{text}</text>
  );
}

export default function JapanMap({
  pins = [], points = [], legs = [], cats = {}, hidden = {},
  selected, selectedPoint, onSelect, onPoint
}) {
  const red = '#8f1d24';
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);
  const drag = useRef(null);
  const ptrs = useRef(new Map());
  const pinch = useRef(null);

  const proj = useMemo(() => geoMercator().fitExtent([[14, 14], [W - 14, H - 14]], BBOX), []);
  const paths = useMemo(() => LAND.map((f) => geoPath(proj)(f)), [proj]);

  const fit = (v) => ({ k: v.k, x: clamp(v.x, W - W * v.k, 0), y: clamp(v.y, H - H * v.k, 0) });
  const toSvg = (cx, cy) => {
    const r = svgRef.current.getBoundingClientRect();
    return [(cx - r.left) * (W / r.width), (cy - r.top) * (H / r.height)];
  };
  const zoomAt = (f, cx, cy) =>
    setView((v) => {
      const k = clamp(v.k * f, 1, 9);
      return fit({ k, x: cx - (cx - v.x) * (k / v.k), y: cy - (cy - v.y) * (k / v.k) });
    });

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const p = toSvg(e.clientX, e.clientY);
      zoomAt(e.deltaY < 0 ? 1.16 : 1 / 1.16, p[0], p[1]);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // centre sur l'étape sélectionnée quand on est zoomé
  useEffect(() => {
    if (view.k < 1.05) return;
    const p = pins.find((pi) => (pi.ids || []).indexOf(selected) >= 0);
    if (!p) return;
    const xy = proj([p.lon, p.lat]);
    const bx = xy[0] + (p.ox || 0), by = xy[1] + (p.oy || 0);
    setView((v) => fit({ k: v.k, x: W / 2 - bx * v.k, y: H / 2 - by * v.k }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const B = {};
  pins.forEach((p) => {
    const xy = proj([p.lon, p.lat]);
    B[p.key] = { x: xy[0] + (p.ox || 0), y: xy[1] + (p.oy || 0) };
  });

  // positions de base des lieux : coordonnées réelles, sinon petite couronne autour de la ville
  const ring = {};
  const PB = {};
  points.forEach((p) => {
    if (p.lon != null) {
      const xy = proj([p.lon, p.lat]);
      PB[p.id] = { x: xy[0] + (p.ox || 0), y: xy[1] + (p.oy || 0), geo: true };
      return;
    }
    const base = B[p.pin];
    if (!base) return;
    const i = (ring[p.pin] = ring[p.pin] === undefined ? 0 : ring[p.pin] + 1);
    const a = ((-104 + i * 43) * Math.PI) / 180, r = 19 + (i % 3) * 7;
    PB[p.id] = { x: base.x + r * Math.cos(a), y: base.y + r * Math.sin(a), geo: false };
  });

  const k = view.k, tx = view.x, ty = view.y;
  const S = (pt) => ({ x: pt.x * k + tx, y: pt.y * k + ty });
  const arc = (a, b, bow) => {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y;
    return `M ${a.x} ${a.y} Q ${mx - dy * bow} ${my + dx * bow} ${b.x} ${b.y}`;
  };

  // placement automatique des libellés : on essaie plusieurs positions et on garde
  // la première qui ne recouvre ni une pastille ni un libellé déjà posé
  const measure = (t, size) => String(t).length * size * 0.47;
  const boxOf = (cx, cy, a, w, size) => {
    const x1 = a === 'end' ? cx - w : a === 'middle' ? cx - w / 2 : cx;
    return { x1, x2: x1 + w, y1: cy - size * 0.82, y2: cy + size * 0.26 };
  };
  const hits = (b, obs) => obs.some((o) => b.x1 < o.x2 && b.x2 > o.x1 && b.y1 < o.y2 && b.y2 > o.y1);
  const area = (a, b) =>
    Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1)) * Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  const place = (cx, cy, rr, text, size, prefer, hard, soft) => {
    const w = measure(text, size);
    const cands = [];
    if (prefer && prefer.dx != null) cands.push(prefer);
    cands.push(
      { dx: rr + 8, dy: 6, a: 'start' }, { dx: -(rr + 8), dy: 6, a: 'end' },
      { dx: 0, dy: -(rr + 10), a: 'middle' }, { dx: 0, dy: rr + 22, a: 'middle' },
      { dx: rr + 8, dy: -(rr + 4), a: 'start' }, { dx: -(rr + 8), dy: rr + 18, a: 'end' },
      { dx: rr + 8, dy: rr + 18, a: 'start' }, { dx: -(rr + 8), dy: -(rr + 4), a: 'end' }
    );
    let best = null;
    for (let i = 0; i < cands.length; i++) {
      const cd = cands[i], box = boxOf(cx + cd.dx, cy + cd.dy, cd.a || 'start', w, size);
      if (hits(box, hard)) continue;
      const cost = (soft || []).reduce((t, o) => t + area(box, o), 0);
      if (!best || cost < best.cost) best = { x: cx + cd.dx, y: cy + cd.dy, a: cd.a || 'start', box, cost };
      if (cost === 0) break;
    }
    if (best) return best;
    const cd = cands[cands.length - 1];
    return { x: cx + cd.dx, y: cy + cd.dy, a: cd.a, box: boxOf(cx + cd.dx, cy + cd.dy, cd.a, w, size) };
  };

  const obstacles = [];
  const pinGeom = {};
  pins.forEach((p) => {
    if (!B[p.key]) return;
    const c = S(B[p.key]);
    const rr = (p.ids || []).indexOf(selected) >= 0 ? 25 : 17;
    pinGeom[p.key] = { c, rr };
    obstacles.push({ x1: c.x - rr - 3, x2: c.x + rr + 3, y1: c.y - rr - 3, y2: c.y + rr + 3 });
  });
  const softObs = [];
  points.forEach((p) => {
    if (hidden[p.cat] || !PB[p.id]) return;
    const q = S(PB[p.id]);
    const box = { x1: q.x - 8, x2: q.x + 8, y1: q.y - 8, y2: q.y + 8 };
    if (p.lon != null) obstacles.push(box); else softObs.push(box);
  });
  const pinLabel = {};
  pins.forEach((p) => {
    const g = pinGeom[p.key];
    if (!g) return;
    const pos = place(g.c.x, g.c.y, g.rr, p.name, 20,
      { dx: p.lx, dy: p.ly == null ? 6 : p.ly, a: p.anchor || 'start' }, obstacles, softObs);
    pinLabel[p.key] = pos;
    obstacles.push(pos.box);
  });

  const onPointerDown = (e) => {
    ptrs.current.set(e.pointerId, [e.clientX, e.clientY]);
    e.currentTarget.setPointerCapture(e.pointerId);
    if (ptrs.current.size === 1) drag.current = { x: e.clientX, y: e.clientY, v: view, moved: 0 };
    if (ptrs.current.size === 2) {
      const p = [...ptrs.current.values()];
      pinch.current = { d: Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]) };
      drag.current = null;
    }
  };
  const onPointerMove = (e) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.current.size === 2 && pinch.current) {
      const p = [...ptrs.current.values()];
      const d = Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]);
      const c = toSvg((p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2);
      if (pinch.current.d > 0) zoomAt(d / pinch.current.d, c[0], c[1]);
      pinch.current.d = d;
      return;
    }
    if (!drag.current) return;
    const r = svgRef.current.getBoundingClientRect(), s = W / r.width;
    const dx = (e.clientX - drag.current.x) * s, dy = (e.clientY - drag.current.y) * s;
    drag.current.moved = Math.max(drag.current.moved, Math.abs(dx) + Math.abs(dy));
    setView(fit({ k: drag.current.v.k, x: drag.current.v.x + dx, y: drag.current.v.y + dy }));
  };
  const onPointerUp = (e) => {
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size < 2) pinch.current = null;
    if (ptrs.current.size === 0) setTimeout(() => { drag.current = null; }, 0);
  };
  const moved = () => drag.current && drag.current.moved > 6;

  const btnStyle = {
    width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', background: '#fdf6e9', border: '1.5px solid #d9bd8c', borderRadius: 8,
    color: '#8f1d24', fontSize: 16, fontFamily: "'EB Garamond', Georgia, serif",
    userSelect: 'none', boxShadow: '0 1px 2px rgba(120,90,40,.12)'
  };

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={svgRef} viewBox={`0 0 ${W} ${H}`}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', cursor: 'grab' }}
      >
        <defs>
          <clipPath id="mapclip"><rect x={0} y={0} width={W} height={H} rx={10} /></clipPath>
          <radialGradient id="sea" cx="50%" cy="45%" r="70%">
            <stop offset="0%" stopColor="#fbf3e3" />
            <stop offset="100%" stopColor="#f3e5cd" />
          </radialGradient>
        </defs>
        <rect x={0} y={0} width={W} height={H} fill="url(#sea)" rx={10} />
        <g clipPath="url(#mapclip)">
          <g transform={`translate(${tx},${ty}) scale(${k})`}>
            <g>
              {paths.map((d, i) => (
                <path key={'p' + i} d={d} fill="#dfdcbc" stroke="#b6a476" strokeWidth={0.9} vectorEffect="non-scaling-stroke" />
              ))}
            </g>
            <g fill="none" stroke={red} strokeWidth={2} strokeDasharray="7 6" opacity={0.6} strokeLinecap="round">
              {legs.map((lg, i) =>
                B[lg.from] && B[lg.to]
                  ? <path key={'g' + i} d={arc(B[lg.from], B[lg.to], lg.bow || 0)} vectorEffect="non-scaling-stroke" />
                  : null
              )}
            </g>
            <g>
              {points.map((p) => {
                const c = cats[p.cat], b = B[p.pin], m = PB[p.id];
                if (!c || !b || !m || hidden[p.cat]) return null;
                return (
                  <line key={'c' + p.id} x1={b.x} y1={b.y} x2={m.x} y2={m.y}
                    stroke={c.color} strokeWidth={1.1} strokeDasharray="3 4" opacity={0.55} vectorEffect="non-scaling-stroke" />
                );
              })}
            </g>
          </g>
          <g>
            {points.map((p) => {
              const c = cats[p.cat], m = PB[p.id];
              if (!c || !m || hidden[p.cat]) return null;
              const s = S(m);
              const on = selectedPoint === p.id || hover === p.id;
              const r = on ? 7.5 : k >= 1.6 ? 6 : 4.6;
              let lab = null;
              if (on || k >= 2.1) {
                const q = place(s.x, s.y, r + 2, p.name, 16, null, obstacles, softObs);
                obstacles.push(q.box);
                lab = <Label text={p.name} x={q.x} y={q.y} anchor={q.a} fill={c.color} size={16} weight={on ? 700 : 600} />;
              }
              return (
                <g key={p.id} style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)}
                  onClick={() => { if (!moved() && onPoint) onPoint(p); }}
                >
                  {m.geo || p.lon != null
                    ? <rect x={s.x - r} y={s.y - r} width={r * 2} height={r * 2}
                        transform={`rotate(45 ${s.x} ${s.y})`} fill={on ? c.color : '#fbf3e3'} stroke={c.color} strokeWidth={2.2} />
                    : <circle cx={s.x} cy={s.y} r={r} fill={on ? c.color : '#fbf3e3'} stroke={c.color} strokeWidth={2.2} />}
                  {lab}
                </g>
              );
            })}
          </g>
          <g>
            {pins.map((p) => {
              if (!B[p.key]) return null;
              const c = S(B[p.key]);
              const on = (p.ids || []).indexOf(selected) >= 0 || hover === p.key;
              const r = on ? 18 : 14;
              return (
                <g key={p.key} style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHover(p.key)} onMouseLeave={() => setHover(null)}
                  onClick={() => { if (!moved() && onSelect) onSelect(p); }}
                >
                  {on ? <circle cx={c.x} cy={c.y} r={r + 7} fill="none" stroke={red} strokeWidth={1.6} opacity={0.45} /> : null}
                  <circle cx={c.x} cy={c.y} r={r} fill={red} stroke="#f8ecd9" strokeWidth={2.5} />
                  <text x={c.x} y={c.y + 6} textAnchor="middle" fontFamily="'EB Garamond', Georgia, serif"
                    fontSize={p.badge.length > 2 ? 14 : 17} fontWeight={700} fill="#fdf6e8" style={{ pointerEvents: 'none' }}>
                    {p.badge}
                  </text>
                  {pinLabel[p.key]
                    ? <Label text={p.name} x={pinLabel[p.key].x} y={pinLabel[p.key].y}
                        anchor={pinLabel[p.key].a} fill="#5c1b1b" size={20} weight={on ? 700 : 600} />
                    : null}
                </g>
              );
            })}
          </g>
        </g>
      </svg>
      <div style={{ position: 'absolute', right: 9, top: 9, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={btnStyle} title="Zoomer" onClick={() => zoomAt(1.4, W / 2, H / 2)}>+</div>
        <div style={btnStyle} title="Dézoomer" onClick={() => zoomAt(1 / 1.4, W / 2, H / 2)}>−</div>
        <div style={btnStyle} title="Vue d'ensemble" onClick={() => setView({ k: 1, x: 0, y: 0 })}>⟲</div>
      </div>
      <div style={{
        position: 'absolute', left: 11, bottom: 9, fontSize: 11.5, letterSpacing: '.06em',
        textTransform: 'uppercase', color: '#a08a63', pointerEvents: 'none'
      }}>
        {k > 1.02 ? 'zoom ×' + k.toFixed(1) + ' · glissez pour déplacer' : 'molette ou + pour zoomer'}
      </div>
    </div>
  );
}
