import { legSummary } from '@/lib/transport.js';
import './StepLink.scss';

// La route entre deux villes, dans la vue Villes.
//
// EN LECTURE SEULE depuis L11 F3. Le trajet se saisit dans le jour par jour,
// sur le jour où l'on change de ville : c'est là qu'on voit ce qu'il prend à
// la journée. Ici, il reste le fil de l'itinéraire — on lit qu'on passe de
// Tokyo à Matsumoto en train, en 11 h 10 — sans second endroit où le modifier.
//
// C'est aussi là que viendront les arrêts en chemin (F5) : Hakushu entre Tokyo
// et Matsumoto, Shirakawa-gō entre Takayama et Kyoto. La bande appartient à
// l'intervalle entre deux villes, pas à celle qu'on quitte.
export default function StepLink({ leg }) {
  const summary = legSummary(leg);

  return (
    <div className="link">
      <span className="link__rule" aria-hidden="true" />

      {summary ? (
        <span className="link__label">
          {summary}
          {leg.note && <span className="link__note"> · {leg.note}</span>}
        </span>
      ) : (
        // Un trajet manquant reste visible : c'est une chose à faire. Mais il
        // se saisit ailleurs, et la ligne le dit.
        <span className="link__todo" title="Le trajet se saisit dans la vue Jour par jour">
          trajet à préciser
        </span>
      )}

      <span className="link__rule" aria-hidden="true" />
    </div>
  );
}
