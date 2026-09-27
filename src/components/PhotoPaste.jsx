import { useEffect, useRef } from 'react';
import { usePhotoPaste } from '@/hooks/usePhotoPaste.js';
import { imageFromPaste } from '@/lib/userPhoto.js';
import { useOnline } from '@/hooks/useOnline.js';
import './PhotoPaste.scss';

// Le panneau « Photo » d'un lieu touristique ou d'une activité (L10).
//
// Plus aucune photo de Google : quand Wikimedia ne trouve rien, l'utilisateur
// colle la sienne. Le chemin le plus court est un copier-coller — on copie une
// image dans Google Images ou sur son téléphone, on revient, on colle. Tant que
// le panneau est ouvert, Cmd+V (ou Ctrl+V) n'importe où colle ici : c'est le
// geste qu'on a déjà dans les doigts. « Choisir une image » couvre le reste :
// une photo de la galerie, une capture d'écran.
export default function PhotoPaste({ item, searchQuery, onChanged, onClose }) {
  const online = useOnline();
  const { busy, error, paste, save, remove } = usePhotoPaste({ item, onChanged });
  const fileRef = useRef(null);

  useEffect(() => {
    const onPaste = async (event) => {
      // Deux panneaux ouverts : le premier servi prend l'image, pas les deux.
      if (event.defaultPrevented) return;
      const image = imageFromPaste(event);
      if (!image) return;
      event.preventDefault();
      if (await save(image)) onClose?.();
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [save, onClose]);

  const credit = [item.photo_credit, item.photo_license].filter(Boolean).join(' · ');

  return (
    <div className="photo-paste" onClick={(event) => event.stopPropagation()}>
      {item.photo_url && item.photo_source === 'wikimedia' && (
        <p className="photo-paste__credit">
          Photo {credit && <>: {credit} </>}·{' '}
          <a href={item.photo_page ?? item.photo_url} target="_blank" rel="noreferrer">
            Wikimedia Commons
          </a>
        </p>
      )}

      {online ? (
        <p className="photo-paste__hint">
          Copie une image — clic droit « Copier l’image », ou appui long « Copier » —, puis colle-la ici.
        </p>
      ) : (
        <p className="photo-paste__hint">Ajouter une photo demande le réseau.</p>
      )}

      <div className="photo-paste__actions">
        <button type="button" className="photo-paste__primary" disabled={busy || !online} onClick={async () => { if (await paste()) onClose?.(); }}>
          {busy ? 'Envoi…' : 'Coller la photo'}
        </button>
        <button type="button" className="photo-paste__secondary" disabled={busy || !online} onClick={() => fileRef.current?.click()}>
          Choisir une image
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file && (await save(file))) onClose?.();
          }}
        />
        <a
          className="photo-paste__search"
          href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(searchQuery)}`}
          target="_blank"
          rel="noreferrer"
        >
          Chercher une image ↗
        </a>
        {item.photo_url && (
          <button type="button" className="photo-paste__remove" disabled={busy || !online} onClick={remove}>
            Retirer la photo
          </button>
        )}
        <button type="button" className="photo-paste__close" onClick={onClose}>
          Fermer
        </button>
      </div>

      {error && (
        <p className="photo-paste__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
