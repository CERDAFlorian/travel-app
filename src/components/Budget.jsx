import { card, dashedRule, eyebrow, hint, sectionTitle, serif, PAGE_X } from '../ui.js';

export default function Budget({
  rows, travelers, onTravelers, grandTotal, perPerson, perNight, budgetHint, budgetNote
}) {
  return (
    <section style={{ padding: `0 ${PAGE_X} clamp(24px, 2.8vw, 36px)` }}>
      <div style={{ ...card, borderRadius: 16, padding: 'clamp(12px, 1.4vw, 20px)' }}>
        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 12,
          marginBottom: 'clamp(10px, 1.2vw, 14px)'
        }}>
          <h2 style={{ ...sectionTitle, fontSize: 'clamp(17px, 2vw, 26px)' }}>Budget global</h2>
          <span style={hint}>{budgetHint}</span>
          <span style={{
            marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 'clamp(12px, 1.25vw, 15px)', color: '#6b5238'
          }}>
            Voyageurs
            <input
              key={'trav:' + travelers} type="number" min="1" max="12" defaultValue={travelers}
              onBlur={(e) => onTravelers(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
              style={{
                width: 58, padding: '3px 7px', border: '1px solid #ddc59b', borderRadius: 7,
                background: '#fffdf7', fontSize: 'clamp(12px, 1.25vw, 15px)'
              }}
            />
          </span>
        </div>

        <div style={{
          display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden',
          border: '1px solid #e0caa2', background: '#f3e6cd'
        }}>
          {rows.map((b) => (
            <div key={b.key} title={b.title} style={{ flexGrow: b.grow, flexBasis: 0, background: b.color }} />
          ))}
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))',
          gap: 'clamp(8px, 1vw, 16px)', marginTop: 'clamp(10px, 1.2vw, 14px)'
        }}>
          {rows.map((b) => (
            <div key={b.key} style={{
              display: 'flex', alignItems: 'baseline', gap: 8, padding: '4px 2px',
              borderBottom: '1px dotted #e0caa2'
            }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', flex: 'none', background: b.color }} />
              <span style={{ fontSize: 'clamp(12.5px, 1.3vw, 16px)', color: '#4d3c2d' }}>{b.label}</span>
              <span style={{ fontSize: 'clamp(11px, 1.1vw, 13px)', fontStyle: 'italic', color: '#a08050' }}>{b.note}</span>
              <span style={{ ...dashedRule, flex: 1, minWidth: 8 }} />
              <span style={{ fontSize: 'clamp(12.5px, 1.3vw, 16px)', color: '#8f1d24', whiteSpace: 'nowrap' }}>{b.amount}</span>
            </div>
          ))}
        </div>

        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 'clamp(12px, 2vw, 30px)',
          marginTop: 'clamp(12px, 1.4vw, 18px)', paddingTop: 'clamp(10px, 1.2vw, 14px)',
          borderTop: '1px solid #e0caa2'
        }}>
          <div>
            <div style={eyebrow}>Total du voyage</div>
            <div style={{ fontFamily: serif, fontSize: 'clamp(26px, 3.4vw, 46px)', lineHeight: 1.05, color: '#8f1d24' }}>
              {grandTotal}
            </div>
          </div>
          <div>
            <div style={eyebrow}>Par voyageur</div>
            <div style={{ fontFamily: serif, fontSize: 'clamp(19px, 2.2vw, 30px)', lineHeight: 1.1, color: '#4a3a2c' }}>
              {perPerson}
            </div>
          </div>
          <div>
            <div style={eyebrow}>Par nuit</div>
            <div style={{ fontFamily: serif, fontSize: 'clamp(19px, 2.2vw, 30px)', lineHeight: 1.1, color: '#4a3a2c' }}>
              {perNight}
            </div>
          </div>
          <div style={{ ...hint, marginLeft: 'auto', maxWidth: 320 }}>{budgetNote}</div>
        </div>
      </div>
    </section>
  );
}
