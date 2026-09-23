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
  loveNotes: true,
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
    // Le retour n'est pas un détail du décor : c'est lui qui ferme la fenêtre
    // du voyage, et c'est sous lui que s'affiche l'un des mots d'amour.
    {
      id: 'f2',
      direction: 'retour',
      from_code: 'HND',
      to_code: 'CDG',
      date: '2026-11-11',
      dep: '11:45:00',
      arr: '17:20:00',
      arrival_offset_days: 0,
      airline: null,
      flight_no: 'AF275',
      ref: null,
      price: null,
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

  // Kyoto n'a aucun item : son bandeau photo est donc vide. Il annonçait
  // « photos de Kyoto à déposer ici », ce qui laissait croire qu'on attendait
  // des photos DE LA VILLE, à téléverser soi-même. Les deux sont faux.
  it('montre trois emplacements plutôt qu’une invitation à déposer', () => {
    const html = render({ readOnly: false });

    expect(html).not.toContain('à déposer ici');
    expect(html).toContain('photo-strip__hole');
    // Sans apostrophe : React les échappe en `&#x27;`, y compris dans le texte.
    // L'assertion porterait sur la typographie, pas sur le rendu.
    expect(html).toContain('Les items mis en avant');
    expect(html).toContain('prendront ces');
  });

  // --- Les mots d'amour ------------------------------------------------------
  //
  // Ils sont écrits pour deux. Un itinéraire envoyé à la famille ne doit pas
  // les afficher. Le contrôle porte sur les CLASSES et non sur le texte : les
  // phrases sont tirées au hasard, une assertion sur l'une d'elles ne dirait
  // rien des six autres.
  //
  // Sept textes sont concernés, dans six composants. C'est précisément parce
  // qu'ils sont dispersés que ce test existe : en ajouter un huitième sans
  // passer par le contexte rouvrirait la fuite en silence.

  const MOTS = [
    'trip-header__vow', // le compte à rebours de l'en-tête
    'hero__line', // les deux lignes du bandeau
    'hero__sub',
    'flights__hint', // l'en-tête du panneau des vols
    'flight__note', // sous le vol retour
    'love-note', // le proverbe du pied de page
  ];

  it('affiche les mots d’amour chez soi', () => {
    const html = render({ readOnly: false });
    for (const mot of MOTS) expect(html).toContain(mot);
  });

  it('ne laisse aucun mot d’amour partir dans le lien de partage', () => {
    const html = render({ readOnly: true, shared: true });
    for (const mot of MOTS) expect(html).not.toContain(mot);
  });

  // Le drapeau est PAR VOYAGE : l'app sert désormais à quelqu'un d'autre, sur
  // son propre itinéraire, et les mots y seraient déplacés.
  it('se tait sur un voyage qui désactive les mots d’amour', () => {
    const html = render({ readOnly: false, trip: { ...trip, loveNotes: false } });
    for (const mot of MOTS) expect(html).not.toContain(mot);
  });

  // Un cache écrit avant la migration n'a pas le champ : on retombe sur le
  // défaut du schéma plutôt que de faire taire un voyage qui parle.
  it('parle quand le voyage ne dit rien du drapeau', () => {
    const { loveNotes, ...sansDrapeau } = { ...trip, loveNotes: undefined };
    const html = render({ readOnly: false, trip: sansDrapeau });
    for (const mot of MOTS) expect(html).toContain(mot);
  });

  // Le mot doux des temps de trajet SERT de titre : le retirer laisserait le
  // bloc sans en-tête, donc il est remplacé et non supprimé.
  it('remplace le titre des temps de trajet au lieu de le retirer', () => {
    expect(render({ readOnly: true, shared: true })).toContain('Temps de trajet');
  });

  // Hors ligne dans un train japonais, l'app est en lecture seule et on est
  // toujours à deux : c'est `shared` qui coupe, pas `readOnly`.
  it('garde les mots d’amour en lecture seule non partagée', () => {
    const html = render({ readOnly: true });
    for (const mot of MOTS) expect(html).toContain(mot);
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
