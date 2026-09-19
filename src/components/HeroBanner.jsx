import './HeroBanner.scss';

// Bandeau pagode.
//
// Sa place est ici, après la carte et avant les expériences — pas sous
// l'en-tête. Il ouvre la partie « inspiration » de la page, là où l'on cesse de
// préparer pour se projeter. Le dégradé part de la gauche et s'efface vers la
// droite : le texte reste lisible sans masquer l'image.
export default function HeroBanner({ steps }) {
  const nights = steps.reduce((total, step) => total + (step.nights ?? 0), 0);

  return (
    <section className="hero">
      <img className="hero__img" src="/img/hero-pagode.webp" alt="" aria-hidden="true" />
      <div className="hero__veil">
        <p className="hero__line">Des instants précieux, des souvenirs impérissables</p>
        <p className="hero__sub">
          {nights} nuits, {steps.length} étapes, un itinéraire qui vous ressemble
        </p>
      </div>
    </section>
  );
}
