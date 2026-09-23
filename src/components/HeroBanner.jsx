import { whisperFor } from '@/lib/lovenotes.js';
import { useLoveNotes } from '@/hooks/useLoveNotes.js';
import './HeroBanner.scss';

// Bandeau pagode.
//
// Sa place est ici, après la carte et avant les expériences — pas sous
// l'en-tête. Il ouvre la partie « inspiration » de la page, là où l'on cesse de
// préparer pour se projeter. Le dégradé part de la gauche et s'efface vers la
// droite : le texte reste lisible sans masquer l'image.
export default function HeroBanner({ steps, startDate }) {
  // Les chiffres du voyage ne sont plus affiches ici — ils sont deja dans les
  // pastilles de l'en-tete. Le bandeau, lui, ne sert qu'a se projeter.
  const seed = `${startDate ?? ''}${steps.length}`;
  // Le voile ne porte que des mots doux : partagé, l'image reste, le texte
  // part. Un bandeau vide vaut mieux qu'une déclaration lue par un tiers.
  const mots = useLoveNotes();

  return (
    <section className="hero">
      <img className="hero__img" src="/img/hero-pagode.webp" alt="" aria-hidden="true" />
      <div className="hero__veil">
        {mots && (
          <>
            <p className="hero__line">{whisperFor('hero', seed)}</p>
            <p className="hero__sub">{whisperFor('heroSub', seed)}</p>
          </>
        )}
      </div>
    </section>
  );
}
