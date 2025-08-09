// js/supabase-client.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

if (!window.PUBLIC_ENV) {
  console.error('window.PUBLIC_ENV is missing. Ensure /js/public-config.js loads before /js/supabase-client.js');
  throw new Error('Missing PUBLIC_ENV');
}

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.PUBLIC_ENV;
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

// expose for legacy scripts
window.supabase = supabase;
window.supabaseClient = { getClient: () => supabase };

