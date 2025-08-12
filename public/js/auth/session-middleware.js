/**
 * Session Middleware for Authentication
 * Handles session refresh, cookie management, and authentication state
 */

import { createClient } from './supabase-client.js';

class SessionMiddleware {
  constructor() {
    this.supabase = createClient();
    this.refreshTimer = null;
    this.isRefreshing = false;
    this.sessionListeners = [];
    
    this.initialize();
  }

  /**
   * Initialize session middleware
   */
  async initialize() {
    try {
      // Set up auth state change listener
      this.supabase.auth.onAuthStateChange((event, session) => {
        this.handleAuthStateChange(event, session);
      });

      // Get initial session
      const { data: { session }, error } = await this.supabase.auth.getSession();
      if (error) {
        console.error('Error getting initial session:', error);
      } else if (session) {
        this.setupSessionRefresh(session);
      }

      console.log('Session middleware initialized');
    } catch (error) {
      console.error('Session middleware initialization error:', error);
    }
  }

  /**
   * Handle authentication state changes
   */
  handleAuthStateChange(event, session) {
    console.log('Session middleware: Auth state changed:', event);
    
    switch (event) {
      case 'SIGNED_IN':
        this.handleSignIn(session);
        break;
      case 'SIGNED_OUT':
        this.handleSignOut();
        break;
      case 'TOKEN_REFRESHED':
        this.handleTokenRefresh(session);
        break;
      case 'USER_UPDATED':
        this.handleUserUpdate(session);
        break;
    }

    // Notify listeners
    this.notifySessionListeners(event, session);
  }

  /**
   * Handle successful sign in
   */
  handleSignIn(session) {
    if (!session) return;
    
    console.log('Session middleware: User signed in');
    this.setupSessionRefresh(session);
    this.updateSecurityHeaders();
  }

  /**
   * Handle sign out
   */
  handleSignOut() {
    console.log('Session middleware: User signed out');
    this.clearSessionRefresh();
    this.clearSecurityCookies();
  }

  /**
   * Handle token refresh
   */
  handleTokenRefresh(session) {
    if (!session) return;
    
    console.log('Session middleware: Token refreshed');
    this.setupSessionRefresh(session);
    this.rotateSessionToken(session);
  }

  /**
   * Handle user update
   */
  handleUserUpdate(session) {
    if (!session) return;
    
    console.log('Session middleware: User updated');
    // Rotate session token on privilege changes
    this.rotateSessionToken(session);
  }

  /**
   * Set up automatic session refresh
   */
  setupSessionRefresh(session) {
    this.clearSessionRefresh();
    
    if (!session?.expires_at) return;
    
    const expiresAt = new Date(session.expires_at * 1000);
    const now = new Date();
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();
    
    // Refresh 5 minutes before expiry
    const refreshTime = Math.max(timeUntilExpiry - (5 * 60 * 1000), 60 * 1000);
    
    this.refreshTimer = setTimeout(() => {
      this.refreshSession();
    }, refreshTime);
    
    console.log(`Session refresh scheduled in ${Math.round(refreshTime / 1000)} seconds`);
  }

