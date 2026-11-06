import { useMemo, useState } from 'react';
import { formatDayFull, formatStepDates, todayIso } from '@/lib/dates.js';
import { formatDistance } from '@/lib/geo.js';
import {
  AROUND_KM,
  daysFor,
  directionsUrl,
  foodByCity,
  googleSearchUrl,
  restaurantsAround,
} from '@/lib/food.js';
import { linkLabel } from '@/lib/links.js';
import './TripFood.scss';

// Où manger — la colonne de gauche, quatrième lecture du voyage (Florian,
// 6 nov. 2026).
//
// Deux façons de chercher. Par défaut, tous les restaurants rangés par ville,
// celle du jour en tête et ouverte. « Autour de moi » les classe par distance
// depuis la position du téléphone : c'est la question qu'on se pose en se
// baladant, sans connaître le nom du quartier.
//
// Lecture seule : les restaurants se saisissent dans la vue Villes. Pas de
// carte sur cet onglet (TripView la retire).
export default function TripFood({ trip, today = todayIso() }) {
  const cities = useMemo(() => foodByCity(trip.steps ?? [], today), [trip.steps, today]);
  const duringTrip = cities.some((city) => city.current);

  // null : la liste par ville. Sinon l'état de la géolocalisation.
  const [around, setAround] = useState(null);

  function toggleAround() {
    if (around) {
      setAround(null);
      return;
    }
    if (!navigator.geolocation) {
      setAround({ error: 'Ce navigateur ne sait pas donner ta position.' });
      return;
    }
    setAround({ loading: true });
    navigator.geolocation.getCurrentPosition(
      (position) =>
        setAround({ here: { lat: position.coords.latitude, lng: position.coords.longitude } }),
      (error) =>
        setAround({
          error:
            error.code === error.PERMISSION_DENIED
              ? 'Position refusée : autorise-la pour ce site dans les réglages du navigateur.'
              : 'Position introuvable pour le moment. Réessaie dans un instant.',
        }),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }

  if (cities.length === 0) {
    return (
      <p className="food__empty">
        Aucun restaurant pour l'instant. Ajoute-les dans la vue Villes, catégorie Restaurants.
      </p>
    );
  }

  return (
    <section className="food" aria-label="Où manger">
      <div className="food__bar">
        <button
          type="button"
          className="food__around"
          data-on={around ? true : undefined}
          aria-pressed={Boolean(around)}
          onClick={toggleAround}
        >
          {around ? 'Toutes les villes' : 'Autour de moi'}
        </button>
      </div>

      {around ? (
        <Around state={around} steps={trip.steps ?? []} />
      ) : (
        cities.map(({ step, restaurants, current }) => (
          <details key={step.id} className="food__city" open={current || !duringTrip}>
            <summary className="food__city-head">
              <span className="food__city-name">{step.name}</span>
              <span className="food__city-meta">
                {`${current ? "Aujourd'hui" : formatStepDates(step.date_start, step.date_end)} · ${restaurants.length}`}
              </span>
            </summary>
            <ul className="food__list">
              {restaurants.map((restaurant) => (
                <Restaurant key={restaurant.id} restaurant={restaurant} step={step} />
              ))}
            </ul>
          </details>
        ))
      )}
    </section>
  );
}

function Around({ state, steps }) {
  if (state.loading) return <p className="food__status">Recherche de ta position…</p>;
  if (state.error) return <p className="food__status">{state.error}</p>;

  const all = restaurantsAround(steps, state.here);
  const close = all.filter((entry) => entry.km <= AROUND_KM);

  if (close.length === 0) {
    const nearest = all[0];
    return (
      <p className="food__status">
        Aucun restaurant à moins de {AROUND_KM} km.
        {nearest &&
          ` Le plus proche : ${nearest.restaurant.title} (${nearest.step.name}), à ${formatDistance(nearest.km)}.`}
      </p>
    );
  }

  return (
    <ul className="food__list">
      {close.map(({ restaurant, step, km }) => (
        <Restaurant
          key={restaurant.id}
          restaurant={restaurant}
          step={step}
          distance={`${formatDistance(km)} · ${step.name}`}
        />
      ))}
    </ul>
  );
}

function Restaurant({ restaurant, step, distance = null }) {
  const { on, near } = daysFor(step, restaurant);

  return (
    <li className="food__item">
      <div className="food__head">
        {restaurant.favorite && (
          <span className="food__star" aria-hidden="true">
            ★
          </span>
        )}
        <span className="food__name">
          {restaurant.title}
          {restaurant.favorite && <span className="sr-only"> (coup de cœur)</span>}
        </span>
        {distance && <span className="food__distance">{distance}</span>}
      </div>

      {(on.length > 0 || near.length > 0) && (
        <p className="food__days">
          {on.length > 0 && <span className="food__on">{`Prévu ${on.map(formatDayFull).join(', ')}`}</span>}
          {near.length > 0 && <span>{`Pas loin ${near.map(formatDayFull).join(', ')}`}</span>}
        </p>
      )}

      <div className="food__links">
        {restaurant.url && (
          <a href={restaurant.url} target="_blank" rel="noreferrer">
            {`${linkLabel(restaurant.url)} ↗`}
          </a>
        )}
        <a href={googleSearchUrl(restaurant, step)} target="_blank" rel="noreferrer">
          Google ↗
        </a>
        <a href={directionsUrl(restaurant, step)} target="_blank" rel="noreferrer">
          Itinéraire ↗
        </a>
      </div>
    </li>
  );
}
