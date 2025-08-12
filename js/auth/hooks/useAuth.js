/**
 * useAuth Hook
 * Provides authentication state and methods with callback URL preservation
 */

import { getAuthUtils } from '../auth-utils.js';

class UseAuth {
  constructor() {
    this.authUtils = getAuthUtils();
    this.listeners = [];
    this.state = {
      user: null,
      session: null,
      loading: true,
      isAuthenticated: false,
      isEmailVerified: false,
      error: null
    };
    
    this.initialize();
  }

  /**
   * Initialize the hook
   */
  async initialize() {
    try {
      // Set up auth state listener
      this.authUtils.addAuthStateListener((event, session, user) => {
        this.updateState(event, session, user);
      });

      // Get initial state
      const authStatus = this.authUtils.getAuthStatus();
      this.state = {
        ...this.state,
        user: authStatus.user,
        session: authStatus.session,
        loading: !authStatus.isInitialized,
        isAuthenticated: authStatus.isAuthenticated,
        isEmailVerified: authStatus.isEmailVerified
      };

      this.notifyListeners();
    } catch (error) {
      this.state.error = error;
      this.state.loading = false;
      this.notifyListeners();
    }
  }

  /**
   * Update state based on auth events
   */
  updateState(event, session, user) {
    const previousState = { ...this.state };
    
    this.state = {
      ...this.state,
      user,
      session,
      loading: false,
      isAuthenticated: !!user && !!session,
      isEmailVerified: user?.email_confirmed_at !== null,
      error: null
    };

    // Handle specific events
    switch (event) {
      case 'SIGNED_IN':
        this.handleSignIn(session, user);
        break;
      case 'SIGNED_OUT':
        this.handleSignOut();
        break;
      case 'TOKEN_REFRESHED':
        console.log('useAuth: Token refreshed');
        break;
    }

    // Only notify if state actually changed
    if (this.hasStateChanged(previousState, this.state)) {
      this.notifyListeners();
    }
  }

  /**
   * Handle successful sign in with callback URL preservation
   */
  handleSignIn(session, user) {
    console.log('useAuth: User signed in, handling callback URL');
    
    // Check for stored callback URL
    const callbackUrl = sessionStorage.getItem('auth_redirect');
    
    if (callbackUrl && callbackUrl !== window.location.href) {
      // Clear the stored URL
      sessionStorage.removeItem('auth_redirect');
      
      // Redirect after a short delay to ensure state is updated
      setTimeout(() => {
        console.log('useAuth: Redirecting to callback URL:', callbackUrl);
        window.location.href = callbackUrl;
      }, 100);
    }
  }

  /**
   * Handle sign out
   */
  handleSignOut() {
    console.log('useAuth: User signed out');
    
    // Clear any stored callback URLs
    sessionStorage.removeItem('auth_redirect');
    sessionStorage.removeItem('tool_page_state');
  }

  /**
   * Check if state has meaningfully changed
   */
  hasStateChanged(prevState, newState) {
    return (
      prevState.isAuthenticated !== newState.isAuthenticated ||
      prevState.isEmailVerified !== newState.isEmailVerified ||
      prevState.loading !== newState.loading ||
      prevState.user?.id !== newState.user?.id ||
      prevState.error !== newState.error
    );
  }

  /**
   * Sign in with email and password
   */
  async signIn(email, password, options = {}) {
    try {
      this.state.loading = true;
      this.state.error = null;
      this.notifyListeners();

      // Store callback URL if provided
      if (options.callbackUrl) {
        this.storeCallbackUrl(options.callbackUrl);
      }

      const result = await this.authUtils.signInWithEmail(email, password, options);
      return result;
    } catch (error) {
      this.state.error = error;
      this.state.loading = false;
      this.notifyListeners();
      throw error;
    }
  }

  /**
   * Sign up with email and password
   */
  async signUp(email, password, options = {}) {
    try {
      this.state.loading = true;
      this.state.error = null;
      this.notifyListeners();

      // Store callback URL if provided
      if (options.callbackUrl) {
        this.storeCallbackUrl(options.callbackUrl);
      }

      const result = await this.authUtils.signUpWithEmail(email, password, options);
      return result;
    } catch (error) {
      this.state.error = error;
      this.state.loading = false;
      this.notifyListeners();
      throw error;
    }
  }

