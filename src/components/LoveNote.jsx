import { useEffect, useState } from 'react';
import { proverbFor, whisperFor } from '@/lib/lovenotes.js';
import { useLoveNotes } from '@/hooks/useLoveNotes.js';
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
  // Un mot doux est écrit pour deux. En vue partagée, il n'a rien à faire
  // sous les yeux de qui reçoit le lien.
  const allowed = useLoveNotes();
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

  if (!allowed) return null;

  if (transient) {
    // La place est reservee en permanence, meme vide : sans ca, le mot doux
    // pousse le contenu vers le bas en arrivant et le tire vers le haut en
    // partant. Le bloc reste donc toujours monte, et seul son contenu change.
    const whisper = shown ? whisperFor(kind, `${seed ?? ''}${trigger}`) : null;
    return (
      <p className="love-note love-note--flash" role="status" aria-hidden={!whisper}>
        {whisper && <span className="love-note__flash-text">{whisper}</span>}
      </p>
    );
  }

  // Le proverbe seul : les signes japonais et leur traduction se suffisent.
  // Une ligne francaise au-dessus faisait redite — elle disait deja en clair
  // ce que le proverbe dit mieux.
  const proverb = proverbFor(seed);
  return (
    <p className="love-note love-note--proverb">
      <span className="love-note__ja" lang="ja">
        {proverb.ja}
      </span>
      <span className="love-note__romaji">{proverb.romaji}</span>
      <span className="love-note__fr">{proverb.fr}</span>
    </p>
  );
}
