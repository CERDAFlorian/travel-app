import { useEffect, useState } from 'react';
import { geocode, parseCoordinates } from '@/lib/geocode.js';
import { haversine, formatDistance, MAX_DISTANCE_FROM_STEP_KM } from '@/lib/geo.js';
import './GeocodePicker.scss';

// Sélecteur de coordonnées.
//
// JAMAIS d'acceptation automatique du premier résultat. Les noms romanisés
// japonais sont ambigus — « Daisho-in » rend un temple à Miyajima et un autre
// dans la préfecture de Nara — et Nominatim ne le signale pas. On montre les
// candidats, on laisse choisir.
// `reference` sert au contrôle de cohérence : c'est le point par rapport
// auquel on juge qu'un candidat est aberrant. Pour un item, c'est le centre de
// son étape. Pour une étape elle-même, il n'y a rien à comparer — on passe
// null et le contrôle se tait.
export default function GeocodePicker({
  title,
  stepName,
  tripTitle,
  reference,
  onSave,
  onCancel,
}) {
  const [candidates, setCandidates] = useState(null);
  const [searching, setSearching] = useState(true);
  const [error, setError] = useState(null);
  const [manual, setManual] = useState('');
  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;

    geocode(title, stepName, tripTitle)
      .then((results) => {
        if (alive) setCandidates(results);
      })
      .catch((failure) => {
        if (alive) setError(failure.message);
      })
      .finally(() => {
        if (alive) setSearching(false);
      });

    return () => {
      alive = false;
    };
  }, [title, stepName, tripTitle]);

  const distanceOf = (point) => (reference ? haversine(reference, point) : null);

  async function commit(point, geocoded) {
    setSaving(true);
    setError(null);
    try {
      await onSave(point, geocoded);
    } catch (failure) {
      setError(failure.message);
      setSaving(false);
    }
  }

  // Un candidat à plus de 50 km du centre de l'étape est presque sûrement le
  // mauvais lieu. L'avertissement BLOQUE l'enregistrement plutôt que de se
  // contenter d'alerter : une erreur de géocodage acceptée en silence ne se
  // découvre que sur place, devant une porte close.
  function choose(point, geocoded) {
    const distance = distanceOf(point);
    if (distance != null && distance > MAX_DISTANCE_FROM_STEP_KM) {
      setPending({ point, geocoded, distance });
      return;
    }
    commit(point, geocoded);
  }

  function submitManual(event) {
    event.preventDefault();
    const point = parseCoordinates(manual);
    if (!point) {
      setError('Format attendu : 35.0394, 135.7292');
      return;
    }
    choose(point, false);
  }

  if (pending) {
    return (
      <div className="geocode geocode--warning" role="alert">
        <p className="geocode__warning">
          Ce point est à <strong>{formatDistance(pending.distance)}</strong> du centre de{' '}
          {stepName}. C'est probablement le mauvais lieu — les noms romanisés ont
          souvent des homonymes.
        </p>
        <div className="geocode__actions">
          <button
            type="button"
            className="geocode__confirm"
            disabled={saving}
            onClick={() => commit(pending.point, pending.geocoded)}
          >
            Enregistrer quand même
          </button>
          <button type="button" className="geocode__cancel" onClick={() => setPending(null)}>
            Choisir autre chose
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="geocode">
      {searching && <p className="geocode__status">Recherche sur OpenStreetMap…</p>}

      {error && (
        <p className="geocode__error" role="alert">
          {error}
        </p>
      )}

      {candidates?.length === 0 && (
        <p className="geocode__status">
          Aucun résultat. Colle les coordonnées à la main — clic droit sur Google Maps.
        </p>
      )}

      {candidates?.length > 0 && (
        <ul className="geocode__list">
          {candidates.map((candidate) => {
            const distance = distanceOf(candidate);
            const far = distance != null && distance > MAX_DISTANCE_FROM_STEP_KM;

            return (
              <li key={`${candidate.lat},${candidate.lng}`}>
                <button
                  type="button"
                  className="geocode__candidate"
                  data-far={far || undefined}
                  disabled={saving}
                  onClick={() => choose(candidate, true)}
                >
                  <span className="geocode__label">{candidate.label}</span>
                  <span className="geocode__meta">
                    {candidate.kind}
                    {distance != null && ` · ${formatDistance(distance)} du centre`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Repli obligatoire : entre 10 et 20 % des lieux n'existent pas dans
          OpenStreetMap sous le nom qu'on leur donne. */}
      <form className="geocode__manual" onSubmit={submitManual}>
        <input
          className="geocode__input"
          type="text"
          value={manual}
          onChange={(event) => setManual(event.target.value)}
          placeholder="35.0394, 135.7292"
          aria-label="Coordonnées à la main"
        />
        <button type="submit" className="geocode__submit" disabled={saving}>
          Utiliser
        </button>
        <button type="button" className="geocode__cancel" onClick={onCancel}>
          Fermer
        </button>
      </form>
    </div>
  );
}
