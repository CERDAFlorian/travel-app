import { pill, serif, PAGE_X } from '../ui.js';

export default function Header({ dateRange, stepCount, nightsTotal, totalPlaces, segments }) {
  return (
    <header style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid #e6d2ab' }}>
      <img src="/img/deco-momiji.png" alt="" style={{
        position: 'absolute', left: -18, top: -14, width: 'clamp(96px, 11vw, 168px)', pointerEvents: 'none'
      }} />
      <img src="/img/deco-fuji.png" alt="" style={{
        position: 'absolute', right: 0, top: 0, width: 'clamp(190px, 26vw, 360px)', pointerEvents: 'none'
      }} />
      <div style={{
        position: 'relative',
        padding: 'clamp(16px, 2.4vw, 30px) clamp(200px, 27vw, 375px) clamp(12px, 1.6vw, 18px) clamp(84px, 8vw, 130px)',
        display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 'clamp(8px, 1.6vw, 20px)'
      }}>
        <h1 style={{
          margin: 0, fontFamily: serif, fontWeight: 700,
          fontSize: 'clamp(40px, 6.2vw, 86px)', lineHeight: 0.92, color: '#8f1d24'
        }}>JAPON</h1>
        <div style={{ paddingBottom: 'clamp(4px, .8vw, 10px)' }}>
          <div style={{ fontSize: 'clamp(17px, 2.1vw, 29px)', fontStyle: 'italic', color: '#4a3a2c' }}>
            — Itinéraire interactif, jour par jour
          </div>
          <div style={{ marginTop: 3, fontSize: 'clamp(13px, 1.4vw, 18px)', fontStyle: 'italic', color: '#8f1d24' }}>
            {dateRange}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', flexWrap: 'wrap', gap: 8, paddingBottom: 4 }}>
          <span style={pill}>{stepCount} étapes</span>
          <span style={pill}>{nightsTotal} nuits</span>
          <span style={pill}>{totalPlaces} lieux</span>
        </div>
      </div>

      <div style={{ position: 'relative', padding: `0 ${PAGE_X} clamp(12px, 1.6vw, 18px)` }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
          {segments.map((seg) => (
            <div
              key={seg.id} onClick={seg.select} title={seg.title}
              style={{
                flexGrow: seg.grow, flexBasis: 0, minWidth: 0, cursor: 'pointer', borderRadius: 6,
                padding: '6px 8px', border: '1px solid #dcc39a', overflow: 'hidden', whiteSpace: 'nowrap',
                textOverflow: 'ellipsis', fontSize: 'clamp(10px, 1.05vw, 13.5px)', letterSpacing: '.04em',
                textTransform: 'uppercase', background: seg.bg, color: seg.fg
              }}
            >{seg.label}</div>
          ))}
        </div>
      </div>
    </header>
  );
}
