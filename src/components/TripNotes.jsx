import { useState } from 'react';
import { addNote, deleteNote } from '@/lib/mutations.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import TrashIcon from './TrashIcon.jsx';
import './TripNotes.scss';

// Les notes du voyage — la colonne de gauche, troisième lecture à côté des
// villes et des jours (Florian, 4 nov. 2026).
//
// Un bloc-notes, rien de plus : une zone de texte, un bouton, et les notes qui
// s'empilent l'une sous l'autre dans l'ordre où on les a écrites. Pas de titre,
// pas de catégorie : ce qu'on note en passant ne se range pas.
export default function TripNotes({ trip, readOnly, onChanged }) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [doomed, setDoomed] = useState(null);
  const [removing, setRemoving] = useState(false);

  const notes = trip.notes ?? [];

  async function submit(event) {
    event.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      await addNote(trip.id, body);
      await onChanged();
      setBody('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="notes" aria-label="Notes du voyage">
      {notes.length === 0 && <p className="notes__empty">Aucune note pour l'instant.</p>}

      {notes.length > 0 && (
        <ul className="notes__list">
          {notes.map((note) => (
            <li key={note.id} className="notes__note">
              <p className="notes__body">{note.body}</p>
              <div className="notes__meta">
                <time dateTime={note.created_at}>{formatNoteDate(note.created_at)}</time>
                {!readOnly && (
                  <button
                    type="button"
                    className="notes__delete"
                    title="Supprimer la note"
                    aria-label="Supprimer la note"
                    onClick={() => setDoomed(note)}
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <form className="notes__form" onSubmit={submit}>
          <textarea
            className="notes__input"
            value={body}
            rows={4}
            placeholder="Une note…"
            aria-label="Nouvelle note"
            onChange={(event) => setBody(event.target.value)}
          />
          <button className="notes__submit" type="submit" disabled={busy || !body.trim()}>
            Ajouter
          </button>
        </form>
      )}

      <ConfirmDialog
        open={doomed !== null}
        title="Supprimer cette note ?"
        confirmLabel="Supprimer la note"
        busy={removing}
        onCancel={() => setDoomed(null)}
        onConfirm={() => {
          setRemoving(true);
          deleteNote(doomed.id)
            .then(onChanged)
            .finally(() => {
              setRemoving(false);
              setDoomed(null);
            });
        }}
      >
        <p>Elle disparaît pour tous les voyageurs.</p>
      </ConfirmDialog>
    </section>
  );
}

// « 4 nov., 14:32 » : de quoi retrouver quand on l'a écrite, sans plus.
function formatNoteDate(timestamp) {
  return new Date(timestamp).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
