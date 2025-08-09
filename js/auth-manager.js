/**
 * AuthManager - Core authentication system for the image converter app
 * Handles user authentication, session management, and authentication state
 */

class AuthManager {
  constructor(supabaseClient) {
    this.supabase = supabaseClient?.getClient() || window.supabaseClient?.getClient();
    this.currentUser = null;
    this.currentSession = null;
    this.authStateListeners = [];
    this.isInitialized = false;
    
    if (!this.supabase) {
      console.error('AuthManager: Supabase client not available');
      return;
    }
    
    this.initialize();
  }

  /**
   * Initialize the authentication manager
   */
  async initialize() {
    try {
      // Set up auth state change listener
      this.supabase.auth.onAuthStateChange((event, session) => {
        console.log('Auth state changed:', event, session?.user?.email || 'No user');
        this.handleAuthStateChange(event, session);
      });

      // Get current session
      const { data: { session }, error } = await this.supabase.auth.getSession();
      if (error) {
        console.error('Error getting initial session:', error);
      } else {
        this.currentSession = session;
        this.currentUser = session?.user || null;
        
        // If user is already authenticated and we're on a tool page, restore any preserved state
        if (this.isAuthenticated() && this.isToolPage()) {
          this.restoreToolPageState();
        }
      }

      this.isInitialized = true;
      this.notifyAuthStateListeners('initialized', this.currentSession);
      
    } catch (error) {
      console.error('AuthManager initialization error:', error);
    }
  }

  /**
   * Handle authentication state changes
   */
  handleAuthStateChange(event, session) {
    this.currentSession = session;
    this.currentUser = session?.user || null;
    
    // Update UI based on auth state
    this.updateAuthUI();
    
    // Notify listeners
    this.notifyAuthStateListeners(event, session);
    
    // Handle specific events
    switch (event) {
      case 'SIGNED_IN':
        this.handleSignIn(session);
        break;
      case 'SIGNED_OUT':
        this.handleSignOut();
        break;
      case 'TOKEN_REFRESHED':
        console.log('Token refreshed for user:', session?.user?.email);
        break;
      case 'USER_UPDATED':
        console.log('User updated:', session?.user?.email);
        break;
    }
  }

  /**
   * Handle successful sign in
   */
  async handleSignIn(session) {
    try {
      // Ensure authentication state is properly updated before redirect
      this.currentSession = session;
      this.currentUser = session?.user || null;
      
      // Create user profile if it doesn't exist
      await this.ensureUserProfile(session.user);
      
      // Show success message
      this.showAuthMessage('Welcome back!', 'success');
      
      // Add a small delay to ensure auth state is fully propagated
      setTimeout(() => {
        this.handleAuthRedirect();
      }, 100);
      
    } catch (error) {
      console.error('Error handling sign in:', error);
      this.showAuthMessage('Sign in successful, but there was an issue setting up your profile.', 'warning');
      
      // Fallback redirect logic for failed authentication attempts
      this.handleAuthRedirectWithFallback();
    }
  }

  /**
   * Handle authentication redirect with fallback logic
   */
  handleAuthRedirectWithFallback() {
    try {
      // Try normal redirect first
      this.handleAuthRedirect();
    } catch (error) {
      console.error('Error in auth redirect, using fallback:', error);
      
      // Fallback: redirect to homepage after a delay
      setTimeout(() => {
        try {
          const homePath = window.location.origin + '/index.html';
          console.log('Fallback redirect to homepage:', homePath);
          window.location.href = homePath;
        } catch (fallbackError) {
          console.error('Fallback redirect also failed:', fallbackError);
          // Last resort: reload the page
          window.location.reload();
        }
      }, 2000);
    }
  }

  /**
   * Handle sign out
   */
  handleSignOut() {
    // Clear any cached data
    this.clearUserData();
    
    // Show message
    this.showAuthMessage('You have been signed out.', 'info');
    
    // Redirect to home if on protected page
    if (this.isProtectedPage()) {
      const pathDepth = window.location.pathname.split('/').length - 2;
      const basePath = '../'.repeat(Math.max(0, pathDepth - 1));
      window.location.href = `${basePath}index.html`;
    }
  }

