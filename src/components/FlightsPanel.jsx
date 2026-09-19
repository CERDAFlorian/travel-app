import { useEffect, useState } from 'react';
import { formatStepDates } from '@/lib/dates.js';
import { formatEuros, priceInEuros, toEuros } from '@/lib/currency.js';
import { addFlight, deleteFlight, updateFlight } from '@/lib/mutations.js';
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

// « NH 216 » en un seul champ, comme dans le design : le premier mot est la
// compagnie, le reste le numéro. Le saisir en deux champs séparés serait
// fidèle au schéma et pénible à l'usage.
function splitFlightNumber(raw) {
  const [airline, ...rest] = String(raw).trim().split(/\s+/);
  return { airline: airline || null, flightNo: rest.join(' ') || null };
}

export default function FlightsPanel({ trip, readOnly, onChanged }) {
  const flights = trip.flights;

  const sum = flights.reduce(
    (amount, flight) => amount + (toEuros(flight.price, flight.currency ?? 'EUR') ?? 0),
    0,
  );
  const total = sum > 0 ? formatEuros(sum) : 'à renseigner';

  if (flights.length === 0 && readOnly) return null;

  return (
    <section className="flights">
      <div className="flights__card">
        <div className="flights__head">
          <h2 className="flights__title">Billets d'avion</h2>
          <span className="flights__hint">aller, retour et vols intérieurs</span>
          <span className="flights__total">
            Total vols <em>{total}</em>
          </span>
        </div>

        <div className="flights__grid">
          {flights.map((flight) => (
            <FlightCard
              key={flight.id}
              flight={flight}
              readOnly={readOnly}
              onChanged={onChanged}
            />
          ))}

          {!readOnly && <FlightForm tripId={trip.id} onChanged={onChanged} />}
        </div>
      </div>
    </section>
  );
}

function FlightCard({ flight, readOnly, onChanged }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!confirming) return undefined;
    const timer = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(timer);
  }, [confirming]);

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
        <span className="flight__date">
          {flight.date ? formatStepDates(flight.date, flight.date) : 'date à venir'}
        </span>

        {!readOnly && (
          <button
            type="button"
            className="flight__delete"
            data-armed={confirming || undefined}
            disabled={busy}
            title={confirming ? 'Confirmer la suppression' : 'Supprimer ce vol'}
            onClick={() => {
              if (!confirming) {
                setConfirming(true);
                return;
              }
              run(() => deleteFlight(flight.id));
            }}
          >
            {confirming ? 'Confirmer ?' : '✕'}
          </button>
        )}
      </div>

      <div className="flight__route">
        {flight.from_code ?? '???'} → {flight.to_code ?? '???'}
      </div>

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
                run(() => updateFlight(flight.id, { price: parsed.value }));
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.target.blur();
            }}
          />
        )}
      </div>

      {error && (
        <p className="flight__error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}

function FlightForm({ tripId, onChanged }) {
  const [direction, setDirection] = useState('aller');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [date, setDate] = useState('');
  const [number, setNumber] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;

    // Le schéma contraint les codes à trois majuscules. On le vérifie ici
    // pour dire ce qui ne va pas, plutôt que de laisser remonter une
    // violation de contrainte que personne ne sait lire.
    const codes = [from, to].map((c) => c.trim().toUpperCase());
    if (codes.some((c) => c && !/^[A-Z]{3}$/.test(c))) {
      setError('Les codes aéroport font trois lettres — CDG, HND, FUK.');
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
      await addFlight({
        tripId,
        direction,
        fromCode: codes[0],
        toCode: codes[1],
        date,
        ...splitFlightNumber(number),
        price: parsed.value,
      });
      await onChanged();
      setFrom('');
      setTo('');
      setDate('');
      setNumber('');
      setPrice('');
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="flight-form" onSubmit={submit}>
      <div className="flight-form__title">Ajouter un vol</div>

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
          type="date"
          value={date}
          aria-label="Date du vol"
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
          className="flight-form__field"
          type="text"
          inputMode="numeric"
          value={price}
          placeholder="890 €"
          aria-label="Prix du vol"
          onChange={(event) => setPrice(event.target.value)}
        />
        <button className="flight-form__submit" type="submit" disabled={busy}>
          {busy ? '…' : '+ Ajouter'}
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
