import { card, serif, PAGE_X } from '../ui.js';
import { EXPERIENCES } from '../data.js';

export default function Experiences() {
  return (
    <section style={{ padding: `0 ${PAGE_X} clamp(22px, 2.6vw, 34px)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 'clamp(10px, 1.2vw, 16px)' }}>
        <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, #d9bd8c)' }} />
        <h2 style={{
          margin: 0, fontFamily: serif, fontWeight: 600, fontSize: 'clamp(17px, 2vw, 26px)',
          letterSpacing: '.06em', textTransform: 'uppercase', color: '#8f1d24'
        }}>Expériences à vivre</h2>
        <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, #d9bd8c, transparent)' }} />
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
        gap: 'clamp(10px, 1.4vw, 18px)'
      }}>
        {EXPERIENCES.map((e) => (
          <article key={e.name} style={{ ...card, overflow: 'hidden' }}>
            <div role="img" aria-label={e.name} style={{
              width: '100%', height: 'clamp(96px, 11vw, 150px)', backgroundColor: '#efe2c8',
              backgroundSize: 'cover', backgroundPosition: 'center', backgroundImage: e.bg
            }} />
            <div style={{ padding: 'clamp(9px, 1vw, 14px)', textAlign: 'center' }}>
              <h3 style={{
                margin: 0, fontFamily: serif, fontWeight: 600,
                fontSize: 'clamp(15px, 1.6vw, 20px)', color: '#8f1d24'
              }}>{e.name}</h3>
              <div style={{ margin: '6px auto', width: 46, height: 1, background: '#d9bd8c' }} />
              <p style={{ margin: 0, fontSize: 'clamp(12.5px, 1.3vw, 16px)', color: '#4d3c2d', lineHeight: 1.4 }}>{e.text}</p>
              <div style={{
                marginTop: 7, fontSize: 'clamp(10.5px, 1.1vw, 13px)', letterSpacing: '.07em',
                textTransform: 'uppercase', color: '#a08050'
              }}>{e.where}</div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
