import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import TripNotes from './TripNotes.jsx';

const trip = {
  id: 'trip-1',
  notes: [
    { id: 'n1', body: 'Acheter le JR Pass', created_at: '2026-11-01T09:00:00Z' },
    { id: 'n2', body: 'Réserver le kaiseki\nà Kyoto', created_at: '2026-11-02T18:30:00Z' },
  ],
};

const render = (props) => renderToString(<TripNotes trip={trip} onChanged={() => {}} {...props} />);

describe('TripNotes', () => {
  it('empile les notes dans l’ordre reçu, puis le formulaire', () => {
    const html = render({ readOnly: false });
    expect(html.indexOf('Acheter le JR Pass')).toBeLessThan(html.indexOf('Réserver le kaiseki'));
    expect(html.indexOf('Réserver le kaiseki')).toBeLessThan(html.indexOf('<textarea'));
    expect(html).toContain('Ajouter');
  });

  it('ne propose ni saisie ni suppression en lecture seule', () => {
    const html = render({ readOnly: true });
    expect(html).toContain('Acheter le JR Pass');
    expect(html).not.toContain('<textarea');
    expect(html).not.toContain('notes__delete');
  });

  it('dit qu’il n’y a encore rien', () => {
    const html = renderToString(<TripNotes trip={{ id: 'trip-1' }} readOnly={false} onChanged={() => {}} />);
    expect(html).toContain('Aucune note');
  });
});
