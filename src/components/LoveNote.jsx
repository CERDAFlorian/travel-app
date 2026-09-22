import { useEffect, useState } from 'react';
import { proverbFor, whisperFor } from '@/lib/lovenotes.js';
import './LoveNote.scss';

// Un mot doux, à deux visages.
//
//   <LoveNote seed={trip.id} />                       proverbe, permanent
//   <LoveNote kind="step" seed={name} trigger={n} />  mot doux, passager
//
// Le passager s'efface tout seul : il salue une action réussie, il n'attend
// rien. Le rendre permanent le transformerait en message d'état, à lire puis
// à fermer — l'inverse de l'effet cherché.
const LINGER_MS = 7000;

export default function LoveNote({ kind, seed, trigger }) {
  const [shown, setShown] = useState(false);
  const transient = kind !== undefined;

  useEffect(() => {
    if (!transient) return undefined;
    // trigger inchangé au premier rendu : rien ne s'affiche tant qu'aucune
    // action n'a eu lieu.
    if (trigger === undefined || trigger === 0) return undefined;

    setShown(true);
    const timer = setTimeout(() => setShown(false), LINGER_MS);
    return () => clearTimeout(timer);
  }, [transient, trigger]);

  if (transient) {
    if (!shown) return null;
    const whisper = whisperFor(kind, `${seed ?? ''}${trigger}`);
    if (!whisper) return null;
    return (
      <p className="love-note love-note--flash" role="status">
        {whisper}
      </p>
    );
  }

  const proverb = proverbFor(seed);
  return (
    <p className="love-note">
      <span className="love-note__ja" lang="ja">
        {proverb.ja}
      </span>
      <span className="love-note__romaji">{proverb.romaji}</span>
      <span className="love-note__fr">{proverb.fr}</span>
    </p>
  );
}
