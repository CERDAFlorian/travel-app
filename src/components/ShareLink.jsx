import { useState } from 'react';
import { createShareToken, revokeShareToken } from '@/lib/mutations.js';
import './ShareLink.scss';

// Lien de partage en lecture seule.
//
// Le lien donne accès au voyage sans compte. Il n'est pas « public » : rien ne
// le référence, et le jeton fait 122 bits. Mais quiconque l'a peut le
// retransmettre — d'où le bouton de révocation, qui est la seule reprise en
// main possible sur une URL déjà envoyée.
export default function ShareLink({ trip, readOnly, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  if (readOnly) return null;

  const url = trip.shareToken
    ? `${window.location.origin}/partage/${trip.shareToken}`
    : null;

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await onChanged();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Le presse-papier est refusé hors HTTPS et dans certains contextes.
      // L'URL reste sélectionnable à la main, on ne bloque pas dessus.
      setError('Copie refusée par le navigateur — sélectionne le lien à la main.');
    }
  }

  return (
    <div className="share">
      {url ? (
        <>
          <input className="share__url" type="text" value={url} readOnly onFocus={(e) => e.target.select()} />
          <button className="share__action" type="button" onClick={copy}>
            {copied ? 'Copié' : 'Copier'}
          </button>
          <button
            className="share__action share__action--danger"
            type="button"
            disabled={busy}
            title="Le lien actuel cessera de fonctionner"
            onClick={() => run(() => revokeShareToken(trip.id))}
          >
            Révoquer
          </button>
        </>
      ) : (
        <button
          className="share__action"
          type="button"
          disabled={busy}
          onClick={() => run(() => createShareToken(trip.id))}
        >
          {busy ? 'Création…' : 'Créer un lien de partage'}
        </button>
      )}

      {error && (
        <span className="share__error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
