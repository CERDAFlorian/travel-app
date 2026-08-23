import { useState } from 'react';
import { button, card, dashedRule, eyebrow, hint, input, priceInput, sectionTitle, PAGE_X } from '../ui.js';

function AddFlight({ onAdd }) {
  const blank = { route: '', date: '', flight: '', price: '' };
  const [f, setF] = useState(blank);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = () => { if (onAdd(f)) setF(blank); };

  return (
    <div style={{
      border: '1px dashed #d0b177', borderRadius: 12, padding: '10px 12px',
      display: 'flex', flexDirection: 'column', gap: 6
    }}>
      <div style={{ ...eyebrow, letterSpacing: '.1em', fontSize: 'clamp(11px, 1.1vw, 13px)' }}>Ajouter un vol</div>
      <input type="text" placeholder="Paris CDG → Tokyo Haneda" value={f.route} onChange={set('route')} style={input} />
      <div style={{ display: 'flex', gap: 6 }}>
        <input type="text" placeholder="7 nov. 2026" value={f.date} onChange={set('date')}
          style={{ ...input, flex: 1, minWidth: 0 }} />
        <input type="text" placeholder="NH 216" value={f.flight} onChange={set('flight')}
          style={{ ...input, width: '34%', minWidth: 0 }} />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input type="text" placeholder="890 €" value={f.price} onChange={set('price')}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} style={{ ...input, flex: 1, minWidth: 0 }} />
        <span onClick={submit} style={{ ...button, padding: '4px 12px' }}>+ Ajouter</span>
      </div>
    </div>
  );
}

export default function Flights({ flights, flightsTotal, onAdd, onDelete, onPrice }) {
  return (
    <section style={{ padding: `clamp(14px, 1.8vw, 22px) ${PAGE_X} 0` }}>
      <div style={{ ...card, padding: 'clamp(11px, 1.2vw, 16px)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
          <h2 style={{ ...sectionTitle, fontSize: 'clamp(16px, 1.7vw, 23px)', letterSpacing: '.04em' }}>
            Billets d'avion
          </h2>
          <span style={hint}>aller, retour et vols intérieurs</span>
          <span style={{ marginLeft: 'auto', fontSize: 'clamp(12.5px, 1.3vw, 16px)', color: '#6b5238' }}>
            Total vols <span style={{ color: '#8f1d24', fontStyle: 'italic' }}>{flightsTotal}</span>
          </span>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 270px), 1fr))',
          gap: 'clamp(8px, 1vw, 14px)'
        }}>
          {flights.map((f) => (
            <div key={f.id} style={{
              position: 'relative', border: '1px solid #ddc59b', borderRadius: 12,
              padding: '10px 12px', background: '#f8eed9'
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{
                  fontSize: 'clamp(10.5px, 1.05vw, 12.5px)', letterSpacing: '.12em',
                  textTransform: 'uppercase', color: '#8f1d24'
                }}>{f.label}</span>
                <span style={{ ...hint, fontSize: 'clamp(11.5px, 1.2vw, 14px)' }}>{f.date}</span>
                <span onClick={() => onDelete(f.id)} title="Supprimer"
                  style={{ marginLeft: 'auto', cursor: 'pointer', color: '#bb9a6c', fontSize: 13 }}>✕</span>
              </div>
              <div style={{
                marginTop: 3, fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: 'clamp(14.5px, 1.5vw, 19px)', color: '#3a2a1e'
              }}>{f.route}</div>
              <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 'clamp(11.5px, 1.2vw, 14px)', letterSpacing: '.06em',
                  textTransform: 'uppercase', color: '#a08050'
                }}>{f.flight}</span>
                <span style={{ ...dashedRule, flex: 1 }} />
                <input
                  key={f.id + ':' + f.price} type="text" defaultValue={f.price} placeholder="prix €"
                  onBlur={(e) => onPrice(f.id, e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                  style={{ ...priceInput, width: 84 }}
                />
              </div>
            </div>
          ))}
          <AddFlight onAdd={onAdd} />
        </div>
      </div>
    </section>
  );
}
