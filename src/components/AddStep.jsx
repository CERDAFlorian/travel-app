import { useState } from 'react';
import LoveNote from './LoveNote.jsx';
import './AddStep.scss';

// « Ajouter une ville ».
//
// L'étape s'ajoute à la fin, avec ses dates : elle commence là où le voyage
// s'arrêtait. Le design propose une liste de villes prédéfinies — on ne la
// reprend pas : ces 25 villes sont japonaises, et les figer dans l'app la
// marquerait pour un seul pays. Une saisie libre, puis « Situer sur la carte »
// via Nominatim, fonctionne partout.
export default function AddStep({ onAdd }) {
  const [name, setName] = useState('');
  const [nights, setNights] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // Ville tout juste posée : elle déclenche le mot doux et en choisit le
  // tirage. Le compteur distingue deux ajouts de la même ville — sans lui, le
  // second ne relancerait rien, le déclencheur n'ayant pas changé.
  const [added, setAdded] = useState({ count: 0, name: '' });

  async function submit(event) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    setError(null);
    try {
      await onAdd({ name: trimmed, nights });
      setName('');
      setNights(2);
      setAdded((last) => ({ count: last.count + 1, name: trimmed }));
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="add-step" onSubmit={submit}>
      <span className="add-step__title">Ajouter une ville</span>

      <input
        className="add-step__name"
        type="text"
        value={name}
        placeholder="Kanazawa, Nara, Takayama…"
        aria-label="Nom de la ville"
        onChange={(event) => setName(event.target.value)}
      />

      <input
        className="add-step__nights"
        type="number"
        min="1"
        max="30"
        value={nights}
        title="Nombre de nuits"
        aria-label="Nombre de nuits"
        // Plancher à 1 : le schéma refuse une étape à 0 nuit depuis 0007, et
        // mieux vaut un champ qui ne descend pas qu'une erreur Postgres brute
        // à la validation.
        onChange={(event) => setNights(Math.max(1, Number(event.target.value) || 1))}
      />

      <button className="add-step__submit" type="submit" disabled={busy}>
        {busy ? '…' : "+ Ajouter l'étape"}
      </button>

      <p className="add-step__hint">
        L'étape s'ajoute à la fin, et les dates s'enchaînent toutes seules.
        Il reste à la situer sur la carte pour qu'elle y apparaisse.
      </p>

      {error && (
        <p className="add-step__error" role="alert">
          {error}
        </p>
      )}

      <LoveNote kind="step" seed={added.name} trigger={added.count} />
    </form>
  );
}
