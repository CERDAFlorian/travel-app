import { useEffect, useState } from 'react';
import { formatDay, formatStepDates } from '@/lib/dates.js';
import { flightArrival } from '@/lib/itinerary.js';
import { priceInEuros } from '@/lib/currency.js';
import { addFlight, deleteFlight, updateFlight } from '@/lib/mutations.js';
import { MOBILE_QUERY, useMediaQuery } from '@/hooks/useMediaQuery.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import ChevronIcon from './ChevronIcon.jsx';
import TrashIcon from './TrashIcon.jsx';
import { whisperFor } from '@/lib/lovenotes.js';
import './FlightsPanel.scss';

const DIRECTIONS = [
  { value: 'aller', label: 'Aller' },
  { value: 'interieur', label: 'Intérieur' },
  { value: 'retour', label: 'Retour' },
];

const LABEL = Object.fromEntries(DIRECTIONS.map((d) => [d.value, d.label]));

function parsePrice(raw) {
  const cleaned = String(raw).replace(/\s/g, '').replace(',', '.');
  if (cleaned === '') return { value: null };
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? { value } : { error: true };
}

// Un vol qui atterrit le lendemain couvre deux dates. Sans décalage, il n'y en
// a qu'une : « 7 – 7 nov. » afficherait un intervalle là où il n'y a qu'un jour.
function flightDates(flight) {
  if (!flight.date) return 'date à venir';
  const offset = flight.arrival_offset_days ?? 0;
  return offset === 0 ? formatDay(flight.date) : formatStepDates(flight.date, flightArrival(flight));
}

// Postgres rend un `time` en « HH:MM:SS ». Les secondes d'un horaire de vol
// n'apprennent rien.
const formatTime = (value) => (value ? String(value).slice(0, 5) : null);

// « CDG → HEL → HND ». Les escales s'insèrent dans le trajet plutôt que de
// s'afficher à part : c'est un seul vol, un seul billet.
function routeOf(flight) {
  return [flight.from_code ?? '???', ...(flight.stops ?? []), flight.to_code ?? '???'];
}

// « NH 216 » en un seul champ, comme dans le design : le premier mot est la
// compagnie, le reste le numéro. Le saisir en deux champs séparés serait
// fidèle au schéma et pénible à l'usage.
function splitFlightNumber(raw) {
  const [airline, ...rest] = String(raw).trim().split(/\s+/);
  return { airline: airline || null, flightNo: rest.join(' ') || null };
}

export default function FlightsPanel({ trip, readOnly, onChanged }) {
  const flights = trip.flights;
  // Le formulaire est replié par défaut : déplié en permanence, il occupait
  // autant de place qu'un vol réel alors qu'on l'utilise trois fois par voyage.
  const [adding, setAdding] = useState(false);

  // Sur mobile, le bloc des vols est replié : il précède l'itinéraire, et
  // quatre cartes de vol repoussaient la première étape hors de l'écran. Sur
  // grand écran il reste ouvert, la place ne manque pas.
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [open, setOpen] = useState(!isMobile);

  if (flights.length === 0 && readOnly) return null;

  return (
    <section className="flights" id="vols">
      <div className="flights__card" data-collapsed={isMobile && !open ? '' : undefined}>
        <div className="flights__head">
          {/* Le titre devient le bouton de pliage, mais seulement là où le
              pliage existe : sur grand écran, un bouton qui ne fait rien
              serait un piège. */}
          {isMobile ? (
            <button
              type="button"
              className="flights__toggle"
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
            >
              <h2 className="flights__title">Billets d'avion</h2>
              <span className="flights__count">{flights.length}</span>
              <span className="flights__caret" data-open={open || undefined}>
                <ChevronIcon />
              </span>
            </button>
          ) : (
            <h2 className="flights__title">Billets d'avion</h2>
          )}
          {!isMobile && (
            <span className="flights__hint">{whisperFor('flights', trip.id)}</span>
          )}

        </div>

        {(!isMobile || open) && (
        <div className="flights__grid">
          {flights.map((flight) => (
            <FlightCard
              key={flight.id}
              trip={trip}
              flight={flight}
              readOnly={readOnly}
              onChanged={onChanged}
            />
          ))}

        </div>
        )}

        {/* Après les vols déjà saisis : on ajoute à la suite de ce qu'on a,
            on ne commence pas par le formulaire. */}
        {(!isMobile || open) && !readOnly && !adding && (
          <button
            type="button"
            className="flights__add"
            aria-expanded={adding}
            onClick={() => setAdding(true)}
          >
            + Ajouter un vol
          </button>
        )}

        {(!isMobile || open) && !readOnly && adding && (
          <FlightForm
            trip={trip}
            onChanged={onChanged}
            onClose={() => setAdding(false)}
          />
        )}
      </div>
    </section>
  );
}

