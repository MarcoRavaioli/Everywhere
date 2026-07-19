import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Configurazione Supabase mancante: definisci VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY in .env.local'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Solo in sviluppo: espone il client in console per i test manuali
// (es. verificare che le policy Storage blocchino path altrui)
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__supabase = supabase;
}
