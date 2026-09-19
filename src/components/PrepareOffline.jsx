import { useState } from 'react';
import { fetchTrip, fetchTrips } from '@/lib/api.js';
import { requestPersistence, writeTrip, writeTripList } from '@/lib/db.js';
import './PrepareOffline.scss';

// « Préparer le voyage » — la synchronisation explicite avant le départ.
//
// Elle existe parce qu'on ne peut pas compter sur une navigation exhaustive :
// il suffit de n'avoir jamais ouvert l'étape de Hiroshima pour qu'elle manque
// dans le train. Ce bouton va chercher TOUS les voyages en entier, quoi qu'on
// ait consulté, et vérifie que le service worker a bien son précache.
//
// Le moment de s'en servir est la veille du départ, en wifi.
async function countPrecached() {
  try {
    const names = await caches.keys();
    let total = 0;
    for (const name of names) {
      const cache = await caches.open(name);
      total += (await cache.keys()).length;
    }
    return total;
  } catch {
    return null;
  }
}

export default function PrepareOffline() {
  const [state, setState] = useState({ status: 'idle' });

  async function run() {
    setState({ status: 'running', done: 0, total: 1, label: 'Protection du stockage…' });

    // 1. Demander la persistance AVANT de remplir : inutile de télécharger
    //    300 Ko que le navigateur s'autorise à évincer dans la foulée.
    const persisted = await requestPersistence();

    try {
      setState({ status: 'running', done: 0, total: 1, label: 'Liste des voyages…' });
      const trips = await fetchTrips();
      await writeTripList(trips, Date.now());

      const total = trips.length + 1;
      let done = 1;

      for (const trip of trips) {
        setState({ status: 'running', done, total, label: `${trip.title}…` });
        const full = await fetchTrip(trip.slug);
        if (full) await writeTrip(trip.slug, full, Date.now());
        done += 1;
      }

      const cached = await countPrecached();

      setState({
        status: 'done',
        trips: trips.length,
        cached,
        persisted,
      });
    } catch (error) {
      setState({ status: 'error', message: error.message });
    }
  }

  if (state.status === 'running') {
    const percent = Math.round((state.done / state.total) * 100);
    return (
      <div className="prepare">
        <p className="prepare__label">{state.label}</p>
        <div className="prepare__bar" role="progressbar" aria-valuenow={percent} aria-valuemin="0" aria-valuemax="100">
          <span style={{ width: `${percent}%` }} />
        </div>
      </div>
    );
  }

  if (state.status === 'done') {
    return (
      <div className="prepare">
        <p className="prepare__done">
          {state.trips} voyage{state.trips > 1 ? 's' : ''} en cache
          {state.cached != null && ` · ${state.cached} fichiers précachés`}
          {/* Safari n'implémente pas l'API de persistance. Le dire évite de
              croire à un échec : sur iPhone, c'est l'installation sur l'écran
              d'accueil qui protège les données. */}
          {persistedLabel(state.persisted)}
        </p>
        <button className="prepare__again" type="button" onClick={run}>
          Recommencer
        </button>
      </div>
    );
  }

  return (
    <div className="prepare">
      {state.status === 'error' && (
        <p className="prepare__error" role="alert">
          {state.message}
        </p>
      )}
      <button className="prepare__button" type="button" onClick={run}>
        Préparer le voyage hors ligne
      </button>
      <p className="prepare__hint">
        Télécharge tous les voyages en entier, sans avoir à les ouvrir un par un.
        À faire en wifi, la veille du départ.
      </p>
    </div>
  );
}

function persistedLabel(persisted) {
  return persisted
    ? ' · stockage protégé'
    : " · stockage non protégé (normal sur iPhone : c'est l'installation sur l'écran d'accueil qui le garantit)";
}
