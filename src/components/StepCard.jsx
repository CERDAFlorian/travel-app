import { useState } from 'react';
import ImageSlot from '../ImageSlot.jsx';
import { button, card, input, serif } from '../ui.js';

const stop = (e) => e.stopPropagation();

function AddItemRow({ placeholder, priceOn, onAdd }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const submit = () => {
    if (!name.trim()) return;
    onAdd(name, price);
    setName(''); setPrice('');
  };
  const onKey = (e) => { e.stopPropagation(); if (e.key === 'Enter') submit(); };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 2 }}>
      <input
        type="text" placeholder={placeholder} value={name} onClick={stop}
        onChange={(e) => setName(e.target.value)} onKeyDown={onKey}
        style={{ ...input, flex: 1, minWidth: 120, fontSize: 'clamp(12px, 1.25vw, 15px)' }}
      />
      {priceOn && (
        <input
          type="text" placeholder="prix" value={price} onClick={stop}
          onChange={(e) => setPrice(e.target.value)} onKeyDown={onKey}
          style={{ ...input, width: 74, fontSize: 'clamp(12px, 1.25vw, 15px)' }}
        />
      )}
      <span onClick={(e) => { stop(e); submit(); }}
        style={{ ...button, border: '1px solid #d8bd8e', padding: '3px 10px', fontSize: 'clamp(12px, 1.25vw, 15px)' }}>+</span>
    </div>
  );
}

function PhotoTile({ photo }) {
  return (
    <figure style={{ margin: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid #dcc49a', background: '#efe2c8' }}>
      {photo.src ? (
        <div role="img" aria-label={photo.cap} style={{
          width: '100%', height: 'clamp(70px, 8vw, 108px)', backgroundColor: '#efe2c8',
          backgroundSize: 'cover', backgroundPosition: 'center', backgroundImage: `url('${photo.src}')`
        }} />
      ) : (
        <div onClick={stop} style={{ width: '100%', height: 'clamp(70px, 8vw, 108px)', position: 'relative' }}>
          <ImageSlot slotId={photo.slotId} placeholder={photo.name} />
          <a
            href={photo.searchUrl} target="_blank" rel="noopener noreferrer" onClick={stop}
            title="Chercher des photos de ce lieu, puis glisser l'image ici"
            style={{
              position: 'absolute', right: 4, top: 4, zIndex: 2, fontSize: 9.5, letterSpacing: '.06em',
              textTransform: 'uppercase', background: 'rgba(253,246,233,.9)', border: '1px solid #d0b177',
              borderRadius: 999, padding: '1px 7px', color: '#8f1d24'
            }}
          >chercher</a>
        </div>
      )}
      <figcaption style={{
        background: '#9c2a2a', color: '#fbeed7', fontSize: 'clamp(8.5px, .82vw, 10.5px)',
        letterSpacing: '.07em', textTransform: 'uppercase', padding: '3px 5px',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
      }}>{photo.cap}</figcaption>
    </figure>
  );
}

function Item({ it, mapLabel }) {
  return (
    <div onClick={it.pick} style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7, padding: '3px 5px',
      borderRadius: 8, cursor: 'pointer', background: it.selected ? '#f1e7d3' : 'transparent'
    }}>
      {it.thumb && (
        <div role="img" style={{
          width: 44, height: 31, borderRadius: 4, border: '1px solid #d5c3a4', flex: 'none',
          backgroundColor: '#efe2c8', backgroundSize: 'cover', backgroundPosition: 'center',
          backgroundImage: `url('${it.thumb}')`
        }} />
      )}
      <span style={{ width: 7, height: 7, borderRadius: '50%', flex: 'none', background: it.color }} />
      <span style={{ fontSize: 'clamp(12.5px, 1.3vw, 16px)', color: '#3d2f24' }}>{it.name}</span>
      <span style={{ fontSize: 'clamp(11px, 1.15vw, 13.5px)', fontStyle: 'italic', color: '#8a6c47' }}>{it.meta}</span>
      {it.hasMap && (
        <a href={it.mapUrl} target="_blank" rel="noopener noreferrer" onClick={stop}
          title="Ouvrir dans Plan / Google Maps"
          style={{
            fontSize: 'clamp(10.5px, 1.05vw, 12.5px)', letterSpacing: '.06em', textTransform: 'uppercase',
            border: '1px solid #cbb691', borderRadius: 999, padding: '1px 8px', color: '#6b5238'
          }}>{mapLabel}</a>
      )}
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
        {it.starShow && (
          <span onClick={it.star} title="Mettre en avant : ce lieu illustre la ville (3 maximum)"
            style={{ cursor: 'pointer', fontSize: 14, lineHeight: 1, color: it.starColor }}>{it.starIcon}</span>
        )}
        {it.locateShow && (
          <span onClick={it.locate} title="Placer automatiquement sur la carte"
            style={{
              cursor: 'pointer', fontSize: 'clamp(10.5px, 1.05vw, 12.5px)', letterSpacing: '.06em',
              textTransform: 'uppercase', border: '1px dashed #b6c6d5', borderRadius: 999,
              padding: '1px 8px', color: '#52708a', whiteSpace: 'nowrap'
            }}>{it.locateLabel}</span>
        )}
        {it.priceShow && (
          <input
            key={it.id + ':' + it.price} type="text" defaultValue={it.price} placeholder="prix"
            onClick={stop} onBlur={it.setPrice} onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
            style={{
              width: 74, textAlign: 'right', padding: '2px 6px', border: '1px solid #e2d0ae',
              borderRadius: 6, background: '#fffdf7', fontSize: 'clamp(11.5px, 1.2vw, 14px)',
              fontStyle: 'italic', color: '#8f1d24'
            }}
          />
        )}
        <span onClick={it.del} title="Supprimer"
          style={{ cursor: 'pointer', color: '#c2a377', fontSize: 12.5, padding: '0 3px' }}>✕</span>
      </span>
    </div>
  );
}

