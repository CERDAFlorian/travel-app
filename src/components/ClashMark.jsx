import { legSummary } from '@/lib/transport.js';
import './ClashMark.scss';

// L'avertissement d'un transport dont l'horaire en chevauche un autre le même
// jour : on ne peut pas être dans le train de 12 h à 12 h 30 ET dans le bus de
// 12 h 15. Il nomme le transport en cause — sans lui, on chercherait lequel
// corriger.
export default function ClashMark({ others }) {
  if (!others || others.length === 0) return null;

  const names = others.map((leg) => legSummary(leg)).join(' ; ');

  return (
    <span className="clash" title={`Chevauche : ${names}`} role="note">
      ⚠ chevauche<span className="sr-only"> : {names}</span>
    </span>
  );
}
