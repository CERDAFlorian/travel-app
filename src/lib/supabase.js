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
