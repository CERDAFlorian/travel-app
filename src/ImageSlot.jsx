import { useEffect, useRef, useState } from 'react';

// Emplacement photo que l'on remplit soi-même : on dépose une image dessus
// (ou on clique pour la choisir). L'image est conservée d'une visite à l'autre.
const SLOT_KEY = 'japon-itin-v3-slots';
const MAX_BYTES = 3 * 1024 * 1024;

function readSlots() {
  try { return JSON.parse(localStorage.getItem(SLOT_KEY)) || {}; } catch { return {}; }
}
function writeSlot(id, dataUrl) {
  try {
    const all = readSlots();
    if (dataUrl) all[id] = dataUrl; else delete all[id];
    localStorage.setItem(SLOT_KEY, JSON.stringify(all));
  } catch { /* quota plein : l'image reste visible pour cette session */ }
}

export default function ImageSlot({ slotId, placeholder }) {
  const [src, setSrc] = useState(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  useEffect(() => { setSrc(readSlots()[slotId] || null); }, [slotId]);

  const load = (file) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) { setError('Ce fichier n’est pas une image.'); return; }
    if (file.size > MAX_BYTES) { setError('Image trop lourde (3 Mo max).'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setError('');
      setSrc(reader.result);
      writeSlot(slotId, reader.result);
    };
    reader.onerror = () => setError('Lecture impossible.');
    reader.readAsDataURL(file);
  };

  const clear = (e) => {
    e.stopPropagation();
    setSrc(null);
    writeSlot(slotId, null);
  };

  return (
    <div
      onClick={(e) => { e.stopPropagation(); fileRef.current.click(); }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); load(e.dataTransfer.files[0]); }}
      title="Déposez une photo ici, ou cliquez pour la choisir"
      style={{
        position: 'absolute', inset: 0, cursor: 'pointer', overflow: 'hidden',
        background: src ? `center / cover no-repeat url('${src}')` : '#efe2c8'
      }}
    >
      {!src && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 4, padding: 10, textAlign: 'center'
        }}>
          <span style={{ fontSize: 15, color: '#c2a377' }}>⌘</span>
          <span style={{
            fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase',
            color: '#a08050', lineHeight: 1.25, maxWidth: '92%',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>{placeholder || 'Déposez une photo'}</span>
        </div>
      )}
      {src && (
        <span onClick={clear} title="Retirer la photo" style={{
          position: 'absolute', left: 4, top: 4, zIndex: 2, fontSize: 9.5,
          letterSpacing: '.06em', textTransform: 'uppercase', background: 'rgba(253,246,233,.9)',
          border: '1px solid #d0b177', borderRadius: 999, padding: '1px 7px', color: '#8f1d24'
        }}>retirer</span>
      )}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        border: over ? '1.5px dashed #8f1d24' : '1.5px dashed #c2a377',
        opacity: src && !over ? 0 : over ? 1 : 0.55
      }} />
      {error && (
        <div style={{
          position: 'absolute', left: 4, right: 4, bottom: 4, pointerEvents: 'none',
          background: 'rgba(255,255,255,.85)', color: '#b3261e', fontSize: 10,
          borderRadius: 5, padding: '2px 4px'
        }}>{error}</div>
      )}
      <input
        ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={(e) => { load(e.target.files[0]); e.target.value = ''; }}
      />
    </div>
  );
}
