import './App.scss';

const CATEGORIES = [
  { key: 'hotel', label: 'Hôtel' },
  { key: 'activite', label: 'Activités' },
  { key: 'restaurant', label: 'Restaurants' },
  { key: 'shopping', label: 'Shopping' },
  { key: 'lieu', label: 'Lieux touristiques' },
  { key: 'note', label: 'Notes perso' },
];

export default function App() {
  return (
    <main className="app-shell">
      <section className="app-shell__card">
        <p className="eyebrow">Fondations</p>
        <h1>Itinéraire</h1>
        <p className="app-shell__intro">
          Thème actif, tokens en place. Le contenu arrive au lot suivant.
        </p>
        <ul className="app-shell__cats">
          {CATEGORIES.map(({ key, label }) => (
            <li key={key} className="app-shell__cat">
              <span className="app-shell__dot" data-cat={key} />
              {label}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
