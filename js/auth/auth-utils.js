/**
 * Authentication Utilities with SSR Support
 * Main entry point for authentication functionality with secure cookie handling
 */

import { createClient } from './supabase-client.js';
import { getSessionMiddleware } from './session-middleware.js';
import { getAuthProviders } from './auth-providers.js';
import { getCookieConfig } from './cookie-config.js';

class AuthUtils {
  constructor() {
    this.supabase = createClient();
    this.sessionMiddleware = getSessionMiddleware();
    this.authProviders = getAuthProviders();
    this.cookieConfig = getCookieConfig();
    
    this.currentUser = null;
    this.currentSession = null;
    this.isInitialized = false;
    this.authStateListeners = [];
    
    this.initialize();
  }

  /**
   * Initialize authentication utilities
   */
  async initialize() {
    try {
      console.log('AuthUtils: Initializing...');
      
      // Set up auth state change listener
      this.supabase.auth.onAuthStateChange((event, session) => {
        this.handleAuthStateChange(event, session);
      });

      // Get initial session
      const { data: { session }, error } = await this.supabase.auth.getSession();
      if (error) {
        console.error('Error getting initial session:', error);
      } else {
        this.currentSession = session;
        this.currentUser = session?.user || null;
      }

      // Add session middleware listener
      this.sessionMiddleware.addSessionListener((event, session) => {
        this.handleSessionMiddlewareEvent(event, session);
      });

      this.isInitialized = true;
      this.notifyAuthStateListeners('initialized', this.currentSession);
      
      console.log('AuthUtils: Initialized successfully');
    } catch (error) {
      console.error('AuthUtils initialization error:', error);
    }
  }

  /**
   * Handle authentication state changes
   */
  handleAuthStateChange(event, session) {
    console.log('AuthUtils: Auth state changed:', event);
    
    this.currentSession = session;
    this.currentUser = session?.user || null;
    
    // Handle specific events
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
    this.notifyAuthStateListeners(event, session);
  }

  /**
   * Handle session middleware events
   */
  handleSessionMiddlewareEvent(event, session) {
    // Additional handling for session middleware events
    if (event === 'TOKEN_REFRESHED') {
      console.log('AuthUtils: Token refreshed via middleware');
    }
  }

  /**
   * Handle successful sign in
   */
  async handleSignIn(session) {
    try {
      console.log('AuthUtils: User signed in');
      
      // Ensure user profile exists
      await this.ensureUserProfile(session.user);
      
      // Set secure authentication cookies
      this.setAuthenticationCookies(session);
      
      // Handle redirect if needed
      this.handlePostAuthRedirect();
      
    } catch (error) {
      console.error('Error handling sign in:', error);
    }
  }

  /**
   * Handle sign out
   */
  handleSignOut() {
    console.log('AuthUtils: User signed out');
    
    // Clear authentication cookies
    this.cookieConfig.clearAuthCookies();
    this.cookieConfig.clearSecureCookies();
    
    // Clear user data
    this.clearUserData();
  }

  /**
   * Handle token refresh
   */
  handleTokenRefresh(session) {
    console.log('AuthUtils: Token refreshed');
    
    // Update authentication cookies
    this.setAuthenticationCookies(session);
  }

  /**
   * Handle user update
   */
  handleUserUpdate(session) {
    console.log('AuthUtils: User updated');
    
    // Refresh user profile if needed
    this.refreshUserProfile(session.user);
  }

  /**
   * Sign in with email and password
   */
  async signInWithEmail(email, password, options = {}) {
    try {
      const result = await this.authProviders.signInWithEmail(email, password, options);
      return result;
    } catch (error) {
      console.error('AuthUtils: Email sign in error:', error);
      throw error;
    }
  }

  /**
   * Sign up with email and password
   */
  async signUpWithEmail(email, password, options = {}) {
    try {
      const result = await this.authProviders.signUpWithEmail(email, password, options);
      return result;
    } catch (error) {
      console.error('AuthUtils: Email sign up error:', error);
      throw error;
    }
  }

  /**
   * Sign in with Google
   */
  async signInWithGoogle(options = {}) {
    try {
      const result = await this.authProviders.signInWithGoogle(options);
      return result;
    } catch (error) {
      console.error('AuthUtils: Google sign in error:', error);
      throw error;
    }
  }

  /**
   * Sign in with GitHub
   */
  async signInWithGitHub(options = {}) {
    try {
      const result = await this.authProviders.signInWithGitHub(options);
      return result;
    } catch (error) {
      console.error('AuthUtils: GitHub sign in error:', error);
      throw error;
    }
  }

  /**
   * Reset password
   */
  async resetPassword(email, options = {}) {
    try {
      const result = await this.authProviders.resetPassword(email, options);
      return result;
    } catch (error) {
      console.error('AuthUtils: Password reset error:', error);
      throw error;
    }
  }

  /**
   * Update password
   */
  async updatePassword(newPassword, options = {}) {
    try {
      const result = await this.authProviders.updatePassword(newPassword, options);
      return result;
    } catch (error) {
      console.error('AuthUtils: Password update error:', error);
      throw error;
    }
  }

  /**
   * Sign out current user
   */
  async signOut() {
    try {
      const result = await this.authProviders.signOut();
      return result;
    } catch (error) {
      console.error('AuthUtils: Sign out error:', error);
      throw error;
    }
  }

