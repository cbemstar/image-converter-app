/**
 * Global Authentication System
 * Handles authentication state across all pages
 * Automatically updates UI and tracks sessions
 */

class GlobalAuth {
  constructor() {
    this.currentUser = null;
    this.currentSession = null;
    this.isInitialized = false;
    this.authStateListeners = [];
    this.supabase = null;
    
    this.init();
  }

  async init() {
    try {
      console.log('🔐 Initializing Global Authentication...');
      
      // Wait for dependencies
      await this.waitForDependencies();
      
      // Initialize Supabase client
      await this.initializeSupabase();
      
      // Check current session
      await this.checkCurrentSession();
      
      // Set up auth state listeners
      this.setupAuthStateListeners();
      
      // Update UI
      this.updateUI();
      
      this.isInitialized = true;
      console.log('✅ Global Authentication initialized successfully');
      
    } catch (error) {
      console.error('❌ Error initializing Global Authentication:', error);
    }
  }

  async waitForDependencies() {
    let attempts = 0;
    const maxAttempts = 50;
    
    while (!window.PUBLIC_ENV && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (!window.PUBLIC_ENV) {
      throw new Error('PUBLIC_ENV not loaded');
    }
    
    console.log('📦 Dependencies loaded');
  }

  async initializeSupabase() {
    if (window.supabase) {
      this.supabase = window.supabase;
      console.log('🔗 Using existing Supabase client');
      return;
    }

    // Import Supabase if not available
    if (typeof createClient === 'undefined') {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      window.createClient = createClient;
    }

    this.supabase = window.createClient(
      window.PUBLIC_ENV.SUPABASE_URL,
      window.PUBLIC_ENV.SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce'
        }
      }
    );

