import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import TripView from './TripView.jsx';

// Le filet qui manquait.
//
// `npm run build` compile le JSX mais n'analyse aucune portée : une variable
// supprimée dont le JSX se sert encore passe le build, passe les 284 tests de
// logique pure, et rend un ÉCRAN BLANC au premier rendu. C'est exactement ce
// qui est arrivé en déplaçant le bouton du programme sous les vols — le lien
// précédent, resté en place, appelait un `pathname` qui n'existait plus.
//
// Ce test ne vérifie pas une mise en page : il vérifie que l'écran du voyage
// SE REND, dans ses deux lectures. C'est un contrôle grossier, et c'est
// précisément ce qu'il faut — la classe de panne qu'il attrape est celle qui
// rend l'app inutilisable.
//
// `renderToString` plutôt qu'un vrai DOM : pas de jsdom à installer, et une
// erreur de rendu lève ici tout aussi bruyamment.

const trip = {
  id: 'trip-1',
  slug: 'japon-2026',
  title: 'Japon',
  subtitle: 'Itinéraire interactif',
  theme: 'japan',
  startDate: '2026-11-07',
  endDate: '2026-11-11',
  shareToken: null,
  steps: [
    {
      id: 'step-1',
      position: 1,
      name: 'Tokyo',
      date_start: '2026-11-07',
      date_end: '2026-11-09',
      nights: 2,
      lat: 35.68,
      lng: 139.69,
      images: null,
      items: [
        {
          id: 'item-1',
          category: 'hotel',
          title: 'Hôtel à Asakusa',
          price: 34000,
          currency: 'JPY',
          booked: false,
          favorite: false,
          position: 1,
          notes: null,
          lat: null,
          lng: null,
          geocoded_at: null,
          day_offset: null,
          day_slot: null,
          day_position: 0,
          start_time: null,
        },
        {
          id: 'item-2',
          category: 'lieu',
          title: 'Temple Sensō-ji',
          price: null,
          currency: 'JPY',
          booked: true,
          favorite: true,
          position: 2,
          notes: 'ouvre tôt',
          lat: 35.71,
          lng: 139.79,
          geocoded_at: null,
          day_offset: 0,
          day_slot: 'matin',
          day_position: 1,
          start_time: '09:30:00',
        },
        // En réserve : c'est lui qui alimente le compteur de l'onglet.
        {
          id: 'item-3',
          category: 'restaurant',
          title: 'Izakaya à Shinjuku',
          price: null,
          currency: 'JPY',
          booked: false,
          favorite: false,
          position: 3,
          notes: null,
          lat: null,
          lng: null,
          geocoded_at: null,
          day_offset: null,
          day_slot: null,
          day_position: 0,
          start_time: null,
        },
      ],
    },
    {
      id: 'step-2',
      position: 2,
      name: 'Kyoto',
      date_start: '2026-11-09',
      date_end: '2026-11-11',
      nights: 2,
      lat: 35.01,
      lng: 135.77,
      images: null,
      items: [],
    },
  ],
  flights: [
    {
      id: 'f1',
      direction: 'aller',
      from_code: 'CDG',
      to_code: 'HND',
      date: '2026-11-07',
      dep: '13:30:00',
      arr: '08:20:00',
      arrival_offset_days: 0,
      airline: null,
      flight_no: 'AF274',
      ref: null,
      price: 890,
      currency: 'EUR',
      stops: null,
    },
  ],
  legs: [
    {
      id: 'l1',
      from_step: 'step-1',
      to_step: 'step-2',
      mode: 'shinkansen',
      duration_min: 140,
      note: 'Tōkaidō',
      dep: '09:12:00',
      arr: '11:32:00',
    },
  ],
  experiences: [],
};

const render = (props) =>
  renderToString(
    <MemoryRouter initialEntries={['/voyage/japon-2026']}>
      <TripView
        trip={trip}
        isOffline={false}
        syncError={null}
        lastSync={Date.now()}
        onRefresh={() => {}}
        onRequestLogin={null}
        onChanged={async () => {}}
        {...props}
      />
    </MemoryRouter>,
  );

describe('TripView', () => {
  it('se rend en édition', () => {
    const html = render({ readOnly: false });
    expect(html).toContain('Tokyo');
    expect(html).toContain('Kyoto');
  });

  // La vue partagée rend le même composant : elle doit se rendre aussi, et
  // c'est elle qu'on éprouve le moins souvent à la main.
  it('se rend en lecture seule et en partage', () => {
    const html = render({ readOnly: true, shared: true });
    expect(html).toContain('Vue partagée');
  });

  it('propose les deux lectures sous les vols', () => {
    const html = render({ readOnly: false });
    // Pas d'assertion sur un libellé à apostrophe : React l'échappe en
    // `&#x27;` dans les attributs, et le test casserait sur la typographie
    // plutôt que sur le rendu.
    expect(html).toContain('trip__mode-group');
    expect(html).toContain('Jour par jour');
    expect(html).toContain('Villes');
  });

  // Un voyage sans étape, sans vol, sans rien : l'état du premier jour.
  it('se rend sur un voyage vide', () => {
    const html = render({
      readOnly: false,
      trip: { ...trip, steps: [], flights: [], legs: [], experiences: [] },
    });
    expect(html).toContain('Japon');
  });
});
