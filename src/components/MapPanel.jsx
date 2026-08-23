import JapanMap from '../JapanMap.jsx';
import { card, dashedRule, hint, sectionTitle } from '../ui.js';

export default function MapPanel({
  pins, points, cats, hidden, legs, selected, selectedPoint, onPin, onPoint,
  legend, geoLabel, onLocateAll, showTravelTimes, legsList
}) {
  return (
    <aside style={{ minWidth: 0 }}>
      <div style={{ ...card, position: 'sticky', top: 12, borderRadius: 16, padding: 'clamp(11px, 1.2vw, 16px)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
          <h2 style={{
            ...sectionTitle, fontSize: 'clamp(17px, 1.8vw, 24px)',
            letterSpacing: 'normal', textTransform: 'none'
          }}>La carte du voyage</h2>
          <span style={hint}>molette pour zoomer · glisser pour déplacer</span>
          <span
            onClick={onLocateAll} title="Chercher l'adresse de chaque lieu et le placer précisément"
            style={{
              marginLeft: 'auto', cursor: 'pointer', fontSize: 'clamp(10.5px, 1.05vw, 13px)',
              letterSpacing: '.06em', textTransform: 'uppercase', border: '1px solid #b6c6d5',
              borderRadius: 999, padding: '3px 11px', color: '#2c5271', background: '#f2f6f9', whiteSpace: 'nowrap'
            }}
          >{geoLabel}</span>
        </div>

        <JapanMap
          pins={pins} points={points} cats={cats} hidden={hidden} legs={legs}
          selected={selected} selectedPoint={selectedPoint} onSelect={onPin} onPoint={onPoint}
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '10px 0 0' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid #d8bd8e',
            borderRadius: 999, padding: '3px 11px', fontSize: 'clamp(11px, 1.15vw, 14px)',
            color: '#5c1b1b', background: '#f7eddb'
          }}>
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#8f1d24' }} />Étapes
          </span>
          {legend.map((lg) => (
            <span
              key={lg.key} onClick={lg.toggle} title="Afficher / masquer sur la carte"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer',
                border: `1px solid ${lg.border}`, borderRadius: 999, padding: '3px 11px',
                fontSize: 'clamp(11px, 1.15vw, 14px)', color: lg.fg, background: lg.bg, opacity: lg.op
              }}
            >
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: lg.dot }} />{lg.label}
            </span>
          ))}
        </div>

        {showTravelTimes && (
          <div style={{
            marginTop: 'clamp(10px, 1.2vw, 15px)', padding: 'clamp(9px, 1vw, 13px)',
            border: '1px solid #e0caa2', borderRadius: 12, background: '#f8eed9'
          }}>
            <div style={{
              textAlign: 'center', fontSize: 'clamp(11.5px, 1.15vw, 14px)', letterSpacing: '.12em',
              textTransform: 'uppercase', color: '#8f1d24', marginBottom: 6
            }}>Temps de trajet approximatifs</div>
            {legsList.map((lg, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0',
                borderBottom: '1px dotted #ddc59b'
              }}>
                <span style={{ fontSize: 'clamp(12.5px, 1.3vw, 16px)', color: '#4d3c2d' }}>{lg.label}</span>
                <span style={{ ...dashedRule, flex: 1, minWidth: 10 }} />
                <span style={{
                  fontSize: 'clamp(12.5px, 1.3vw, 16px)', fontStyle: 'italic',
                  color: '#8f1d24', whiteSpace: 'nowrap'
                }}>{lg.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