    // Make globally available
    window.supabase = this.supabase;
    console.log('🔗 Supabase client initialized');
  }

  async checkCurrentSession() {
    try {
      const { data: { session }, error } = await this.supabase.auth.getSession();
      
      if (error) {
        console.error('Session check error:', error);
        return;
      }

      this.currentSession = session;
      this.currentUser = session?.user || null;
      
      console.log('👤 Current session:', session ? `${session.user.email}` : 'No session');
      
      // Handle auth callback if present
      this.handleAuthCallback();
      
    } catch (error) {
      console.error('Error checking session:', error);
    }
  }

  setupAuthStateListeners() {
    this.supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔄 Auth state changed:', event, session?.user?.email || 'No user');
      
      this.currentSession = session;
      this.currentUser = session?.user || null;
      
      // Update UI
      this.updateUI();
      
      // Notify listeners
      this.notifyListeners(event, session);
      
      // Handle specific events
      this.handleAuthEvent(event, session);
    });
  }

  handleAuthEvent(event, session) {
    switch (event) {
      case 'SIGNED_IN':
        this.showToast(`Welcome back, ${session.user.email}!`, 'success');
        this.trackAuthEvent('sign_in', session.user);
        break;
      case 'SIGNED_OUT':
        this.showToast('Signed out successfully', 'info');
        this.trackAuthEvent('sign_out');
        break;
      case 'TOKEN_REFRESHED':
        console.log('🔄 Token refreshed');
        break;
    }
  }

  handleAuthCallback() {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');
    
    if (accessToken) {
      console.log('🔗 Auth callback detected:', type);
      
      // Clear hash from URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Show success message
      this.showToast('Successfully signed in! Welcome back.', 'success');
      
      // Redirect to homepage if on auth page
      if (window.location.pathname.includes('auth')) {
        setTimeout(() => {
          window.location.href = this.getBasePath() + 'index.html';
        }, 2000);
      }
      
      return true;
    }
    return false;
  }

  updateUI() {
    const isAuthenticated = this.isAuthenticated();
    const user = this.currentUser;
    
    console.log('🎨 Updating UI:', isAuthenticated ? `User: ${user.email}` : 'Guest');
    
    // Update auth-required elements
    const authRequired = document.querySelectorAll('[data-auth-required]');
    authRequired.forEach(el => {
      if (isAuthenticated) {
        el.style.display = el.dataset.authDisplay || 'flex';
        el.classList.remove('hidden');
      } else {
        el.style.display = 'none';
        el.classList.add('hidden');
      }
    });
    
    // Update guest-only elements
    const guestOnly = document.querySelectorAll('[data-guest-only]');
    guestOnly.forEach(el => {
      if (isAuthenticated) {
        el.style.display = 'none';
        el.classList.add('hidden');
      } else {
        el.style.display = el.dataset.guestDisplay || 'flex';
        el.classList.remove('hidden');
      }
    });
    
    // Update user info elements
    if (isAuthenticated && user) {
      this.updateUserInfo(user);
    } else {
      this.clearUserInfo();
    }
  }

  updateUserInfo(user) {
    const userInfoElements = document.querySelectorAll('[data-user-info]');
    
    userInfoElements.forEach(el => {
      const infoType = el.dataset.userInfo;
      
      switch (infoType) {
        case 'name':
          el.textContent = user.user_metadata?.full_name || 
                          user.email?.split('@')[0] || 
                          'User';
          break;
        case 'email':
          el.textContent = user.email || '';
          break;
        case 'avatar':
          if (el.tagName === 'IMG') {
            el.src = user.user_metadata?.avatar_url || 
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email || 'User')}&background=0066cc&color=fff`;
            el.style.display = 'block';
            el.alt = `Avatar for ${user.email}`;
          }
          break;
      }
    });
  }

  clearUserInfo() {
    const userInfoElements = document.querySelectorAll('[data-user-info]');
    
    userInfoElements.forEach(el => {
      const infoType = el.dataset.userInfo;
      
      switch (infoType) {
        case 'name':
        case 'email':
          el.textContent = '';
          break;
        case 'avatar':
          if (el.tagName === 'IMG') {
            el.style.display = 'none';
            el.src = '';
            el.alt = '';
          }
          break;
      }
    });
  }

  // Public API methods
  isAuthenticated() {
    return !!(this.currentSession && this.currentUser);
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getCurrentSession() {
    return this.currentSession;
  }

  async signOut() {
    try {
      const { error } = await this.supabase.auth.signOut();
      if (error) throw error;
      
      // Clear local state
      this.currentSession = null;
      this.currentUser = null;
      
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }

  async signIn(email, password) {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password
      });
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  }

  async signUp(email, password, options = {}) {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password,
        options: {
          data: options.metadata || {}
        }
      });
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  }

  async signInWithProvider(provider) {
    try {
      const redirectTo = `${window.location.origin}${this.getBasePath()}index.html`;
      
      const { data, error } = await this.supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: redirectTo
        }
      });
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error(`${provider} sign in error:`, error);
      throw error;
    }
  }

  // Utility methods
  getBasePath() {
    const pathParts = window.location.pathname.split('/');
    const depth = pathParts.length - 2;
    return depth > 0 ? '../'.repeat(depth) : './';
  }

  showToast(message, type = 'info') {
    // Try to use existing toast function
    if (window.showToast) {
      window.showToast(message, type);
      return;
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.style.cssText = `
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
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 5000);
  }

  // Session tracking
  trackAuthEvent(event, user = null) {
    try {
      // Track with Google Analytics if available
      if (window.gtag) {
        window.gtag('event', event, {
          event_category: 'authentication',
          user_id: user?.id || null
        });
      }
      
      // Track with custom analytics
      if (window.analytics) {
        window.analytics.track(event, {
          userId: user?.id,
          email: user?.email,
          timestamp: new Date().toISOString()
        });
      }
      
      console.log('📊 Tracked auth event:', event, user?.email || 'anonymous');
    } catch (error) {
      console.warn('Analytics tracking error:', error);
    }
  }

  // Listener management
  addAuthStateListener(callback) {
    this.authStateListeners.push(callback);
  }

  removeAuthStateListener(callback) {
    this.authStateListeners = this.authStateListeners.filter(listener => listener !== callback);
  }

  notifyListeners(event, session) {
    this.authStateListeners.forEach(callback => {
      try {
        callback(event, session, this.currentUser);
      } catch (error) {
        console.error('Auth state listener error:', error);
      }
    });
  }

  // Authentication guards
  requireAuth(options = {}) {
    if (!this.isAuthenticated()) {
      const message = options.message || 'Please sign in to access this feature.';
      this.showToast(message, 'info');
      
      // Store current page for redirect after auth
      sessionStorage.setItem('auth_redirect', window.location.href);
      
      // Redirect to auth page
      const authPath = this.getBasePath() + 'auth.html';
      setTimeout(() => {
        window.location.href = authPath;
      }, 1000);
      
      return false;
    }
    return true;
  }
}

// Initialize global auth system
let globalAuth = null;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    globalAuth = new GlobalAuth();
    window.globalAuth = globalAuth;
  });
} else {
  globalAuth = new GlobalAuth();
  window.globalAuth = globalAuth;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GlobalAuth;
}