// Où manger : les restaurants du voyage, relus pour choisir sur place.
//
// Aucune donnée à part : ce sont les items de catégorie « restaurant » de
// chaque ville, saisis dans la vue Villes. Cet onglet ne fait que les ranger
// autrement — par ville, coups de cœur d'abord, avec le jour où l'on y sera
// ou pas loin, et, sur place, par distance.
//
// Pas de quartier (Florian, 6 nov. 2026) : Google interdit d'enregistrer
// l'adresse d'un lieu, et « Autour de moi » répond mieux à la question qu'on
// se pose en se baladant.

import { daysOf, scheduleOf } from './days.js';
import { haversine } from './geo.js';

// « Pas loin » : un lieu prévu ce jour-là à moins d'un kilomètre, soit un
// quart d'heure à pied.
export const NEAR_KM = 1;

// « Autour de moi » : ce qu'on rejoint à pied ou en deux stations.
export const AROUND_KM = 3;

const isRestaurant = (item) => item.category === 'restaurant';
const hasPoint = (point) => point?.lat != null && point?.lng != null;

// Les restaurants d'une ville, coups de cœur d'abord, puis dans l'ordre de
// saisie. Ceux rangés dans un arrêt ou une excursion comptent aussi : on y
// mange tout autant.
export function restaurantsOf(step) {
  return (step.items ?? [])
    .filter(isRestaurant)
    .sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)) || (a.position ?? 0) - (b.position ?? 0));
}

// Les jours d'un restaurant dans sa ville :
//
//   · `on`   — il est posé sur ce jour du programme (directement, ou via
//              l'excursion qui le contient) ;
//   · `near` — un lieu prévu ce jour-là est à moins de NEAR_KM.
//
// Des dates ISO, dans l'ordre du séjour. Un jour déjà dans `on` ne se répète
// pas dans `near`.
export function daysFor(step, restaurant) {
  const parent = restaurant.parent_id
    ? (step.items ?? []).find((item) => item.id === restaurant.parent_id)
    : null;
  const offset = restaurant.day_offset ?? parent?.day_offset ?? null;

  const on = [];
  const near = [];

  for (const day of scheduleOf(step)) {
    if (!day.date) continue;
    if (day.offset === offset) {
      on.push(day.date);
      continue;
    }
    if (!hasPoint(restaurant)) continue;

    const close = day.items.some(
      (item) => item.id !== restaurant.id && hasPoint(item) && haversine(item, restaurant) <= NEAR_KM,
    );
    if (close) near.push(day.date);
  }

  return { on, near };
}

// La ville où l'on est aujourd'hui, ou null hors du voyage.
//
// Le jour d'un changement de ville appartient aux deux (days.js) : c'est la
// ville où l'on ARRIVE qui l'emporte — on y dîne le soir. Sauf pour la
// dernière, dont le dernier jour est celui du vol retour.
export function currentStepId(steps, today) {
  const last = steps.at(-1);
  for (const step of steps) {
    const days = daysOf(step);
    const first = days[0]?.date;
    const end = days.at(-1)?.date;
    if (!first || !end) continue;
    if (today >= first && (today < end || (step === last && today === end))) return step.id;
  }
  return null;
}

// Les villes dans l'ordre d'affichage : celle du jour d'abord, les autres dans
// l'ordre du voyage. Seules celles qui ont des restaurants.
export function foodByCity(steps, today) {
  const current = currentStepId(steps, today);
  const cities = steps
    .map((step) => ({ step, restaurants: restaurantsOf(step), current: step.id === current }))
    .filter((city) => city.restaurants.length > 0);

  return [...cities.filter((city) => city.current), ...cities.filter((city) => !city.current)];
}

// Tous les restaurants du voyage, du plus proche au plus loin de `here`. Ceux
// sans position ne se classent pas : ils sont écartés.
export function restaurantsAround(steps, here) {
  return steps
    .flatMap((step) =>
      restaurantsOf(step)
        .filter(hasPoint)
        .map((restaurant) => ({ restaurant, step, km: haversine(here, restaurant) })),
    )
    .sort((a, b) => a.km - b.km);
}

// La recherche Google du restaurant : l'adresse, les horaires, les avis. Un
// lien, donc gratuit — et rien de Google ne s'enregistre.
export function googleSearchUrl(restaurant, step) {
  const params = new URLSearchParams({ q: `${restaurant.title} ${step.name}` });
  return `https://www.google.com/search?${params}`;
}

// L'itinéraire jusqu'au restaurant, depuis là où l'on est : Google Maps choisit
// le départ et le mode. Relié à Google, il vise le lieu exact ; sinon ses
// coordonnées ; à défaut, son nom dans la ville.
export function directionsUrl(restaurant, step) {
  const params = new URLSearchParams({ api: '1' });
  if (restaurant.place_id) {
    params.set('destination', restaurant.title);
    params.set('destination_place_id', restaurant.place_id);
  } else if (hasPoint(restaurant)) {
    params.set('destination', `${Number(restaurant.lat)},${Number(restaurant.lng)}`);
  } else {
    params.set('destination', `${restaurant.title} ${step.name}`);
  }
  return `https://www.google.com/maps/dir/?${params}`;
}
