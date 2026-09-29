import { useEffect, useRef, useState } from 'react';
import { hasGoogleMaps } from '@/lib/googleMaps.js';
import { newSession, placeToSave, resolve, suggest } from '@/lib/places.js';
import { parseCoordinates } from '@/lib/geocode.js';
import { haversine, formatDistance, MAX_DISTANCE_FROM_STEP_KM } from '@/lib/geo.js';
import { useOnline } from '@/hooks/useOnline.js';
import './PlaceSearch.scss';

// Recherche d'un lieu avec Google (L10, F2). Remplace le sélecteur Nominatim.
//
// Le champ part du titre de l'item, et il est MODIFIABLE : c'est la leçon du
// diagnostic de septembre 2026. « JARDIN KENROKUEN » ne trouvait rien parce
// qu'un seul mot de trop suffisait à faire échouer Nominatim, et l'utilisateur
// n'avait aucun moyen de le retirer. Ici, les suggestions arrivent pendant
// qu'on tape, et Google tolère les fautes (« Fushimi anari »).
//
// JAMAIS de choix automatique : un titre vague (« OKONOMIYAKI ») rend un
// établissement parmi d'autres. On montre, l'utilisateur choisit — la règle de
// L4 tient.
//
// `near` est la référence du contrôle de cohérence des 50 km : le centre de
// l'étape pour un lieu, null pour une étape elle-même — deux étapes
// successives sont normalement loin l'une de l'autre.
//
// `bias` oriente la recherche et mesure la distance affichée : par défaut
// `near`, et pour une étape, l'étape voisine (`biasName` la nomme). Aucun
// filtre de type : une étape peut être une île ou un village de montagne.
//
// `onSave({ lat, lng, placeId, title })` : placeId vaut null pour des
// coordonnées collées à la main.
//
// `adoptName` (un item) : le lieu choisi dans les suggestions donne son nom à
// l'item — `title` vaut alors le nom Google (décidé le 29 septembre 2026 : un
// nom que Google connaît se retrouve ensuite tel quel dans Maps). Des
// coordonnées collées à la main ne renomment rien. Une étape garde son nom :
// c'est le fil de tout le voyage.

// Attendre que la frappe se pose avant d'interroger Google : sans ce délai,
// chaque lettre partirait en requête.
const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;

