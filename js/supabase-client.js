// js/supabase-client.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

if (!window.PUBLIC_ENV) {
  throw new Error('PUBLIC_ENV not loaded. Include /js/public-config.js before this script.');
}

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.PUBLIC_ENV;
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

// expose for legacy scripts
window.supabase = supabase;
window.supabaseClient = { getClient: () => supabase };

