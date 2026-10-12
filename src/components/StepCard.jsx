import { useState } from 'react';
import { CATEGORIES } from '@/lib/categories.js';
import { chosenHotel, hotelsOf } from '@/lib/lodging.js';
import { unplacedOf } from '@/lib/days.js';
import { formatStepDates } from '@/lib/dates.js';
import { setStepCoordinates } from '@/lib/mutations.js';
import PlaceSearch from './PlaceSearch.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import TrashIcon from './TrashIcon.jsx';
import PhotoStrip from './PhotoStrip.jsx';
import CategoryAccordion from './CategoryAccordion.jsx';
import LoveNote from './LoveNote.jsx';
import './StepCard.scss';

// Une étape : rail à gauche, contenu à droite.
//
// Le rail porte le numéro puis un filet dégradé qui descend vers l'étape
// suivante. C'est lui qui fait lire la colonne comme un itinéraire plutôt que
// comme une liste de cartes indépendantes.
export default function StepCard({
  step,
  readOnly,
  isLast,
  neighbours,
  selected,
  onSelect,
  onRemove,
  onMove,
  canMoveUp,
  canMoveDown,
  onNights,
  autoLocate,
  onChanged,
}) {
  const [asking, setAsking] = useState(false);
  const [nightsAdded, setNightsAdded] = useState(0);
  const [removing, setRemoving] = useState(false);
  // Vrai au montage de l'étape qu'on vient d'ajouter : elle cherche sa
  // position toute seule.
  const [locating, setLocating] = useState(Boolean(autoLocate));
  // Où orienter la recherche d'une étape : l'étape d'avant, sinon celle
  // d'après. Un voyage avance de proche en proche — c'est ce qui départage
  // les deux Shirakawa. Seulement si elle est elle-même située.
  const situated = (other) => (other?.lat != null && other?.lng != null ? other : null);
  const aroundStep = situated(neighbours?.previous) ?? situated(neighbours?.next);

  const itemsByCategory = new Map(CATEGORIES.map(({ key }) => [key, []]));
  for (const item of step.items) {
    itemsByCategory.get(item.category)?.push(item);
  }

  // Le logement est le décor de tout le séjour, pas une ligne parmi quarante-
  // huit : il se lit sous les dates, avec elles. Et son absence se lit aussi —
  // une étape sans lit est le seul trou qu'on ne peut pas combler sur place.
  //
  // Il n'y a jamais d'entre-deux : dès qu'un hôtel est saisi, il y en a un de
  // retenu (voir lodging.js). Ce qui s'affiche ici est donc soit un nom, soit
  // une étape où personne n'a encore cherché où dormir.
  const lodging = chosenHotel(step);
  const candidates = hotelsOf(step).length;
  const toPlace = unplacedOf(step, { isLast }).length;

  return (
    <article
      className="step"
      id={`step-${step.id}`}
      data-selected={selected || undefined}
      onClick={() => onSelect(step.id)}
    >
      <div className="step__rail">
        <div className="step__number">{step.position}</div>

        {!readOnly && onMove && (
          <div className="step__order">
            {/* Grisées plutôt que masquées : une commande qui disparaît sur la
                première et la dernière étape ferait sauter la colonne, et on
                chercherait ce qui a bougé. */}
            <button
              type="button"
              className="step__arrow"
              disabled={!canMoveUp}
              title={canMoveUp ? 'Monter cette étape' : 'Déjà en premier'}
              onClick={(event) => {
                event.stopPropagation();
                onMove(step.id, -1);
              }}
            >
              ▲<span className="sr-only">Monter {step.name}</span>
            </button>

            <button
              type="button"
              className="step__arrow"
              disabled={!canMoveDown}
              title={canMoveDown ? 'Descendre cette étape' : 'Déjà en dernier'}
              onClick={(event) => {
                event.stopPropagation();
                onMove(step.id, 1);
              }}
            >
              ▼<span className="sr-only">Descendre {step.name}</span>
            </button>
          </div>
        )}

        {!readOnly && onRemove && (
          <button
            type="button"
            className="step__remove"
            disabled={removing}
            title="Retirer cette étape"
            onClick={(event) => {
              // Sans ça, le clic remonte à l'article et sélectionne l'étape
              // qu'on est en train de supprimer.
              event.stopPropagation();
              setAsking(true);
            }}
          >
            <TrashIcon />
            <span className="sr-only">Retirer {step.name}</span>
          </button>
        )}

        <div className="step__thread" aria-hidden="true" />
      </div>

      <div className="step__body">
        <div className="step__head">
          <h2 className="step__name">{step.name}</h2>
          <span className="step__dates">{formatStepDates(step.date_start, step.date_end)}</span>
          {/* Les nuits pilotent tout l'enchaînement : changer une nuit ici
              décale les dates de toutes les étapes suivantes.
              Les deux commandes encadrent le compte au lieu d'y être
              enfermées — elles se lisent alors comme des boutons. */}
          <span className="step__nights-group">
            {!readOnly && onNights && (
              <button
                type="button"
                className="step__nights-btn"
                // Une étape est un changement de ville ET de logement : elle
                // a au moins une nuit. Une excursion est une activité, pas une
                // étape — et le schéma le refuse depuis 0007.
                title={step.nights > 1 ? 'Une nuit de moins' : 'Une étape dure au moins une nuit'}
                disabled={step.nights <= 1}
                onClick={(event) => {
                  event.stopPropagation();
                  onNights(step.id, step.nights - 1);
                }}
              >
                −<span className="sr-only">Une nuit de moins</span>
              </button>
            )}

            <span className="step__nights">
              {step.nights} {step.nights > 1 ? 'nuits' : 'nuit'}
            </span>

            {!readOnly && onNights && (
              <button
                type="button"
                className="step__nights-btn"
                title="Une nuit de plus"
                onClick={(event) => {
                  event.stopPropagation();
                  onNights(step.id, step.nights + 1);
                  setNightsAdded((count) => count + 1);
                }}
              >
                +<span className="sr-only">Une nuit de plus</span>
              </button>
            )}
          </span>

          {/* Seulement sur la nuit ajoutee : retirer une nuit, c'est raccourcir
              le voyage, et le moment se prete moins au compliment. */}
          <LoveNote kind="nights" seed={step.id} trigger={nightsAdded} />

          {/* Le reste à faire, visible depuis la ville. Le placement lui-même
              se fait dans la vue Jour par jour du voyage : c'est là que vit
              le programme, une seule fois, toutes villes confondues. */}
          {toPlace > 0 && (
            <span
              className="step__toplace"
              title="Items de cette ville sans jour : ils se placent dans la vue Jour par jour"
            >
              {toPlace} à placer
            </span>
          )}
        </div>

        <p className="step__lodging" data-empty={lodging ? undefined : true}>
          <span className="step__lodging-dot" data-cat="hotel" aria-hidden="true" />
          {lodging ? (
            <>
              <span className="step__lodging-name">{lodging.title}</span>
              {candidates > 1 && (
                <span className="step__lodging-count">
                  +{candidates - 1} candidat{candidates > 2 ? 's' : ''}
                </span>
              )}
              {lodging.booked && <span className="step__lodging-badge">réservé</span>}
            </>
          ) : (
            <span className="step__lodging-name">Logement à trouver</span>
          )}
        </p>

        {/* Une étape ajoutée depuis l'app n'a pas de coordonnées : elle
            n'apparaît ni sur la carte, ni comme ancre de ses items. Une étape
            située avant Google (seed, Nominatim, saisie à la main) n'est pas
            reliée : sa position peut être fausse — Shirakawa, géocodée dans
            le Fukushima — et la relier la corrige. Le bouton disparaît une
            fois l'étape reliée. */}
        {!readOnly && (step.lat == null || !step.place_id) && (
          <div className="step__locate-row">
            <button
              type="button"
              className="step__locate"
              onClick={(event) => {
                event.stopPropagation();
                setLocating((value) => !value);
              }}
            >
              {step.lat == null ? 'Situer sur la carte' : 'Relier à Google'}
            </button>
          </div>
        )}

        {locating && (
          <div onClick={(event) => event.stopPropagation()}>
            <PlaceSearch
              title={step.name}
              stepName={step.name}
              // Aucune référence des 50 km : une étape EST la référence. La
              // recherche s'oriente autour de l'étape voisine, qui met la
              // bonne Shirakawa ou le bon Miyajima en tête.
              near={null}
              bias={aroundStep}
              biasName={aroundStep?.name}
              forStep
              onCancel={() => setLocating(false)}
              onSave={async (point) => {
                await setStepCoordinates(step.id, point);
                await onChanged();
                setLocating(false);
              }}
            />
          </div>
        )}

        <PhotoStrip items={step.items} />

        {/* La ville, c'est le garde-manger : ce qu'on aimerait y faire, rangé
            par catégorie. Le menu — quel jour, à quel moment — se compose
            dans la vue Jour par jour du voyage. */}
        <div className="step__cats">
          {CATEGORIES.map((category) => (
            <CategoryAccordion
              key={category.key}
              category={category}
              items={itemsByCategory.get(category.key)}
              step={step}
              readOnly={readOnly}
              onChanged={onChanged}
            />
          ))}
        </div>

        {/* Le trajet vers l'étape suivante, en pied de carte : il appartient à
            l'intervalle, pas à l'étape d'arrivée. */}
        <div onClick={(event) => event.stopPropagation()}>
          <ConfirmDialog
            open={asking}
            title={`Retirer ${step.name} ?`}
            confirmLabel="Retirer l'étape"
            busy={removing}
            onCancel={() => setAsking(false)}
            onConfirm={() => {
              setRemoving(true);
              onRemove(step.id).finally(() => {
                setRemoving(false);
                setAsking(false);
              });
            }}
          >
            <p>
              Ses <strong>{step.items.length} item{step.items.length > 1 ? 's' : ''}</strong> seront
              supprimés, ainsi que les trajets qui relient cette étape à ses voisines.
            </p>
            <p>
              Les dates des étapes suivantes se décaleront pour recoller
              l'itinéraire. Cette action est définitive.
            </p>
          </ConfirmDialog>
        </div>
      </div>
    </article>
  );
}