export default function StepCard({ s, mapLabel }) {
  return (
    <article onClick={s.select} style={{
      ...card, position: 'relative', display: 'grid', gridTemplateColumns: 'auto 1fr',
      gap: 'clamp(10px, 1.2vw, 16px)', padding: 'clamp(11px, 1.2vw, 16px)', cursor: 'pointer',
      borderColor: s.ring, boxShadow: s.shadow
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
        <div style={{
          width: 'clamp(30px, 3.4vw, 40px)', height: 'clamp(30px, 3.4vw, 40px)', borderRadius: '50%',
          background: '#8f1d24', color: '#fdf1dc', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 'clamp(15px, 1.7vw, 21px)', fontWeight: 600,
          boxShadow: 'inset 0 0 0 2px rgba(253,241,220,.35)'
        }}>{s.n}</div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, fontSize: 12, color: '#c2a377' }}>
          <span onClick={s.up} title="Monter" style={{ cursor: 'pointer' }}>▲</span>
          <span onClick={s.down} title="Descendre" style={{ cursor: 'pointer' }}>▼</span>
          <span onClick={s.remove} title="Retirer cette ville" style={{ cursor: 'pointer', color: '#c98f8f' }}>✕</span>
        </div>
        <div style={{ flex: 1, width: 1, background: 'linear-gradient(#d9bd8c, rgba(217,189,140,.15))' }} />
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 12px' }}>
          <h2 style={{
            margin: 0, fontFamily: serif, fontWeight: 600,
            fontSize: 'clamp(19px, 2.1vw, 28px)', color: '#3a2a1e', lineHeight: 1.1
          }}>{s.name}</h2>
          <span style={{ fontStyle: 'italic', fontSize: 'clamp(13px, 1.35vw, 17px)', color: '#8f1d24' }}>{s.dates}</span>
          <span style={{
            marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 7,
            border: '1px solid #d8bd8e', borderRadius: 999, padding: '2px 8px',
            fontSize: 'clamp(10.5px, 1.1vw, 13px)', letterSpacing: '.06em', textTransform: 'uppercase',
            color: '#7a5a33', background: '#f7eddb', whiteSpace: 'nowrap'
          }}>
            <span onClick={s.less} title="Une nuit de moins" style={{ cursor: 'pointer', color: '#8f1d24' }}>−</span>
            {s.nightsLabel}
            <span onClick={s.more} title="Une nuit de plus" style={{ cursor: 'pointer', color: '#8f1d24' }}>+</span>
          </span>
        </div>

        {s.photos.length > 0 ? (
          <div style={{ display: 'grid', marginTop: 9, gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {s.photos.map((p) => <PhotoTile key={p.slotId} photo={p} />)}
          </div>
        ) : (
          <div style={{
            display: 'flex', marginTop: 9, height: 'clamp(56px, 6vw, 74px)', borderRadius: 8,
            border: '1px dashed #d0b177',
            background: 'repeating-linear-gradient(45deg, #f4e7cd 0 8px, #efe0c4 8px 16px)',
            alignItems: 'center', justifyContent: 'center', fontFamily: 'ui-monospace, Menlo, monospace',
            fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: '#a08050'
          }}>photos de {s.short} à déposer ici</div>
        )}

        <div style={{ marginTop: 10, borderTop: '1px solid #eadcc0' }}>
          {s.sections.map((sec) => (
            <div key={sec.key} style={{ borderBottom: '1px dotted #e4d2b0' }}>
              <div onClick={sec.toggle} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 2px', cursor: 'pointer' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', flex: 'none', background: sec.color }} />
                <span style={{
                  fontSize: 'clamp(12.5px, 1.3vw, 16px)', letterSpacing: '.05em',
                  textTransform: 'uppercase', color: '#5c4630'
                }}>{sec.label}</span>
                <span style={{ fontSize: 'clamp(11px, 1.15vw, 13.5px)', fontStyle: 'italic', color: '#a08050' }}>{sec.count}</span>
                <span style={{
                  marginLeft: 'auto', fontSize: 'clamp(11.5px, 1.2vw, 14.5px)',
                  fontStyle: 'italic', color: '#8f1d24'
                }}>{sec.total}</span>
                <span style={{ fontSize: 'clamp(11px, 1.15vw, 13.5px)', color: '#b39a72' }}>{sec.caret}</span>
              </div>
              {sec.open && (
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 4, padding: '2px 2px 9px 17px',
                  animation: 'softin .22s ease both'
                }}>
                  {sec.items.map((it) => <Item key={it.id} it={it} mapLabel={mapLabel} />)}
                  <AddItemRow placeholder={sec.placeholder} priceOn={sec.priceOn} onAdd={sec.add} />
                </div>
              )}
            </div>
          ))}
        </div>

        {s.travelShow && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 10, paddingTop: 8 }}>
            <span style={{
              fontSize: 'clamp(11px, 1.15vw, 14px)', letterSpacing: '.08em',
              textTransform: 'uppercase', color: '#a08050'
            }}>{s.travelKind}</span>
            <span style={{
              flex: 1, height: 1,
              background: 'repeating-linear-gradient(90deg, #cdae7d 0 6px, transparent 6px 11px)'
            }} />
            <span style={{
              fontSize: 'clamp(12.5px, 1.3vw, 16px)', fontStyle: 'italic', color: '#8f1d24'
            }}>{s.travelText}</span>
          </div>
        )}
      </div>
    </article>
  );
}
