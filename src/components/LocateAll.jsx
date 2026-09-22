import { useMemo, useRef, useState } from 'react';
import { categoryOf } from '@/lib/categories.js';
import { geocode } from '@/lib/geocode.js';
import { MAX_DISTANCE_FROM_STEP_KM, haversine } from '@/lib/geo.js';
import { setCoordinates, setStepCoordinates } from '@/lib/mutations.js';
import './LocateAll.scss';

// Localisation en lot.
//
// Le STOP de L4 interdit le géocodage en masse AUTOMATIQUE au chargement —
// pas un lot déclenché par un clic. La nuance compte : l'interdit protégeait
// Nominatim d'appels que personne n'a demandés, pas l'utilisateur d'un outil
// qu'il actionne lui-même.
//
// Reste la règle qui, elle, ne bouge pas : jamais d'acceptation aveugle du
// premier résultat. En lot, on ne peut pas demander à chaque fois — alors on
// ne retient un candidat que s'il est PLAUSIBLE, c'est-à-dire à moins de 50 km
// du centre de son étape. Les autres sont laissés tels quels et comptés : ils
// se traitent un par un, là où l'on peut choisir.
//
// Compter une seconde par lieu : c'est la cadence imposée par Nominatim, et
// elle n'est pas négociable.
export default function LocateAll({ trip, readOnly, onChanged }) {
  const [state, setState] = useState({ status: 'idle' });
  const cancelled = useRef(false);

  // Étapes d'abord : une étape sans coordonnées ne peut même pas servir
  // d'ancre à ses items, ni de référence au contrôle de cohérence.
  const targets = useMemo(() => {
    const steps = trip.steps
      .filter((step) => step.lat == null)
      .map((step) => ({ kind: 'step', step, title: step.name, context: null }));

    const items = trip.steps.flatMap((step) =>
      step.items
        .filter((item) => item.lat == null && categoryOf(item.category)?.onMap)
        .map((item) => ({ kind: 'item', step, item, title: item.title, context: step.name })),
    );

    return [...steps, ...items];
  }, [trip]);

  if (readOnly || targets.length === 0) return null;

  async function run() {
    cancelled.current = false;
    let placed = 0;
    let skipped = 0;

    for (const [index, target] of targets.entries()) {
      if (cancelled.current) break;
      setState({ status: 'running', done: index, total: targets.length, label: target.title });

      try {
        const [candidate] = await geocode(target.title, target.context, trip.title);
        if (!candidate) {
          skipped += 1;
          continue;
        }

        if (target.kind === 'step') {
          await setStepCoordinates(target.step.id, candidate);
          placed += 1;
          continue;
        }

        // Le contrôle de cohérence remplace ici le choix humain. Sans étape
        // située, on ne peut rien vérifier : on s'abstient plutôt que de
        // poser un point au hasard.
        const reference =
          target.step.lat != null
            ? { lat: Number(target.step.lat), lng: Number(target.step.lng) }
            : null;
        const distance = reference ? haversine(reference, candidate) : null;

        if (distance == null || distance > MAX_DISTANCE_FROM_STEP_KM) {
          skipped += 1;
          continue;
        }

        await setCoordinates(target.item.id, candidate, { geocoded: true });
        placed += 1;
      } catch {
        // Un échec isolé — réseau, refus de Nominatim — n'arrête pas le lot.
        skipped += 1;
      }
    }

    setState({ status: 'done', placed, skipped, stopped: cancelled.current });
    await onChanged();
  }

  if (state.status === 'running') {
    const percent = Math.round((state.done / state.total) * 100);
    return (
      <span className="locate-all locate-all--running">
        <span className="locate-all__bar" role="progressbar" aria-valuenow={percent} aria-valuemin="0" aria-valuemax="100">
          <span style={{ width: `${percent}%` }} />
        </span>
        <span className="locate-all__label">
          {state.done}/{state.total} · {state.label}
        </span>
        <button
          type="button"
          className="locate-all__stop"
          onClick={() => {
            cancelled.current = true;
          }}
        >
          Arrêter
        </button>
      </span>
    );
  }

  if (state.status === 'done') {
    return (
      <span className="locate-all locate-all--done">
        {state.placed} localisé{state.placed > 1 ? 's' : ''}
        {state.skipped > 0 && ` · ${state.skipped} à vérifier à la main`}
        <button type="button" className="locate-all__again" onClick={run}>
          Relancer
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      className="locate-all__start"
      title={`${targets.length} lieux sans coordonnées · environ ${Math.ceil(targets.length * 1.1)} s`}
      onClick={run}
    >
      Localiser les {targets.length} lieux
    </button>
  );
}