function FlightCard({ trip, flight, readOnly, onChanged }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const route = routeOf(flight);
  const dep = formatTime(flight.dep);
  const arr = formatTime(flight.arr);
  const offset = flight.arrival_offset_days ?? 0;

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await onChanged();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="flight">
      <div className="flight__top">
        <span className="flight__label">{LABEL[flight.direction] ?? flight.direction}</span>
        <span className="flight__date">{flightDates(flight)}</span>

        {!readOnly && (
          <button
            type="button"
            className="flight__delete"
            disabled={busy}
            title="Supprimer ce vol"
            onClick={() => setAsking(true)}
          >
            <TrashIcon />
            <span className="sr-only">Supprimer ce vol</span>
          </button>
        )}
      </div>

      <div className="flight__route">
        {route.map((code, index) => (
          <span key={`${code}-${index}`}>
            {index > 0 && <span className="flight__arrow"> → </span>}
            {/* Une escale se lit plus discrètement que les extrémités : on
                part de CDG et on arrive à HND, Helsinki n'est qu'un passage. */}
            <span data-stop={index > 0 && index < route.length - 1 ? '' : undefined}>{code}</span>
          </span>
        ))}
      </div>

      {(dep || arr) && (
        <div className="flight__times">
          {dep ?? '--:--'} → {arr ?? '--:--'}
          {offset !== 0 && (
            <sup className="flight__offset" title={offsetTitle(offset)}>
              {offset > 0 ? `+${offset}` : offset}
            </sup>
          )}
        </div>
      )}

      <div className="flight__bottom">
        <span className="flight__number">
          {[flight.airline, flight.flight_no].filter(Boolean).join(' ') || 'vol à préciser'}
        </span>
        <span className="flight__rule" aria-hidden="true" />

        {readOnly ? (
          <span className="flight__price-read">
            {priceInEuros(flight.price, flight.currency ?? 'EUR') ?? '—'}
          </span>
        ) : (
          <input
            className="flight__price"
            type="text"
            inputMode="numeric"
            defaultValue={flight.price ?? ''}
            placeholder="prix €"
            aria-label={`Prix du vol ${flight.from_code} ${flight.to_code}`}
            onBlur={(event) => {
              const parsed = parsePrice(event.target.value);
              if (parsed.error) {
                setError('Prix invalide.');
                return;
              }
              if (parsed.value !== (flight.price ?? null)) {
                run(() => updateFlight(trip, flight.id, { price: parsed.value }));
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.target.blur();
            }}
          />
        )}
      </div>

      <ConfirmDialog
        open={asking}
        title="Supprimer ce vol ?"
        busy={busy}
        onCancel={() => setAsking(false)}
        onConfirm={async () => {
          await run(() => deleteFlight(trip, flight.id));
          setAsking(false);
        }}
      >
        <p>
          <strong>{route.join(' → ')}</strong>
          {flight.date ? `, le ${formatStepDates(flight.date, flight.date)}` : ''}.
        </p>
        <p>Cette action est définitive : il n'y a pas de corbeille.</p>
      </ConfirmDialog>

      {error && (
        <p className="flight__error" role="alert">
          {error}
        </p>
      )}

      {flight.direction === 'retour' && (
        <p className="flight__note">{whisperFor('comeback', flight.id)}</p>
      )}
    </article>
  );
}

function offsetTitle(offset) {
  if (offset === 1) return 'Arrivée le lendemain';
  if (offset === 2) return 'Arrivée le surlendemain';
  if (offset === -1) return 'Arrivée la veille — ligne de changement de date';
  return '';
}

