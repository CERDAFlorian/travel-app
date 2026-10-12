// Les moments d'une journée.
//
// DES MOMENTS, PAS UNE GRILLE HORAIRE. Personne ne tient un créneau de 14h15 à
// Arashiyama : une journée se pense en « le matin Fushimi, le soir un kaiseki ».
// Quatre moments se remplissent en trois clics là où un emploi du temps à
// l'heure resterait vide, et se lisent d'un coup d'œil sur place.
//
// `journee` n'est pas un moment mais un mode : Kōyasan, c'est 2h30 de trajet,
// ça mange la journée. Il se pose donc en tête et se lit comme un bandeau —
// on doit voir que rien d'autre ne tiendra ce jour-là.
export const SLOTS = [
  { key: 'journee', label: 'Journée entière', full: true },
  { key: 'matin', label: 'Matin' },
  { key: 'midi', label: 'Midi' },
  { key: 'apres-midi', label: 'Après-midi' },
  { key: 'soir', label: 'Soir' },
];

// Un item posé avant que les moments n'existent, ou placé sans en choisir un.
// Il ne disparaît pas dans un moment arbitraire : il reste visible en pied de
// journée, à caler. Se vide tout seul à mesure qu'on range.
export const UNSLOTTED = { key: null, label: 'À caler' };
