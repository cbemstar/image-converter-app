// js/supabase-client.js
// Updated to use @supabase/ssr for secure cookie handling
import { createClient } from './auth/supabase-client.js';

// Create the main client instance
export const supabase = createClient();

// Expose for legacy scripts
window.supabase = supabase;
window.supabaseClient = { getClient: () => supabase };

// Initialize authentication utilities
import('./auth/auth-utils.js').then(({ getAuthUtils }) => {
  const authUtils = getAuthUtils();
  
  // Expose auth utilities globally for legacy compatibility
  window.authUtils = authUtils;
  window.auth = authUtils;
  
  console.log('Supabase client with SSR support initialized');
}).catch(error => {
  console.error('Error initializing auth utilities:', error);
});