  /**
   * Sign in with OAuth provider
   */
  async signInWithProvider(provider, options = {}) {
    try {
      this.state.loading = true;
      this.state.error = null;
      this.notifyListeners();

      // Store callback URL if provided
      if (options.callbackUrl) {
        this.storeCallbackUrl(options.callbackUrl);
      }

      let result;
      switch (provider) {
        case 'google':
          result = await this.authUtils.signInWithGoogle(options);
          break;
        case 'github':
          result = await this.authUtils.signInWithGitHub(options);
          break;
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }

      return result;
    } catch (error) {
      this.state.error = error;
      this.state.loading = false;
      this.notifyListeners();
      throw error;
    }
  }

  /**
   * Sign out current user
   */
  async signOut() {
    try {
      this.state.loading = true;
      this.notifyListeners();

      const result = await this.authUtils.signOut();
      return result;
    } catch (error) {
      this.state.error = error;
      this.state.loading = false;
      this.notifyListeners();
      throw error;
    }
  }

  /**
   * Reset password
   */
  async resetPassword(email, options = {}) {
    try {
      const result = await this.authUtils.resetPassword(email, options);
      return result;
    } catch (error) {
      this.state.error = error;
      this.notifyListeners();
      throw error;
    }
  }

  /**
   * Update password
   */
  async updatePassword(newPassword, options = {}) {
    try {
      const result = await this.authUtils.updatePassword(newPassword, options);
      return result;
    } catch (error) {
      this.state.error = error;
      this.notifyListeners();
      throw error;
    }
  }

  /**
   * Store callback URL for post-auth redirect
   */
  storeCallbackUrl(url) {
    const callbackUrl = url || window.location.href;
    sessionStorage.setItem('auth_redirect', callbackUrl);
    console.log('useAuth: Stored callback URL:', callbackUrl);
  }

  /**
   * Get stored callback URL
   */
  getCallbackUrl() {
    return sessionStorage.getItem('auth_redirect');
  }

  /**
   * Clear stored callback URL
   */
  clearCallbackUrl() {
    sessionStorage.removeItem('auth_redirect');
  }

  /**
   * Require authentication with automatic redirect
   */
  requireAuth(redirectToAuth = true) {
    if (!this.state.isAuthenticated) {
      if (redirectToAuth) {
        this.storeCallbackUrl();
        this.authUtils.redirectToAuth();
      }
      return false;
    }
    return true;
  }

  /**
   * Require email verification
   */
  requireEmailVerification(showMessage = true) {
    return this.authUtils.requireEmailVerification(showMessage);
  }

  /**
   * Subscribe to auth state changes
   */
  subscribe(callback) {
    this.listeners.push(callback);
    
    // Immediately call with current state
    callback(this.state);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  /**
   * Notify all listeners of state changes
   */
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.state);
      } catch (error) {
        console.error('Error in useAuth listener:', error);
      }
    });
  }

  /**
   * Get current auth state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return this.state.isAuthenticated;
  }

  /**
   * Check if user's email is verified
   */
  isEmailVerified() {
    return this.state.isEmailVerified;
  }

  /**
   * Get current user
   */
  getUser() {
    return this.state.user;
  }

  /**
   * Get current session
   */
  getSession() {
    return this.state.session;
  }

  /**
   * Check if auth is loading
   */
  isLoading() {
    return this.state.loading;
  }

  /**
   * Get current error
   */
  getError() {
    return this.state.error;
  }

  /**
   * Clear current error
   */
  clearError() {
    this.state.error = null;
    this.notifyListeners();
  }
}

// Create singleton instance
let useAuthInstance = null;

export const useAuth = () => {
  if (!useAuthInstance) {
    useAuthInstance = new UseAuth();
  }
  return useAuthInstance;
};

// Export for direct usage
export default useAuth;