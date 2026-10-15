import { useState } from 'react';
import { excursionsOf } from '@/lib/containers.js';
import { addContainer } from '@/lib/mutations.js';
import ContainerCard from './ContainerCard.jsx';
import './CityExcursions.scss';

// Les excursions au départ d'une ville (L11, F6) : Miyajima depuis Hiroshima,
// Nara depuis Kyoto.
//
// Elles se SAISISSENT ici, sous les catégories de la ville — la vue Villes
// sert à saisir. Elles se PLACENT dans le jour par jour : une excursion
// arrive dans la réserve de la ville et se pose sur un jour, en journée
// entière ou en demi-journée, comme une activité.
export default function CityExcursions({ step, readOnly, onChanged }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  // L'excursion tout juste créée ouvre sa recherche Google, comme un item.
  const [justAdded, setJustAdded] = useState(null);

  const excursions = excursionsOf(step);
  if (readOnly && excursions.length === 0) return null;

  async function submit(event) {
    event.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      const id = await addContainer(step, title, 'excursion');
      setJustAdded(id);
      await onChanged();
      setTitle('');
      setAdding(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="excursions" onClick={(event) => event.stopPropagation()}>
      {excursions.length > 0 && <h3 className="excursions__title">Excursions</h3>}

      {excursions.map((excursion) => (
        <ContainerCard
          key={excursion.id}
          container={excursion}
          home={step}
          autoLocate={excursion.id === justAdded}
          readOnly={readOnly}
          onChanged={onChanged}
        />
      ))}

      {!readOnly &&
        (adding ? (
          <form className="excursions__form" onSubmit={submit}>
            <input
              className="excursions__input"
              type="text"
              value={title}
              autoFocus
              placeholder={`Une excursion depuis ${step.name} : une île, une ville voisine…`}
              aria-label={`Ajouter une excursion depuis ${step.name}`}
              onChange={(event) => setTitle(event.target.value)}
            />
            <button className="excursions__submit" type="submit" disabled={busy}>
              Ajouter
            </button>
            <button className="excursions__cancel" type="button" onClick={() => setAdding(false)}>
              Annuler
            </button>
          </form>
        ) : (
          <button type="button" className="excursions__add" onClick={() => setAdding(true)}>
            + excursion
          </button>
        ))}
    </section>
  );
}