  /**
   * Set authentication cookies securely
   */
  setAuthenticationCookies(session) {
    if (!session) return;

    try {
      // Set access token cookie
      if (session.access_token) {
        this.cookieConfig.setAuthCookie('sb-access-token', session.access_token, {
          maxAge: 60 * 60 // 1 hour
        });
      }

      // Set refresh token cookie (more secure)
      if (session.refresh_token) {
        this.cookieConfig.setSecureCookie('sb-refresh-token', session.refresh_token, {
          maxAge: 60 * 60 * 24 * 7 // 7 days
        });
      }

      // Set session metadata
      this.cookieConfig.setSessionCookie('auth-session-meta', JSON.stringify({
        userId: session.user.id,
        email: session.user.email,
        expiresAt: session.expires_at
      }));

      console.log('Authentication cookies set successfully');
    } catch (error) {
      console.error('Error setting authentication cookies:', error);
    }
  }

  /**
   * Ensure user profile exists in database
   */
  async ensureUserProfile(user) {
    try {
      // This will be implemented when we have the database schema
      // For now, just log the user info
      console.log('User profile check for:', user.email);
      
      // TODO: Implement profile creation/update logic
      // const { data, error } = await this.supabase
      //   .from('profiles')
      //   .upsert({
      //     id: user.id,
      //     email: user.email,
      //     full_name: user.user_metadata?.full_name,
      //     avatar_url: user.user_metadata?.avatar_url,
      //     email_verified: user.email_confirmed_at !== null,
      //     updated_at: new Date().toISOString()
      //   });
      
    } catch (error) {
      console.error('Error ensuring user profile:', error);
    }
  }

  /**
   * Refresh user profile data
   */
  async refreshUserProfile(user) {
    try {
      // TODO: Implement profile refresh logic
      console.log('Refreshing user profile for:', user.email);
    } catch (error) {
      console.error('Error refreshing user profile:', error);
    }
  }

  /**
   * Handle post-authentication redirect
   */
  handlePostAuthRedirect() {
    const redirectUrl = sessionStorage.getItem('auth_redirect');
    
    if (redirectUrl && redirectUrl !== window.location.href) {
      sessionStorage.removeItem('auth_redirect');
      console.log('Redirecting to:', redirectUrl);
      
      setTimeout(() => {
        window.location.href = redirectUrl;
      }, 100);
    }
  }

  /**
   * Clear user data on sign out
   */
  clearUserData() {
    // Clear session storage
    sessionStorage.removeItem('auth_redirect');
    sessionStorage.removeItem('tool_page_state');
    sessionStorage.removeItem('csrf-token');
    sessionStorage.removeItem('session-fingerprint');
    
    // Clear local storage
    localStorage.removeItem('user_preferences');
    localStorage.removeItem('recent_files');
    
    console.log('User data cleared');
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Get current session
   */
  getCurrentSession() {
    return this.currentSession;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.currentUser && !!this.currentSession;
  }

  /**
   * Check if user's email is verified
   */
  isEmailVerified() {
    return this.currentUser?.email_confirmed_at !== null;
  }

  /**
   * Require authentication for protected features
   */
  requireAuth(redirectToAuth = true) {
    if (!this.isAuthenticated()) {
      if (redirectToAuth) {
        this.redirectToAuth();
      }
      return false;
    }
    return true;
  }

  /**
   * Require email verification for paid features
   */
  requireEmailVerification(showMessage = true) {
    if (!this.isEmailVerified()) {
      if (showMessage) {
        this.showMessage('Please verify your email address to access this feature.', 'warning');
      }
      return false;
    }
    return true;
  }

  /**
   * Redirect to authentication page
   */
  redirectToAuth() {
    // Store current URL for post-auth redirect
    sessionStorage.setItem('auth_redirect', window.location.href);
    
    // Calculate path to auth page
    const authPath = this.calculateAuthPath();
    window.location.href = authPath;
  }

  /**
   * Calculate correct path to auth page
   */
  calculateAuthPath() {
    const pathDepth = window.location.pathname.split('/').length - 2;
    const basePath = pathDepth > 1 ? '../'.repeat(pathDepth - 1) : './';
    return `${basePath}auth.html`;
  }

  /**
   * Add authentication state listener
   */
  addAuthStateListener(callback) {
    this.authStateListeners.push(callback);
  }

  /**
   * Remove authentication state listener
   */
  removeAuthStateListener(callback) {
    this.authStateListeners = this.authStateListeners.filter(listener => listener !== callback);
  }

  /**
   * Notify authentication state listeners
   */
  notifyAuthStateListeners(event, session) {
    this.authStateListeners.forEach(callback => {
      try {
        callback(event, session, this.currentUser);
      } catch (error) {
        console.error('Error in auth state listener:', error);
      }
    });
  }

  /**
   * Show message to user
   */
  showMessage(message, type = 'info') {
    // Try to use existing toast system
    if (window.showToast) {
      window.showToast(message, type);
    } else {
      console.log(`Auth ${type}:`, message);
    }
  }

  /**
   * Get authentication status summary
   */
  getAuthStatus() {
    return {
      isAuthenticated: this.isAuthenticated(),
      isEmailVerified: this.isEmailVerified(),
      user: this.currentUser,
      session: this.currentSession,
      isInitialized: this.isInitialized
    };
  }

  /**
   * Validate authentication configuration
   */
  validateConfig() {
    const issues = [];
    
    // Check cookie configuration
    const cookieValidation = this.cookieConfig.validateCookieSecurity();
    if (!cookieValidation.isValid) {
      issues.push(...cookieValidation.issues);
    }
    
    // Check provider configuration
    const providerValidation = this.authProviders.validateProviderConfig();
    if (!providerValidation.isValid) {
      issues.push(...providerValidation.issues);
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }
}

// Create global instance
let authUtils = null;

export const getAuthUtils = () => {
  if (!authUtils) {
    authUtils = new AuthUtils();
  }
  return authUtils;
};

// Initialize on load
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    const auth = getAuthUtils();
    
    // Expose to global scope for legacy compatibility
    window.authUtils = auth;
    window.auth = auth; // Shorter alias
  });
}

export default AuthUtils;