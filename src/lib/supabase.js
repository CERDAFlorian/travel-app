import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const missing = [
  !url && 'VITE_SUPABASE_URL',
  !anonKey && 'VITE_SUPABASE_ANON_KEY',
].filter(Boolean);

// Échec immédiat et explicite : un client null se propagerait en « cannot read
// properties of null » à des dizaines de lignes de la vraie cause.
if (missing.length > 0) {
  throw new Error(
    `Configuration Supabase absente : ${missing.join(', ')}. ` +
      'Copie .env.example vers .env.local et renseigne les valeurs du projet.',
  );
}

export const supabase = createClient(url, anonKey);

// QUELLE BASE ? En développement seulement.
//
// Deux projets Supabase coexistent : dev et prod. Rien à l'écran ne dit lequel
// on lit, et se tromper de base est exactement l'accident contre lequel cette
// séparation existe — appliquer une migration, rejouer un seed, effacer une
// étape en croyant être ailleurs. Le ref du projet s'affiche donc une fois au
// démarrage, dans la console.
//
// En production le message ne sort pas : il n'apprendrait rien et exposerait
// le ref à qui ouvre les outils de développement.
if (import.meta.env.DEV) {
  try {
    console.info(`[supabase] base « ${new URL(url).hostname.split('.')[0]} »`);
  } catch {
    // Une URL mal formée fera échouer le premier appel avec un message clair.
    // Ce n'est pas à ce repère de faire tomber le démarrage.
  }
}