function FlightForm({ trip, onChanged, onClose }) {
  const [direction, setDirection] = useState('aller');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [stops, setStops] = useState('');
  const [date, setDate] = useState('');
  const [dep, setDep] = useState('');
  const [arr, setArr] = useState('');
  const [offset, setOffset] = useState(0);
  const [number, setNumber] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const normalizeCode = (value) => value.trim().toUpperCase();

  async function submit(event) {
    event.preventDefault();
    if (busy) return;

    // Les escales se saisissent séparées par une virgule ou un espace : on
    // accepte les deux plutôt que d'imposer une ponctuation.
    const stopCodes = stops
      .split(/[\s,;]+/)
      .map(normalizeCode)
      .filter(Boolean);

    const codes = [normalizeCode(from), normalizeCode(to)];

    // Le schéma contraint les codes à trois majuscules. On le vérifie ici pour
    // dire ce qui ne va pas, plutôt que de laisser remonter une violation de
    // contrainte que personne ne sait lire.
    const invalid = [...codes, ...stopCodes].filter((c) => c && !/^[A-Z]{3}$/.test(c));
    if (invalid.length > 0) {
      setError(`Code aéroport invalide : ${invalid.join(', ')}. Trois lettres — CDG, HEL, HND.`);
      return;
    }

    const parsed = parsePrice(price);
    if (parsed.error) {
      setError('Prix invalide.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await addFlight(trip, {
        direction,
        fromCode: codes[0],
        toCode: codes[1],
        stops: stopCodes,
        date,
        dep,
        arr,
        arrivalOffsetDays: offset,
        ...splitFlightNumber(number),
        price: parsed.value,
      });
      await onChanged();
      onClose();
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  }

  return (
    <form className="flight-form" onSubmit={submit}>
      <div className="flight-form__row">
        <select
          className="flight-form__field"
          value={direction}
          aria-label="Type de vol"
          onChange={(event) => setDirection(event.target.value)}
        >
          {DIRECTIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        <input
          className="flight-form__code"
          type="text"
          value={from}
          placeholder="CDG"
          maxLength={3}
          aria-label="Aéroport de départ"
          onChange={(event) => setFrom(event.target.value)}
        />
        <span className="flight-form__arrow" aria-hidden="true">→</span>
        <input
          className="flight-form__code"
          type="text"
          value={to}
          placeholder="HND"
          maxLength={3}
          aria-label="Aéroport d'arrivée"
          onChange={(event) => setTo(event.target.value)}
        />
      </div>

      <div className="flight-form__row">
        <input
          className="flight-form__field"
          type="text"
          value={stops}
          placeholder="Escales : HEL, DOH"
          aria-label="Escales, codes aéroport séparés par des virgules"
          onChange={(event) => setStops(event.target.value)}
        />
      </div>

      <div className="flight-form__row">
        <input
          className="flight-form__field"
          type="date"
          value={date}
          aria-label="Date de départ"
          onChange={(event) => setDate(event.target.value)}
        />
        <input
          className="flight-form__field"
          type="text"
          value={number}
          placeholder="NH 216"
          aria-label="Compagnie et numéro de vol"
          onChange={(event) => setNumber(event.target.value)}
        />
      </div>

      <div className="flight-form__row">
        <input
          className="flight-form__time"
          type="time"
          value={dep}
          aria-label="Heure de départ"
          onChange={(event) => setDep(event.target.value)}
        />
        <span className="flight-form__arrow" aria-hidden="true">→</span>
        <input
          className="flight-form__time"
          type="time"
          value={arr}
          aria-label="Heure d'arrivée"
          onChange={(event) => setArr(event.target.value)}
        />
        {/* Un vol de nuit vers le Japon atterrit le lendemain. Sans ce
            décalage, « 13:05 → 08:55 » se lit comme un vol qui remonte le
            temps. */}
        <select
          className="flight-form__field"
          value={offset}
          aria-label="Jour d'arrivée"
          onChange={(event) => setOffset(Number(event.target.value))}
        >
          <option value={0}>arrivée le jour même</option>
          <option value={1}>arrivée le lendemain</option>
          <option value={2}>arrivée le surlendemain</option>
          <option value={-1}>arrivée la veille</option>
        </select>
      </div>

      <div className="flight-form__row">
        <input
          className="flight-form__field"
          type="text"
          inputMode="numeric"
          value={price}
          placeholder="890 €"
          aria-label="Prix du vol"
          onChange={(event) => setPrice(event.target.value)}
        />
        <button className="flight-form__submit" type="submit" disabled={busy}>
          {busy ? '…' : "+ Ajouter"}
        </button>
        <button className="flight-form__cancel" type="button" onClick={onClose}>
          Annuler
        </button>
      </div>

      {error && (
        <p className="flight-form__error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
