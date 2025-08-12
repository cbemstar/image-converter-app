// auth-config.js - Unified authentication configuration

// Authentication configuration
export const AUTH_CONFIG = {
  // Supabase configuration (loaded from PUBLIC_ENV)
  getSupabaseConfig() {
    if (!window.PUBLIC_ENV) {
      throw new Error('PUBLIC_ENV not loaded');
    }
    
    return {
      url: window.PUBLIC_ENV.SUPABASE_URL,
      anonKey: window.PUBLIC_ENV.SUPABASE_ANON_KEY
    };
  },
  
  // OAuth configuration
  getOAuthConfig() {
    return window.OAUTH_CONFIG || {};
  },
  
  // Auth settings
  settings: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  
  // Quota settings
  quota: {
    guest: {
      limit: 3,
      resetHours: 24
    },
    free: {
      limit: 10,
      resetMonthly: true
    },
    pro: {
      limit: 1000,
      resetMonthly: true
    },
    unlimited: {
      limit: -1
    }
  }
};

// Initialize authentication system
export async function initializeAuth() {
  // Wait for configuration to load
  while (!window.PUBLIC_ENV) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  const config = AUTH_CONFIG.getSupabaseConfig();
  
  // Import Supabase client
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  
  // Create client
  const supabaseClient = createClient(config.url, config.anonKey, {
    auth: AUTH_CONFIG.settings
  });
  
  // Make available globally
  window.supabaseClient = { getClient: () => supabaseClient };
  
  return supabaseClient;
}
