import { useEffect, useMemo, useRef, useState } from 'react';
import Header from './components/Header.jsx';
import Flights from './components/Flights.jsx';
import StepCard from './components/StepCard.jsx';
import MapPanel from './components/MapPanel.jsx';
import Experiences from './components/Experiences.jsx';
import Budget from './components/Budget.jsx';
import { CATS, CAT_KEYS, CITIES, STORAGE_KEY, seedFlights, seedItems, seedSteps } from './data.js';
import {
  dayAt, eur, featured, fmt, geocode, imgFor, isApplePlatform, legTime,
  mapLink, num, photoSearchUrl, uid
} from './helpers.js';
import { button, hint, PAGE_X } from './ui.js';

function initialState() {
  const base = {
    sel: 's1', pt: null, open: { 's1|hotel': true }, travelers: 2,
    steps: seedSteps(), items: seedItems(), flights: seedFlights(), hidden: {}, geoBusy: null
  };
  try {
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (d) ['items', 'flights', 'hidden', 'steps', 'travelers'].forEach((k) => { if (d[k]) base[k] = d[k]; });
  } catch { /* rien de sauvegardé : on garde l'itinéraire d'origine */ }
  return base;
}

export default function App({ showTravelTimes = true, showExperiences = true }) {
  const [state, setState] = useState(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const [newCity, setNewCity] = useState('');
  const [newNights, setNewNights] = useState(2);

  useEffect(() => {
    try {
      const { items, flights, hidden, steps, travelers } = state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, flights, hidden, steps, travelers }));
    } catch { /* stockage indisponible : les modifications restent en mémoire */ }
  }, [state.items, state.flights, state.hidden, state.steps, state.travelers]);

  // ---------- mutations ----------
  const select = (id) => setState((s) => ({ ...s, sel: id }));
  const toggleSection = (k) => setState((s) => ({ ...s, open: { ...s.open, [k]: !s.open[k] } }));
  const toggleCat = (c) => setState((s) => ({ ...s, hidden: { ...s.hidden, [c]: !s.hidden[c] } }));

  const patchItem = (stepId, id, patch) =>
    setState((s) => ({
      ...s,
      items: { ...s.items, [stepId]: (s.items[stepId] || []).map((i) => (i.id === id ? { ...i, ...patch } : i)) }
    }));

  // géocodage automatique : nom du lieu + ville → coordonnées réelles (OpenStreetMap)
  const locate = async (stepId, id, known) => {
    const st = stateRef.current;
    const it = (st.items[stepId] || []).find((x) => x.id === id) || known;
    if (!it) return false;
    const step = st.steps.find((s) => s.id === stepId);
    const c = step && CITIES[step.city];
    const city = c ? c.short || c.name : '';
    patchItem(stepId, id, { geoState: 'pending' });
    try {
      const hit = await geocode(it.name, city);
      if (hit) {
        patchItem(stepId, id, { ...hit, ox: 0, oy: 0, geoState: 'ok' });
        return true;
      }
    } catch { /* réseau indisponible : on le signale sur la ligne */ }
    patchItem(stepId, id, { geoState: 'fail' });
    return false;
  };

  const locateAll = async () => {
    if (stateRef.current.geoBusy) return;
    const todo = [];
    stateRef.current.steps.forEach((s) =>
      (stateRef.current.items[s.id] || []).forEach((it) => {
        if (it.lon == null && CATS[it.cat] && CATS[it.cat].map) todo.push([s.id, it.id]);
      })
    );
    if (!todo.length) return;
    for (let i = 0; i < todo.length; i++) {
      setState((s) => ({ ...s, geoBusy: { done: i, total: todo.length } }));
      await locate(todo[i][0], todo[i][1]);
      await new Promise((r) => setTimeout(r, 1150));
    }
    setState((s) => ({ ...s, geoBusy: null }));
  };

  const addItem = (stepId, cat, name, price) => {
    const v = (name || '').trim();
    if (!v) return;
    const id = uid(cat);
    setState((s) => ({
      ...s,
      items: { ...s.items, [stepId]: (s.items[stepId] || []).concat([{ id, cat, name: v, meta: '', price: (price || '').trim() }]) }
    }));
    if (CATS[cat] && CATS[cat].map) locate(stepId, id, { id, cat, name: v });
  };

  const delItem = (stepId, id) =>
    setState((s) => ({
      ...s,
      items: { ...s.items, [stepId]: (s.items[stepId] || []).filter((i) => i.id !== id) },
      pt: s.pt === id ? null : s.pt
    }));

  const setItemPrice = (stepId, id, v) => patchItem(stepId, id, { price: v.trim() });

  const toggleStar = (stepId, id) =>
    setState((s) => {
      const list = s.items[stepId] || [];
      const target = list.find((i) => i.id === id);
      if (!target) return s;
      const on = !target.star;
      const starred = list.filter((i) => i.star && i.id !== id);
      const drop = on && starred.length >= 3 ? starred[0].id : null;
      return {
        ...s,
        items: {
          ...s.items,
          [stepId]: list.map((i) =>
            i.id === id ? { ...i, star: on } : i.id === drop ? { ...i, star: false } : i
          )
        }
      };
    });

  const addCity = () => {
    if (!newCity) return;
    const nights = Math.max(1, parseInt(newNights, 10) || 1);
    const id = uid('s');
    setState((s) => ({
      ...s,
      steps: s.steps.concat([{ id, city: newCity, nights }]),
      items: { ...s.items, [id]: [] },
      sel: id
    }));
    setNewCity('');
  };

  const resetAll = () => {
    if (!window.confirm("Revenir à l'itinéraire d'origine ? Vos ajouts et vos prix seront perdus.")) return;
    setState((s) => ({
      ...s, steps: seedSteps(), items: seedItems(), flights: seedFlights(), sel: 's1', pt: null
    }));
  };

  const delCity = (id, label) => {
    if (!window.confirm('Retirer « ' + label + " » de l'itinéraire ? Sa liste de lieux sera supprimée.")) return;
    setState((s) => {
      const steps = s.steps.filter((x) => x.id !== id);
      const items = { ...s.items };
      delete items[id];
      return { ...s, steps, items, sel: s.sel === id ? (steps[0] ? steps[0].id : null) : s.sel };
    });
  };

  const moveCity = (id, dir) =>
    setState((s) => {
      const steps = s.steps.slice();
      const i = steps.findIndex((x) => x.id === id), j = i + dir;
      if (i < 0 || j < 0 || j >= steps.length) return s;
      [steps[i], steps[j]] = [steps[j], steps[i]];
      return { ...s, steps };
    });

  const setNights = (id, d) =>
    setState((s) => ({
      ...s,
      steps: s.steps.map((x) => (x.id === id ? { ...x, nights: Math.max(1, x.nights + d) } : x))
    }));

  const addFlight = (f) => {
    const route = f.route.trim();
    if (!route) return false;
    const entry = {
      id: uid('fl'), label: 'Vol', route,
      date: f.date.trim() || 'date à préciser',
      flight: f.flight.trim() || 'vol à confirmer',
      price: f.price.trim()
    };
    setState((s) => ({ ...s, flights: s.flights.concat([entry]) }));
    return true;
  };
  const delFlight = (id) => setState((s) => ({ ...s, flights: s.flights.filter((f) => f.id !== id) }));
  const setFlightPrice = (id, v) =>
    setState((s) => ({ ...s, flights: s.flights.map((f) => (f.id === id ? { ...f, price: v.trim() } : f)) }));

  const setTravelers = (v) =>
    setState((s) => ({ ...s, travelers: Math.max(1, parseInt(v, 10) || 1) }));

  // ---------- valeurs dérivées ----------
  const ios = useMemo(isApplePlatform, []);
  const mapLabel = ios ? 'Plan ↗' : 'Maps ↗';
  const { items, hidden } = state;

  // étapes enrichies : dates d'arrivée / de départ calculées de proche en proche
  let off = 0;
  const rows = state.steps.map((s, i) => {
    const c = CITIES[s.city] || { name: s.city, lon: null, lat: null };
    const arrive = dayAt(off), leave = dayAt(off + s.nights);
    off += s.nights;
    return { raw: s, i, city: s.city, c, arrive, leave, next: state.steps[i + 1] ? state.steps[i + 1].city : null };
  });
  const nightsTotal = state.steps.reduce((a, s) => a + s.nights, 0);
  const endDate = dayAt(nightsTotal);

  // points carte + budget
  const points = [];
  const totals = {};
  CAT_KEYS.forEach((k) => { totals[k] = { sum: 0, n: 0, blank: 0 }; });
  rows.forEach((r) =>
    (items[r.raw.id] || []).forEach((it) => {
      points.push({
        id: it.id, pin: r.city, cat: it.cat, name: it.name,
        lon: it.lon, lat: it.lat, ox: it.ox, oy: it.oy, step: r.raw.id
      });
      const t = totals[it.cat];
      if (!t) return;
      t.n++;
      const v = num(it.price);
      t.sum += v;
      if (!v) t.blank++;
    })
  );
  const budgetKeys = CAT_KEYS.filter((k) => CATS[k].budget);
  const flightsSum = state.flights.reduce((a, f) => a + num(f.price), 0);
  const grand = flightsSum + budgetKeys.reduce((a, k) => a + totals[k].sum, 0);
  const trav = Math.max(1, parseInt(state.travelers, 10) || 1);
  const blanks = state.flights.filter((f) => !num(f.price)).length
    + budgetKeys.reduce((a, k) => a + totals[k].blank, 0);

  // pins (regroupés par ville) + segments de route
  const pinMap = {};
  rows.forEach((r) => {
    if (r.c.lon == null) return;
    if (!pinMap[r.city]) pinMap[r.city] = { ...r.c, key: r.city, name: r.c.short || r.c.name, ids: [], nums: [] };
    pinMap[r.city].ids.push(r.raw.id);
    pinMap[r.city].nums.push(r.i + 1);
  });
  const pins = Object.keys(pinMap).map((k) => {
    const p = pinMap[k];
    return {
      key: k, name: p.name, lon: p.lon, lat: p.lat, ox: p.ox, oy: p.oy,
      lx: p.lx, ly: p.ly, anchor: p.anchor, ids: p.ids, badge: p.nums.join('·')
    };
  });

  const legs = [], legsList = [];
  rows.forEach((r, i) => {
    if (!r.next || r.next === r.city) return;
    legs.push({ from: r.city, to: r.next, bow: (i % 2 ? -1 : 1) * (0.1 + (i % 3) * 0.03) });
    const nextCity = CITIES[r.next] || {};
    legsList.push({
      label: (r.c.short || r.c.name) + ' → ' + (nextCity.short || nextCity.name || r.next),
      time: legTime(r.city, r.next)
    });
  });

  const budgetRows = [{
    key: 'vols', label: 'Vols', color: '#8f1d24', sum: flightsSum,
    n: state.flights.length, blank: state.flights.filter((f) => !num(f.price)).length
  }].concat(
    budgetKeys.map((k) => ({
      key: k, label: CATS[k].label, color: CATS[k].color,
      sum: totals[k].sum, n: totals[k].n, blank: totals[k].blank
    }))
  );

  const steps = rows.map((r) => {
    const s = r.raw, list = items[s.id] || [];
    const sameMonth = r.arrive.getMonth() === r.leave.getMonth();
    const used = {};
    const photos = featured(list, CATS).map((it, ti) => {
      let src = it.thumb || imgFor(it.name);
      if (src && used[src]) src = null;
      else if (src) used[src] = 1;
      return {
        cap: it.name, name: it.name, src,
        slotId: 'slot-' + s.id + '-' + ti,
        searchUrl: photoSearchUrl(it.name, r.c.short || r.c.name)
      };
    });
    return {
      id: s.id,
      n: r.i + 1, name: r.c.name, short: r.c.short || r.c.name,
      dates: sameMonth ? r.arrive.getDate() + ' – ' + fmt(r.leave) : fmt(r.arrive) + ' – ' + fmt(r.leave),
      nightsLabel: s.nights + (s.nights > 1 ? ' nuits' : ' nuit'),
      photos,
      ring: state.sel === s.id ? '#8f1d24' : '#e0caa2',
      shadow: state.sel === s.id ? '0 6px 20px rgba(143,29,36,.16)' : '0 1px 2px rgba(120,90,40,.07)',
      travelShow: !!r.next && showTravelTimes,
      travelKind: r.next ? 'vers ' + ((CITIES[r.next] || {}).short || (CITIES[r.next] || {}).name || r.next) : '',
      travelText: r.next ? legTime(r.city, r.next) : '',
      select: () => select(s.id),
      remove: (e) => { e.stopPropagation(); delCity(s.id, r.c.short || r.c.name); },
      up: (e) => { e.stopPropagation(); moveCity(s.id, -1); },
      down: (e) => { e.stopPropagation(); moveCity(s.id, 1); },
      less: (e) => { e.stopPropagation(); setNights(s.id, -1); },
      more: (e) => { e.stopPropagation(); setNights(s.id, 1); },
      sections: CAT_KEYS.map((c) => {
        const key = s.id + '|' + c, open = !!state.open[key];
        const li = list.filter((i) => i.cat === c);
        const sum = li.reduce((a, i) => a + num(i.price), 0);
        return {
          key, label: CATS[c].label, color: CATS[c].color,
          count: li.length ? '(' + li.length + ')' : '—',
          total: CATS[c].budget && sum ? eur(sum) : '',
          open, caret: open ? '▾' : '▸',
          placeholder: CATS[c].ph, priceOn: CATS[c].budget,
          toggle: (e) => { e.stopPropagation(); toggleSection(key); },
          add: (name, price) => addItem(s.id, c, name, price),
          items: li.map((it) => ({
            id: it.id, name: it.name, meta: it.meta || '', color: CATS[c].color, price: it.price || '',
            thumb: it.thumb || null,
            hasMap: !!CATS[c].map, mapUrl: mapLink(it.name, r.c.short || r.c.name),
            priceShow: CATS[c].budget,
            starShow: CATS[c].map,
            starIcon: it.star ? '★' : '☆',
            starColor: it.star ? '#c08a2e' : '#cbb691',
            star: (e) => { e.stopPropagation(); toggleStar(s.id, it.id); },
            locateShow: CATS[c].map && it.lon == null,
            locateLabel: it.geoState === 'pending' ? 'recherche…' : it.geoState === 'fail' ? 'non trouvé' : 'Localiser',
            locate: (e) => { e.stopPropagation(); locate(s.id, it.id); },
            selected: state.pt === it.id,
            pick: (e) => {
              e.stopPropagation();
              setState((st) => ({ ...st, sel: s.id, pt: st.pt === it.id ? null : it.id }));
            },
            del: (e) => { e.stopPropagation(); delItem(s.id, it.id); },
            setPrice: (e) => setItemPrice(s.id, it.id, e.target.value)
          }))
        };
      })
    };
  });

  const segments = rows.map((r) => ({
    id: r.raw.id,
    label: (r.c.short || r.c.name).split(' ')[0] + ' · ' + r.raw.nights + 'n',
    grow: r.raw.nights + 2.5, title: r.c.name,
    bg: state.sel === r.raw.id ? '#8f1d24' : '#efe0c4',
    fg: state.sel === r.raw.id ? '#fdf1dc' : '#6b4a2c',
    select: () => select(r.raw.id)
  }));

  const legend = CAT_KEYS.map((c) => ({
    key: c, label: CATS[c].label, dot: CATS[c].color,
    border: hidden[c] ? '#d8bd8e' : CATS[c].color,
    fg: hidden[c] ? '#a08050' : CATS[c].color,
    bg: hidden[c] ? '#f3e8d3' : '#fdf6e9',
    op: hidden[c] ? 0.5 : 1,
    toggle: () => toggleCat(c)
  }));

  const routeLine = rows.map((r) => r.c.short || r.c.name).join(' → ');

  return (
    <div style={{ minHeight: '100vh', background: '#f8ecd9' }}>
      <Header
        dateRange={'Du ' + fmt(dayAt(0)) + ' au ' + fmt(endDate) + ' ' + endDate.getFullYear()}
        stepCount={state.steps.length} nightsTotal={nightsTotal} totalPlaces={points.length}
        segments={segments}
      />

      <Flights
        flights={state.flights} flightsTotal={eur(flightsSum)}
        onAdd={addFlight} onDelete={delFlight} onPrice={setFlightPrice}
      />

      <main style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 430px), 1fr))',
        gap: 'clamp(16px, 2vw, 28px)',
        padding: `clamp(14px, 2vw, 26px) ${PAGE_X} clamp(20px, 2.4vw, 32px)`
      }}>
        <section style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(10px, 1.2vw, 15px)', minWidth: 0 }}>
          {steps.map((s) => <StepCard key={s.id} s={s} mapLabel={mapLabel} />)}

          <div style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
            padding: 'clamp(10px, 1.1vw, 14px)', border: '1px dashed #d0b177',
            borderRadius: 14, background: '#fbf3e3'
          }}>
            <span style={{
              fontSize: 'clamp(11px, 1.1vw, 13px)', letterSpacing: '.1em',
              textTransform: 'uppercase', color: '#a08050'
            }}>Ajouter une ville</span>
            <select
              value={newCity} onChange={(e) => setNewCity(e.target.value)}
              style={{
                flex: 1, minWidth: 150, padding: '4px 8px', border: '1px solid #ddc59b',
                borderRadius: 7, background: '#fffdf7', fontSize: 'clamp(12.5px, 1.25vw, 15px)'
              }}
            >
              <option value="">Choisir une étape…</option>
              {Object.keys(CITIES).map((k) => <option key={k} value={k}>{CITIES[k].name}</option>)}
            </select>
            <input
              type="number" min="1" max="30" value={newNights} title="Nombre de nuits"
              onChange={(e) => setNewNights(e.target.value)}
              style={{
                width: 66, padding: '4px 8px', border: '1px solid #ddc59b', borderRadius: 7,
                background: '#fffdf7', fontSize: 'clamp(12.5px, 1.25vw, 15px)'
              }}
            />
            <span onClick={addCity} style={button}>+ Ajouter l'étape</span>
            <span style={{ ...hint, flexBasis: '100%', display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 10 }}>
              L'étape s'ajoute à la fin ; utilisez ▲ ▼ pour la replacer. Dates, nuits et temps de trajet se recalculent tout seuls.
              <span onClick={resetAll} title="Revenir à l'itinéraire d'origine" style={{
                marginLeft: 'auto', cursor: 'pointer', fontStyle: 'normal', letterSpacing: '.06em',
                textTransform: 'uppercase', fontSize: 'clamp(10.5px, 1.05vw, 12.5px)',
                border: '1px solid #cbb691', borderRadius: 999, padding: '2px 10px',
                color: '#8f1d24', whiteSpace: 'nowrap'
              }}>Réinitialiser l'itinéraire</span>
            </span>
          </div>
        </section>

        <MapPanel
          pins={pins} points={points} cats={CATS} hidden={hidden} legs={legs}
          selected={state.sel} selectedPoint={state.pt}
          onPin={(p) => select(p.ids.indexOf(state.sel) === 0 && p.ids.length > 1 ? p.ids[1] : p.ids[0])}
          onPoint={(p) => setState((s) => ({
            ...s, sel: p.step, pt: s.pt === p.id ? null : p.id,
            open: { ...s.open, [p.step + '|' + p.cat]: true }
          }))}
          legend={legend}
          geoLabel={state.geoBusy ? 'Localisation ' + (state.geoBusy.done + 1) + '/' + state.geoBusy.total + '…' : 'Localiser les lieux'}
          onLocateAll={locateAll}
          showTravelTimes={showTravelTimes} legsList={legsList}
        />
      </main>

      <section style={{
        position: 'relative', margin: `0 ${PAGE_X} clamp(18px, 2.2vw, 28px)`,
        borderRadius: 16, overflow: 'hidden', border: '1.5px solid #e0caa2'
      }}>
        {/* objectPosition: la photo n'occupe que le haut du PNG ; sans cela, un écran
            large recadre sur la zone transparente et la bannière apparaît vide. */}
        <img src="/img/hero-pagode.png" alt="" style={{
          width: '100%', height: 'clamp(120px, 15vw, 210px)', objectFit: 'cover',
          objectPosition: 'top', display: 'block'
        }} />
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          justifyContent: 'flex-end', padding: 'clamp(12px, 1.6vw, 22px)',
          background: 'linear-gradient(90deg, rgba(40,20,10,.55) 0%, rgba(40,20,10,.15) 55%, transparent 100%)'
        }}>
          <div style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(17px, 2.2vw, 30px)', color: '#fdf1dc'
          }}>Des instants précieux, des souvenirs impérissables</div>
          <div style={{ fontSize: 'clamp(12.5px, 1.35vw, 17px)', fontStyle: 'italic', color: '#f6dcb8' }}>
            {nightsTotal} nuits, {state.steps.length} étapes, un itinéraire qui vous ressemble
          </div>
        </div>
      </section>

      {showExperiences && <Experiences />}

      <Budget
        rows={budgetRows.map((b) => ({
          key: b.key, label: b.label, color: b.color, amount: eur(b.sum), grow: b.sum,
          note: b.n ? (b.blank ? b.n + ' lignes · ' + b.blank + ' sans prix' : b.n + ' lignes') : 'vide',
          title: b.label + ' : ' + eur(b.sum)
        }))}
        travelers={state.travelers} onTravelers={setTravelers}
        grandTotal={eur(grand)} perPerson={eur(grand / trav)} perNight={eur(grand / Math.max(1, nightsTotal))}
        budgetHint="vols, hôtels, activités et visites — restaurants et shopping restent hors budget"
        budgetNote={blanks
          ? blanks + ' ligne(s) encore sans prix — le total ne les compte pas.'
          : 'Toutes les lignes ont un prix : le total est complet.'}
      />

      <footer style={{
        position: 'relative',
        padding: `clamp(12px, 1.6vw, 20px) ${PAGE_X} clamp(30px, 3.4vw, 46px)`,
        textAlign: 'center', borderTop: '1px solid #e6d2ab'
      }}>
        <div style={{ fontSize: 'clamp(13px, 1.4vw, 18px)', fontStyle: 'italic', color: '#6b5238' }}>{routeLine}</div>
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: 'clamp(14px, 1.8vw, 24px)',
          backgroundImage: "url('/img/deco-band.png')", backgroundSize: 'auto 100%', backgroundRepeat: 'repeat-x'
        }} />
      </footer>
    </div>
  );
}
