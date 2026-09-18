// Cache local — IndexedDB natif.
//
// Pas de librairie : deux stores, des get/put par clé. `idb` ferait gagner
// quelques lignes de verbosité et coûterait une dépendance dans une app qu'on
// emporte à l'étranger. Pas de moteur de synchro non plus (RxDB, WatermelonDB,
// PowerSync) : le hors-ligne est en lecture seule, il n'y a rien à réconcilier.
//
// Tout échoue en silence, en renvoyant null. Un navigateur en navigation
// privée, un quota plein, un Safari capricieux : dans tous ces cas l'app doit
// continuer à fonctionner en ligne, sans cache, plutôt que de tomber.

const DB_NAME = 'travel-app';
const DB_VERSION = 1;
const STORE_TRIPS = 'trips'; // un voyage complet, clé = slug
const STORE_META = 'meta';   // la liste des voyages, clé = 'trips-list'
const LIST_KEY = 'trips-list';

let opening = null;

function open() {
  if (opening) return opening;

  opening = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_TRIPS)) {
        db.createObjectStore(STORE_TRIPS, { keyPath: 'slug' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });

  return opening;
}

// Une transaction, une opération. On attend `oncomplete` et pas `onsuccess` :
// en écriture, la requête réussit avant que la transaction ne soit validée, et
// résoudre trop tôt ferait croire à un enregistrement qui peut encore échouer.
async function run(storeName, mode, work) {
  const db = await open();
  if (!db) return null;

  return new Promise((resolve) => {
    let request;
    try {
      const tx = db.transaction(storeName, mode);
      request = work(tx.objectStore(storeName));
      tx.oncomplete = () => resolve(request?.result ?? null);
      tx.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function readTrip(slug) {
  const row = await run(STORE_TRIPS, 'readonly', (store) => store.get(slug));
  return row ? { data: row.trip, savedAt: row.savedAt } : null;
}

export async function writeTrip(slug, trip, savedAt) {
  await run(STORE_TRIPS, 'readwrite', (store) => store.put({ slug, trip, savedAt }));
}

export async function readTripList() {
  const row = await run(STORE_META, 'readonly', (store) => store.get(LIST_KEY));
  return row ? { data: row.trips, savedAt: row.savedAt } : null;
}

export async function writeTripList(trips, savedAt) {
  await run(STORE_META, 'readwrite', (store) => store.put({ key: LIST_KEY, trips, savedAt }));
}

// Sans ça, le navigateur peut évincer IndexedDB quand l'espace manque, sans
// prévenir. C'est précisément ce qu'il ne faut pas pour une app dont tout
// l'intérêt est d'avoir la donnée le jour où il n'y a pas de réseau.
// Chrome accorde souvent la permission sans rien demander ; Safari l'ignore.
export async function requestPersistence() {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