export default function PlaceSearch({
  title,
  stepName,
  near,
  bias = near,
  biasName = stepName,
  forStep = false,
  adoptName = false,
  onSave,
  onCancel,
}) {
  const online = useOnline();
  const available = hasGoogleMaps() && online;

  const [query, setQuery] = useState(title ?? '');
  const [suggestions, setSuggestions] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [manual, setManual] = useState('');
  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false);

  // Une session par recherche, de la première lettre au lieu choisi. Un ref :
  // elle ne doit pas déclencher de rendu, et doit survivre à ceux qui passent.
  const session = useRef(null);
  // Seule la réponse à la DERNIÈRE frappe compte : une réponse lente à « Ken »
  // ne doit pas écraser celle, déjà arrivée, à « Kenrokuen ».
  const latest = useRef(0);
  const manualRef = useRef(null);

  useEffect(() => {
    if (!available) return undefined;
    const input = query.trim();
    if (input.length < MIN_CHARS) {
      setSuggestions(null);
      return undefined;
    }

    const ticket = ++latest.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        session.current ??= await newSession();
        const results = await suggest(input, { session: session.current, bias });
        if (ticket !== latest.current) return;
        setSuggestions(results);
        // Rien trouvé : le champ de coordonnées devient l'action principale.
        if (results.length === 0) manualRef.current?.focus();
      } catch (failure) {
        if (ticket !== latest.current) return;
        setError(
          failure.kind === 'network'
            ? 'Google est injoignable : vérifie le réseau.'
            : 'La recherche Google a échoué. Tu peux coller des coordonnées ci-dessous.',
        );
      } finally {
        if (ticket === latest.current) setSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, available, bias]);

  const distanceOf = (point) =>
    near ? haversine({ lat: Number(near.lat), lng: Number(near.lng) }, point) : null;

  async function commit(point) {
    setSaving(true);
    setError(null);
    try {
      await onSave(placeToSave(point, { adoptName }));
    } catch (failure) {
      setError(failure.message);
      setSaving(false);
    }
  }

  // Un lieu à plus de 50 km du centre de l'étape est presque sûrement le
  // mauvais. L'avertissement BLOQUE l'enregistrement : une erreur acceptée en
  // silence ne se découvre que sur place, devant une porte close.
  function choose(point) {
    const distance = distanceOf(point);
    if (distance != null && distance > MAX_DISTANCE_FROM_STEP_KM) {
      setPending({ point, distance });
      return;
    }
    commit(point);
  }

  async function pick(suggestion) {
    setSaving(true);
    setError(null);
    try {
      const point = await resolve(suggestion);
      // La session est close par cette fiche : la prochaine recherche en
      // ouvrira une nouvelle.
      session.current = null;
      setSaving(false);
      choose({ ...point, name: suggestion.main });
    } catch {
      setError('Google n’a pas pu donner la position de ce lieu. Réessaie ou colle des coordonnées.');
      setSaving(false);
    }
  }

  function submitManual(event) {
    event.preventDefault();
    const point = parseCoordinates(manual);
    if (!point) {
      setError('Format attendu : 35.0394, 135.7292');
      return;
    }
    choose({ ...point, placeId: null });
  }

  if (pending) {
    return (
      <div className="place-search place-search--warning" role="alert">
        <p className="place-search__warning">
          Ce lieu est à <strong>{formatDistance(pending.distance)}</strong> du centre de{' '}
          {stepName}. C'est probablement le mauvais — ou bien le centre de l'étape est
          lui-même mal placé.
        </p>
        <div className="place-search__actions">
          <button
            type="button"
            className="place-search__confirm"
            disabled={saving}
            onClick={() => commit(pending.point)}
          >
            Enregistrer quand même
          </button>
          <button type="button" className="place-search__cancel" onClick={() => setPending(null)}>
            Choisir autre chose
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="place-search">
      {available ? (
        <label className="place-search__field">
          <span className="sr-only">Rechercher un lieu</span>
          <input
            className="place-search__input"
            type="search"
            value={query}
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
            placeholder={forStep ? 'Une ville, une île, un village…' : 'Un lieu, un hôtel, un restaurant…'}
            autoComplete="off"
          />
        </label>
      ) : (
        <p className="place-search__status">
          {/* Sans clé, c'est ce qui manque d'abord : le réseau n'y changerait rien. */}
          {!hasGoogleMaps()
            ? 'La recherche Google n’est pas configurée : colle des coordonnées ci-dessous.'
            : 'La recherche de lieux a besoin du réseau. Hors ligne, tu peux coller des coordonnées.'}
        </p>
      )}

      {searching && <p className="place-search__status">Recherche…</p>}

      {error && (
        <p className="place-search__error" role="alert">
          {error}
        </p>
      )}

      {available && suggestions?.length === 0 && !searching && (
        <p className="place-search__empty">
          Aucun lieu pour « {query.trim()} ». Essaie un autre nom, ou ouvre Google Maps,
          clic droit sur le lieu, puis colle les coordonnées ci-dessous.
        </p>
      )}

      {suggestions?.length > 0 && (
        <>
          <ul className="place-search__list">
            {suggestions.map((suggestion) => {
              // Loin de l'étape : seulement pour un lieu. Une étape est
              // mesurée depuis sa voisine, loin par nature.
              const far = near != null && suggestion.km != null && suggestion.km > MAX_DISTANCE_FROM_STEP_KM;
              return (
                <li key={suggestion.placeId}>
                  <button
                    type="button"
                    className="place-search__candidate"
                    data-far={far || undefined}
                    disabled={saving}
                    onClick={() => pick(suggestion)}
                  >
                    <span className="place-search__label">{suggestion.main}</span>
                    <span className="place-search__meta">
                      {suggestion.secondary}
                      {suggestion.km != null && biasName && ` · ${formatDistance(suggestion.km)} de ${biasName}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {/* Les conditions de Google exigent d'attribuer ses données quand
              elles s'affichent hors d'une carte Google. */}
          <p className="place-search__credit">Suggestions : Google Maps</p>
        </>
      )}

      {/* Repli : un lieu introuvable, ou la recherche hors d'atteinte. Des
          coordonnées collées à la main sont à nous, hors règle des 30 jours. */}
      <form className="place-search__manual" onSubmit={submitManual}>
        <input
          ref={manualRef}
          className="place-search__input"
          type="text"
          value={manual}
          onChange={(event) => setManual(event.target.value)}
          placeholder="ou des coordonnées : 35.0394, 135.7292"
          aria-label="Coordonnées à la main"
        />
        <button type="submit" className="place-search__submit" disabled={saving}>
          Utiliser
        </button>
        <button type="button" className="place-search__cancel" onClick={onCancel}>
          Fermer
        </button>
      </form>
    </div>
  );
}
