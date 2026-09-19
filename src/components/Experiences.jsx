import { priceInEuros } from '@/lib/currency.js';
import './Experiences.scss';

// « Expériences à vivre ».
//
// Le titre est encadré de deux filets dégradés qui s'effacent vers l'extérieur
// — une respiration entre la partie préparation et la partie inspiration.
//
// Les quatre images (baguettes, sumo, matcha, sushi) font partie des PNG restés
// dans le canvas. Tant qu'elles ne sont pas exportées, la carte s'affiche sans
// visuel : c'est prévu, rien ne casse.
export default function Experiences({ experiences }) {
  if (experiences.length === 0) return null;

  return (
    <section className="experiences">
      <div className="experiences__head">
        <span className="experiences__rule experiences__rule--left" aria-hidden="true" />
        <h2 className="experiences__title">Expériences à vivre</h2>
        <span className="experiences__rule experiences__rule--right" aria-hidden="true" />
      </div>

      <div className="experiences__grid">
        {experiences.map((experience) => {
          // La description du seed porte le lieu après un « · » final.
          const [text, where] = String(experience.description ?? '').split(' · ');
          const price = priceInEuros(experience.price, experience.currency ?? 'JPY');

          return (
            <article key={experience.id} className="experience">
              <div
                className="experience__image"
                role="img"
                aria-label={experience.title}
                style={
                  experience.image
                    ? { backgroundImage: `url(/img/${experience.image})` }
                    : undefined
                }
              />
              <div className="experience__body">
                <h3 className="experience__title">{experience.title}</h3>
                <span className="experience__divider" aria-hidden="true" />
                <p className="experience__text">{text}</p>
                <div className="experience__where">
                  {[where, price].filter(Boolean).join(' · ')}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
