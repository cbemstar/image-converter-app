/**
 * Supabase Client Utilities with SSR Support
 * Provides secure client-side and server-side Supabase clients with proper cookie handling
 */

import { createBrowserClient, createServerClient } from '@supabase/ssr';

// Get environment configuration
const getSupabaseConfig = () => {
  if (typeof window !== 'undefined') {
    // Browser environment
    if (!window.PUBLIC_ENV) {
      throw new Error('PUBLIC_ENV not loaded. Include /js/public-config.js before this script.');
    }
    return {
      url: window.PUBLIC_ENV.SUPABASE_URL,
      anonKey: window.PUBLIC_ENV.SUPABASE_ANON_KEY
    };
  } else {
    // Server environment (for future Edge Functions)
    return {
      url: process.env.SUPABASE_URL || Deno?.env?.get('SUPABASE_URL'),
      anonKey: process.env.SUPABASE_ANON_KEY || Deno?.env?.get('SUPABASE_ANON_KEY')
    };
  }
};

/**
 * Create browser client with secure cookie configuration
 * Used for client-side operations in the browser
 */
export const createClient = () => {
  const config = getSupabaseConfig();
  
  return createBrowserClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce'
    },
    cookies: {
      get(name) {
        return getCookie(name);
      },
      set(name, value, options) {
        setCookie(name, value, {
          ...options,
          httpOnly: false, // Browser client needs access
          secure: window.location.protocol === 'https:',
          sameSite: 'lax',
          path: '/',
          maxAge: options.maxAge || 60 * 60 * 24 * 7 // 7 days default
        });
      },
      remove(name, options) {
        removeCookie(name, {
          ...options,
          path: '/',
          secure: window.location.protocol === 'https:',
          sameSite: 'lax'
        });
      }
    }
  });
};

/**
 * Create server client for server-side operations
 * Used in Edge Functions and server-side rendering
 */
export const createServerClient = (request, response) => {
  const config = getSupabaseConfig();
  
  return createServerClient(config.url, config.anonKey, {
    auth: {
      flowType: 'pkce'
    },
    cookies: {
      get(name) {
        return getServerCookie(request, name);
      },
      set(name, value, options) {
        setServerCookie(response, name, value, {
          ...options,
          httpOnly: true, // Server cookies should be HTTP-only
          secure: true, // Always secure in production
          sameSite: 'strict', // Stricter for server-side
          path: '/',
          maxAge: options.maxAge || 60 * 60 * 24 * 7 // 7 days default
        });
      },
      remove(name, options) {
        removeServerCookie(response, name, {
          ...options,
          path: '/',
          secure: true,
          sameSite: 'strict',
          httpOnly: true
        });
      }
    }
  });
};

/**
 * Create service role client for administrative operations
 * Only use in secure server environments
 */
export const createServiceClient = () => {
  const config = getSupabaseConfig();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || Deno?.env?.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!serviceKey) {
    throw new Error('Service role key not available');
  }
  
  return createBrowserClient(config.url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
};

// Cookie utility functions for browser environment
const getCookie = (name) => {
  if (typeof document === 'undefined') return null;
  
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop().split(';').shift();
  }
  return null;
};

const setCookie = (name, value, options = {}) => {
  if (typeof document === 'undefined') return;
  
  let cookieString = `${name}=${value}`;
  
  if (options.maxAge) {
    cookieString += `; Max-Age=${options.maxAge}`;
  }
  
  if (options.path) {
    cookieString += `; Path=${options.path}`;
  }
  
  if (options.domain) {
    cookieString += `; Domain=${options.domain}`;
  }
  
  if (options.secure) {
    cookieString += '; Secure';
  }
  
  if (options.httpOnly) {
    cookieString += '; HttpOnly';
  }
  
  if (options.sameSite) {
    cookieString += `; SameSite=${options.sameSite}`;
  }
  
  document.cookie = cookieString;
};

const removeCookie = (name, options = {}) => {
  setCookie(name, '', {
    ...options,
    maxAge: 0
  });
};

// Server-side cookie utilities (for future Edge Functions)
const getServerCookie = (request, name) => {
  if (!request || !request.headers) return null;
  
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {});
  
  return cookies[name] || null;
};

const setServerCookie = (response, name, value, options = {}) => {
  if (!response || !response.headers) return;
  
  let cookieString = `${name}=${value}`;
  
  if (options.maxAge) {
    cookieString += `; Max-Age=${options.maxAge}`;
  }
  
  if (options.path) {
    cookieString += `; Path=${options.path}`;
  }
  
  if (options.domain) {
    cookieString += `; Domain=${options.domain}`;
  }
  
  if (options.secure) {
    cookieString += '; Secure';
  }
  
  if (options.httpOnly) {
    cookieString += '; HttpOnly';
  }
  
  if (options.sameSite) {
    cookieString += `; SameSite=${options.sameSite}`;
  }
  
  response.headers.set('Set-Cookie', cookieString);
};

const removeServerCookie = (response, name, options = {}) => {
  setServerCookie(response, name, '', {
    ...options,
    maxAge: 0
  });
};

// Legacy compatibility - expose the main client as default
export const supabase = createClient();

// Expose for legacy scripts
if (typeof window !== 'undefined') {
  window.supabase = supabase;
  window.supabaseClient = { getClient: () => supabase };
}