  /**
   * Clear session refresh timer
   */
  clearSessionRefresh() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Refresh the current session
   */
  async refreshSession() {
    if (this.isRefreshing) return;
    
    this.isRefreshing = true;
    
    try {
      console.log('Session middleware: Refreshing session');
      
      const { data: { session }, error } = await this.supabase.auth.refreshSession();
      
      if (error) {
        console.error('Session refresh error:', error);
        // If refresh fails, sign out the user
        await this.supabase.auth.signOut();
      } else if (session) {
        console.log('Session refreshed successfully');
        this.setupSessionRefresh(session);
      }
    } catch (error) {
      console.error('Session refresh exception:', error);
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Rotate session token for security
   */
  async rotateSessionToken(session) {
    try {
      console.log('Session middleware: Rotating session token');
      
      // Force a token refresh to get new tokens
      const { data: { session: newSession }, error } = await this.supabase.auth.refreshSession();
      
      if (error) {
        console.error('Token rotation error:', error);
      } else if (newSession) {
        console.log('Session token rotated successfully');
        this.updateSecurityHeaders();
      }
    } catch (error) {
      console.error('Token rotation exception:', error);
    }
  }

  /**
   * Update security headers and cookies
   */
  updateSecurityHeaders() {
    // Set security-related meta tags
    this.setSecurityMeta();
    
    // Update CSRF token if needed
    this.updateCSRFToken();
  }

  /**
   * Set security-related meta tags
   */
  setSecurityMeta() {
    // Content Security Policy
    let cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (!cspMeta) {
      cspMeta = document.createElement('meta');
      cspMeta.setAttribute('http-equiv', 'Content-Security-Policy');
      document.head.appendChild(cspMeta);
    }
    
    cspMeta.setAttribute('content', 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' https://esm.sh https://cdn.jsdelivr.net; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "connect-src 'self' https://*.supabase.co https://api.stripe.com; " +
      "frame-src https://js.stripe.com https://checkout.stripe.com;"
    );

    // X-Frame-Options
    let frameMeta = document.querySelector('meta[http-equiv="X-Frame-Options"]');
    if (!frameMeta) {
      frameMeta = document.createElement('meta');
      frameMeta.setAttribute('http-equiv', 'X-Frame-Options');
      frameMeta.setAttribute('content', 'DENY');
      document.head.appendChild(frameMeta);
    }

    // X-Content-Type-Options
    let contentTypeMeta = document.querySelector('meta[http-equiv="X-Content-Type-Options"]');
    if (!contentTypeMeta) {
      contentTypeMeta = document.createElement('meta');
      contentTypeMeta.setAttribute('http-equiv', 'X-Content-Type-Options');
      contentTypeMeta.setAttribute('content', 'nosniff');
      document.head.appendChild(contentTypeMeta);
    }
  }

  /**
   * Update CSRF token
   */
  updateCSRFToken() {
    const token = this.generateCSRFToken();
    
    // Store in meta tag
    let csrfMeta = document.querySelector('meta[name="csrf-token"]');
    if (!csrfMeta) {
      csrfMeta = document.createElement('meta');
      csrfMeta.setAttribute('name', 'csrf-token');
      document.head.appendChild(csrfMeta);
    }
    csrfMeta.setAttribute('content', token);
    
    // Store in sessionStorage for API requests
    sessionStorage.setItem('csrf-token', token);
  }

  /**
   * Generate CSRF token
   */
  generateCSRFToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Clear security cookies on sign out
   */
  clearSecurityCookies() {
    // Clear CSRF token
    sessionStorage.removeItem('csrf-token');
    
    // Clear any other security-related storage
    sessionStorage.removeItem('session-fingerprint');
    localStorage.removeItem('auth-preferences');
  }

  /**
   * Detect potential session hijacking
   */
  detectSessionHijacking(session) {
    if (!session) return false;
    
    try {
      // Check browser fingerprint
      const currentFingerprint = this.generateBrowserFingerprint();
      const storedFingerprint = sessionStorage.getItem('session-fingerprint');
      
      if (storedFingerprint && storedFingerprint !== currentFingerprint) {
        console.warn('Session middleware: Potential session hijacking detected');
        return true;
      }
      
      // Store fingerprint for new sessions
      if (!storedFingerprint) {
        sessionStorage.setItem('session-fingerprint', currentFingerprint);
      }
      
      return false;
    } catch (error) {
      console.error('Error detecting session hijacking:', error);
      return false;
    }
  }

  /**
   * Generate browser fingerprint for session security
   */
  generateBrowserFingerprint() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Browser fingerprint', 2, 2);
    
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL()
    ].join('|');
    
    // Simple hash
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString(36);
  }

  /**
   * Add session listener
   */
  addSessionListener(callback) {
    this.sessionListeners.push(callback);
  }

  /**
   * Remove session listener
   */
  removeSessionListener(callback) {
    this.sessionListeners = this.sessionListeners.filter(listener => listener !== callback);
  }

  /**
   * Notify session listeners
   */
  notifySessionListeners(event, session) {
    this.sessionListeners.forEach(callback => {
      try {
        callback(event, session);
      } catch (error) {
        console.error('Error in session listener:', error);
      }
    });
  }

  /**
   * Get current session
   */
  async getCurrentSession() {
    try {
      const { data: { session }, error } = await this.supabase.auth.getSession();
      if (error) throw error;
      return session;
    } catch (error) {
      console.error('Error getting current session:', error);
      return null;
    }
  }

  /**
   * Check if session is valid and not expired
   */
  isSessionValid(session) {
    if (!session) return false;
    
    const now = Math.floor(Date.now() / 1000);
    return session.expires_at > now;
  }

  /**
   * Force session cleanup
   */
  async cleanup() {
    this.clearSessionRefresh();
    this.clearSecurityCookies();
    this.sessionListeners = [];
    
    try {
      await this.supabase.auth.signOut();
    } catch (error) {
      console.error('Error during session cleanup:', error);
    }
  }
}

// Create global instance
let sessionMiddleware = null;

export const getSessionMiddleware = () => {
  if (!sessionMiddleware) {
    sessionMiddleware = new SessionMiddleware();
  }
  return sessionMiddleware;
};

// Initialize on load
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    getSessionMiddleware();
  });
}

export default SessionMiddleware;