  /**
   * Sign up with email and password
   */
  async signUp(email, password, options = {}) {
    try {
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      const { data, error } = await this.supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password,
        options: {
          data: {
            full_name: options.fullName || '',
            ...options.metadata
          }
        }
      });

      if (error) throw error;

      if (data.user && !data.session) {
        // Email confirmation required
        this.showAuthMessage(
          'Please check your email and click the confirmation link to complete your registration.',
          'info'
        );
        return { success: true, requiresConfirmation: true, user: data.user };
      }

      return { success: true, user: data.user, session: data.session };

    } catch (error) {
      console.error('Sign up error:', error);
      this.showAuthMessage(this.getAuthErrorMessage(error), 'error');
      throw error;
    }
  }

  /**
   * Sign in with email and password
   */
  async signIn(email, password) {
    try {
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password
      });

      if (error) throw error;

      return { success: true, user: data.user, session: data.session };

    } catch (error) {
      console.error('Sign in error:', error);
      this.showAuthMessage(this.getAuthErrorMessage(error), 'error');
      throw error;
    }
  }

  /**
   * Sign in with OAuth provider
   */
  async signInWithProvider(provider) {
    try {
      // Determine redirect URL - use current origin with auth.html for OAuth callback
      let redirectUrl = `${window.location.origin}/auth.html`;
      
      // For production, ensure we use the correct domain
      if (window.location.hostname !== 'localhost') {
        redirectUrl = `${window.location.origin}/auth.html`;
      }
      
      console.log(`Initiating ${provider} OAuth with redirect URL:`, redirectUrl);
      
      const { data, error } = await this.supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });

      if (error) throw error;

      return { success: true, data };

    } catch (error) {
      console.error(`${provider} sign in error:`, error);
      this.showAuthMessage(`Failed to sign in with ${provider}. Please try again.`, 'error');
      throw error;
    }
  }

  /**
   * Sign out current user
   */
  async signOut() {
    try {
      const { error } = await this.supabase.auth.signOut();
      if (error) throw error;

      return { success: true };

    } catch (error) {
      console.error('Sign out error:', error);
      this.showAuthMessage('Error signing out. Please try again.', 'error');
      throw error;
    }
  }

  /**
   * Reset password
   */
  async resetPassword(email) {
    try {
      if (!email) {
        throw new Error('Email is required');
      }

      const { error } = await this.supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          redirectTo: `${window.location.origin}/reset-password.html`
        }
      );

      if (error) throw error;

      this.showAuthMessage(
        'Password reset email sent. Please check your inbox.',
        'success'
      );

      return { success: true };

    } catch (error) {
      console.error('Password reset error:', error);
      this.showAuthMessage(this.getAuthErrorMessage(error), 'error');
      throw error;
    }
  }

  /**
   * Update password
   */
  async updatePassword(newPassword) {
    try {
      if (!newPassword || newPassword.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      const { error } = await this.supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      this.showAuthMessage('Password updated successfully!', 'success');
      return { success: true };

    } catch (error) {
      console.error('Password update error:', error);
      this.showAuthMessage(this.getAuthErrorMessage(error), 'error');
      throw error;
    }
  }

  /**
   * Ensure user profile exists in database
   */
  async ensureUserProfile(user) {
    try {
      // Check if profile exists
      const { data: existingProfile, error: fetchError } = await this.supabase
        .from('user_profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (!existingProfile) {
        // Create profile
        const { error: insertError } = await this.supabase
          .from('user_profiles')
          .insert({
            id: user.id,
            subscription_plan: 'free',
            subscription_status: 'active'
          });

        if (insertError) {
          console.error('Error creating user profile:', insertError);
          // Don't throw here as the trigger should handle profile creation
        }
      }

    } catch (error) {
      console.error('Error ensuring user profile:', error);
      // Don't throw as this shouldn't block authentication
    }
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
   * Check if current page requires authentication
   */
  isProtectedPage() {
    const protectedPaths = ['/dashboard.html', '/profile.html', '/settings.html'];
    return protectedPaths.some(path => window.location.pathname.includes(path));
  }

  /**
   * Check if current page is a tool page
   */
  isToolPage() {
    return window.location.pathname.includes('/tools/');
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
   * Notify all auth state listeners with enhanced error handling
   */
  notifyAuthStateListeners(event, session) {
    if (this.authStateListeners.length === 0) {
      console.log('No auth state listeners to notify');
      return;
    }

    console.log(`Notifying ${this.authStateListeners.length} auth state listeners for event: ${event}`);
    
    this.authStateListeners.forEach((callback, index) => {
      try {
        callback(event, session, this.currentUser);
      } catch (error) {
        console.error(`Error in auth state listener ${index}:`, error);
        
        // Don't remove the listener immediately, but log for debugging
        console.warn('Auth state listener error details:', {
          listenerIndex: index,
          event,
          hasSession: !!session,
          hasUser: !!this.currentUser,
          error: error.message
        });
      }
    });
  }

  /**
   * Update UI based on authentication state with enhanced error handling
   */
  updateAuthUI() {
    try {
      console.log('AuthManager: Updating auth UI, authenticated:', this.isAuthenticated());
      
      // Update elements that should show/hide based on auth state
      const authRequiredElements = document.querySelectorAll('[data-auth-required]');
      const guestOnlyElements = document.querySelectorAll('[data-guest-only]');
      const userInfoElements = document.querySelectorAll('[data-user-info]');

      if (this.isAuthenticated()) {
        // Show auth-required elements
        authRequiredElements.forEach((el, index) => {
          try {
            el.style.display = el.dataset.authDisplay || 'block';
            el.classList.remove('hidden');
          } catch (error) {
            console.warn(`Error updating auth-required element ${index}:`, error);
          }
        });

        // Hide guest-only elements
        guestOnlyElements.forEach((el, index) => {
          try {
            el.style.display = 'none';
            el.classList.add('hidden');
          } catch (error) {
            console.warn(`Error updating guest-only element ${index}:`, error);
          }
        });

        // Update user info elements with enhanced error handling
        this.updateUserInfoElements(userInfoElements);

      } else {
        // Hide auth-required elements
        authRequiredElements.forEach((el, index) => {
          try {
            el.style.display = 'none';
            el.classList.add('hidden');
          } catch (error) {
            console.warn(`Error hiding auth-required element ${index}:`, error);
          }
        });

        // Show guest-only elements
        guestOnlyElements.forEach((el, index) => {
          try {
            el.style.display = el.dataset.guestDisplay || 'block';
            el.classList.remove('hidden');
          } catch (error) {
            console.warn(`Error showing guest-only element ${index}:`, error);
          }
        });

        // Clear user info elements
        this.clearUserInfoElements(userInfoElements);
      }

      // Dispatch UI update event for other components
      this.dispatchAuthUIUpdateEvent();
      
    } catch (error) {
      console.error('Error in updateAuthUI:', error);
      
      // Attempt fallback UI update
      this.fallbackAuthUIUpdate();
    }
  }

  /**
   * Update user info elements with enhanced error handling
   * @param {NodeList} userInfoElements - Elements to update
   */
  updateUserInfoElements(userInfoElements) {
    if (!this.currentUser) {
      console.warn('No current user available for updating user info elements');
      return;
    }

    userInfoElements.forEach((el, index) => {
      try {
        const infoType = el.dataset.userInfo;
        switch (infoType) {
          case 'email':
            el.textContent = this.currentUser.email || '';
            break;
          case 'name':
            el.textContent = this.currentUser.user_metadata?.full_name || 
                           this.currentUser.email?.split('@')[0] || 
                           'User';
            break;
          case 'avatar':
            if (el.tagName === 'IMG') {
              const avatarUrl = this.currentUser.user_metadata?.avatar_url || 
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(this.currentUser.email || 'User')}&background=0066cc&color=fff`;
              el.src = avatarUrl;
              el.style.display = 'block';
            }
            break;
          default:
            console.warn(`Unknown user info type: ${infoType}`);
        }
      } catch (error) {
        console.warn(`Error updating user info element ${index} (${el.dataset.userInfo}):`, error);
      }
    });
  }

  /**
   * Clear user info elements
   * @param {NodeList} userInfoElements - Elements to clear
   */
  clearUserInfoElements(userInfoElements) {
    userInfoElements.forEach((el, index) => {
      try {
        const infoType = el.dataset.userInfo;
        switch (infoType) {
          case 'email':
          case 'name':
            el.textContent = '';
            break;
          case 'avatar':
            if (el.tagName === 'IMG') {
              el.style.display = 'none';
              el.src = '';
            }
            break;
        }
      } catch (error) {
        console.warn(`Error clearing user info element ${index}:`, error);
      }
    });
  }

  /**
   * Fallback UI update when main update fails
   */
  fallbackAuthUIUpdate() {
    try {
      console.log('Attempting fallback auth UI update');
      
      const isAuth = this.isAuthenticated();
      
      // Simple show/hide for auth elements
      document.querySelectorAll('[data-auth-required]').forEach(el => {
        el.style.display = isAuth ? 'block' : 'none';
      });
      
      document.querySelectorAll('[data-guest-only]').forEach(el => {
        el.style.display = isAuth ? 'none' : 'block';
      });
      
      console.log('Fallback auth UI update completed');
    } catch (error) {
      console.error('Fallback auth UI update also failed:', error);
    }
  }

  /**
   * Dispatch auth UI update event for other components
   */
  dispatchAuthUIUpdateEvent() {
    try {
      const event = new CustomEvent('authUIUpdated', {
        detail: {
          isAuthenticated: this.isAuthenticated(),
          user: this.currentUser,
          session: this.currentSession,
          timestamp: Date.now()
        }
      });

      document.dispatchEvent(event);
      window.dispatchEvent(event);
    } catch (error) {
      console.warn('Error dispatching auth UI update event:', error);
    }
  }

  /**
   * Clear user data on sign out
   */
  clearUserData() {
    // Clear any cached user data
    localStorage.removeItem('user_preferences');
    localStorage.removeItem('recent_files');
    
    // Clear any temporary data
    sessionStorage.clear();
  }

  /**
   * Get user-friendly error message
   */
  getAuthErrorMessage(error) {
    const errorMessages = {
      'Invalid login credentials': 'Invalid email or password. Please check your credentials and try again.',
      'Email not confirmed': 'Please check your email and confirm your account before signing in.',
      'User not found': 'No account found with this email address.',
      'Invalid email': 'Please enter a valid email address.',
      'Password should be at least 6 characters': 'Password must be at least 6 characters long.',
      'User already registered': 'An account with this email already exists. Please sign in instead.',
      'Signup disabled': 'New account registration is currently disabled.',
      'Email rate limit exceeded': 'Too many emails sent. Please wait before requesting another.',
      'Captcha verification failed': 'Captcha verification failed. Please try again.'
    };

    return errorMessages[error.message] || error.message || 'An unexpected error occurred. Please try again.';
  }

  /**
   * Show authentication message to user
   */
  showAuthMessage(message, type = 'info') {
    // Try to use existing toast system
    if (window.showToast) {
      window.showToast(message, type);
      return;
    }

    // Fallback to simple alert or console
    if (type === 'error') {
      console.error('Auth Error:', message);
      alert(message);
    } else {
      console.log(`Auth ${type}:`, message);
      if (type === 'success' || type === 'info') {
        // Could show a temporary message div
        this.showTemporaryMessage(message, type);
      }
    }
  }

  /**
   * Show temporary message (fallback)
   */
  showTemporaryMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `auth-message auth-message-${type}`;
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 4px;
      color: white;
      font-weight: 500;
      z-index: 10000;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      background-color: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
    `;

    document.body.appendChild(messageDiv);

    setTimeout(() => {
      messageDiv.remove();
    }, 5000);
  }

  /**
   * Store current tool page URL before redirecting to auth
   * @param {string} currentUrl - Optional URL to store, defaults to current location
   */
  storeToolPageForRedirect(currentUrl = null) {
    const urlToStore = currentUrl || window.location.href;
    
    // Store the full URL including any query parameters or hash
    sessionStorage.setItem('auth_redirect', urlToStore);
    
    // Also store tool-specific state if available
    this.preserveToolPageState();
    
    console.log('Stored tool page for redirect:', urlToStore);
  }

  /**
   * Preserve tool page state during authentication flow
   */
  preserveToolPageState() {
    try {
      const toolState = {};
      
      // Preserve form data from common tool inputs
      const formInputs = document.querySelectorAll('input, select, textarea');
      formInputs.forEach(input => {
        if (input.id && input.value) {
          toolState[input.id] = {
            value: input.value,
            type: input.type
          };
        }
      });
      
      // Preserve any uploaded files info (not the actual files, just metadata)
      const fileInputs = document.querySelectorAll('input[type="file"]');
      fileInputs.forEach(input => {
        if (input.files && input.files.length > 0) {
          toolState[`${input.id}_files`] = {
            count: input.files.length,
            names: Array.from(input.files).map(f => f.name)
          };
        }
      });
      
      // Store tool state if there's anything to preserve
      if (Object.keys(toolState).length > 0) {
        sessionStorage.setItem('tool_page_state', JSON.stringify(toolState));
        console.log('Preserved tool page state:', toolState);
      }
    } catch (error) {
      console.warn('Error preserving tool page state:', error);
    }
  }

  /**
   * Restore tool page state after authentication
   */
  restoreToolPageState() {
    try {
      const storedState = sessionStorage.getItem('tool_page_state');
      if (!storedState) return;
      
      const toolState = JSON.parse(storedState);
      
      // Restore form inputs
      Object.keys(toolState).forEach(key => {
        if (key.endsWith('_files')) return; // Skip file metadata
        
        const element = document.getElementById(key);
        if (element && toolState[key].value) {
          element.value = toolState[key].value;
          
          // Trigger change event to update any dependent UI
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      
      // Show message about file uploads if any were present
      const fileKeys = Object.keys(toolState).filter(key => key.endsWith('_files'));
      if (fileKeys.length > 0) {
        this.showAuthMessage('Please re-upload your files to continue.', 'info');
      }
      
      // Clean up stored state
      sessionStorage.removeItem('tool_page_state');
      console.log('Restored tool page state');
      
    } catch (error) {
      console.warn('Error restoring tool page state:', error);
    }
  }

  /**
   * Authentication guard for protected pages
   */
  requireAuth() {
    if (!this.isAuthenticated()) {
      // Store current tool page URL before redirecting
      this.storeToolPageForRedirect();
      
      // Calculate correct path to auth page using PathResolver if available
      let authPath = '/auth.html';
      if (typeof PathResolver !== 'undefined') {
        authPath = PathResolver.resolveAuthPath(window.location.pathname);
      } else {
        // Fallback path calculation
        const pathDepth = window.location.pathname.split('/').length - 2;
        const basePath = pathDepth > 1 ? '../'.repeat(pathDepth - 1) : './';
        authPath = `${basePath}auth.html`;
      }
      
      // Redirect to login
      window.location.href = authPath;
      return false;
    }
    return true;
  }

  /**
   * Enhanced redirect handling after authentication
   */
  handleAuthRedirect() {
    const redirectUrl = sessionStorage.getItem('auth_redirect');
    
    if (redirectUrl && redirectUrl !== window.location.href) {
      // Clear the redirect URL first
      sessionStorage.removeItem('auth_redirect');
      
      console.log('Redirecting back to original tool page:', redirectUrl);
      
      // Add a small delay to ensure auth state is fully updated
      setTimeout(() => {
        window.location.href = redirectUrl;
      }, 100);
      
    } else if (window.location.pathname.includes('auth')) {
      // If on auth page with no stored redirect, go to homepage by default
      let homePath = '/index.html';
      
      if (typeof PathResolver !== 'undefined') {
        // Use PathResolver if available to calculate correct relative path
        const pathDepth = window.location.pathname.split('/').length - 2;
        const basePath = '../'.repeat(Math.max(0, pathDepth - 1));
        homePath = `${basePath}index.html`;
      } else {
        // Fallback path calculation
        const pathDepth = window.location.pathname.split('/').length - 2;
        const basePath = '../'.repeat(Math.max(0, pathDepth - 1));
        homePath = `${basePath}index.html`;
      }
      
      console.log('No redirect URL found, going to homepage:', homePath);
      window.location.href = homePath;
      
    } else {
      // Already on the right page, restore any preserved state
      this.restoreToolPageState();
      console.log('Already on correct page, restored tool state');
    }
  }
}

// Create global instance when supabase client is available
if (typeof window !== 'undefined') {
  window.addEventListener('supabase-auth-change', () => {
    if (window.supabaseClient && !window.authManager) {
      window.authManager = new AuthManager(window.supabaseClient);
    }
  });

  // Initialize immediately if supabase client is already available
  if (window.supabaseClient) {
    window.authManager = new AuthManager(window.supabaseClient);
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthManager;
}