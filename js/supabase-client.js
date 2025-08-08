/**
 * Supabase Client Configuration
 * Initializes the Supabase client with environment variables
 */

// Import Supabase client from CDN (will be loaded in HTML)
// This assumes the Supabase JS library is loaded via CDN in the HTML

class SupabaseClient {
  constructor() {
    // Get environment variables (these should be set in your deployment)
    this.supabaseUrl = this.getEnvVar('SUPABASE_URL');
    this.supabaseAnonKey = this.getEnvVar('SUPABASE_ANON_KEY');
    
    if (!this.supabaseUrl || !this.supabaseAnonKey) {
      console.error('Supabase configuration missing: set SUPABASE_URL and SUPABASE_ANON_KEY.');
      return;
    }

    // Initialize Supabase client
    this.client = window.supabase.createClient(this.supabaseUrl, this.supabaseAnonKey);
    
    // Initialize auth state listener
    this.initAuthListener();
  }

  /**
   * Get environment variable from various sources
   * In production, these should be set as environment variables
   * For development, they can be set in a config object
   */
  getEnvVar(name) {
    // Try to get from window config first (for development)
    if (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG[name]) {
      return window.SUPABASE_CONFIG[name];
    }
    
    // Try to get from process.env (if available)
    if (typeof process !== 'undefined' && process.env && process.env[name]) {
      return process.env[name];
    }
    
    return null;
  }

  /**
   * Initialize authentication state listener
   */
  initAuthListener() {
    this.client.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session);
      
      // Dispatch custom event for other components to listen to
      window.dispatchEvent(new CustomEvent('supabase-auth-change', {
        detail: { event, session }
      }));
      
      // Update UI based on auth state
      this.updateAuthUI(session);
    });
  }

  /**
   * Update UI elements based on authentication state
   */
  updateAuthUI(session) {
    const authElements = document.querySelectorAll('[data-auth-required]');
    const guestElements = document.querySelectorAll('[data-guest-only]');
    
    if (session) {
      // User is logged in
      authElements.forEach(el => el.style.display = 'block');
      guestElements.forEach(el => el.style.display = 'none');
    } else {
      // User is not logged in
      authElements.forEach(el => el.style.display = 'none');
      guestElements.forEach(el => el.style.display = 'block');
    }
  }

  /**
   * Get the current Supabase client instance
   */
  getClient() {
    return this.client;
  }

  /**
   * Get the current user session
   */
  async getCurrentSession() {
    const { data: { session }, error } = await this.client.auth.getSession();
    if (error) {
      console.error('Error getting session:', error);
      return null;
    }
    return session;
  }

  /**
   * Get the current user
   */
  async getCurrentUser() {
    const { data: { user }, error } = await this.client.auth.getUser();
    if (error) {
      console.error('Error getting user:', error);
      return null;
    }
    return user;
  }
}

// Create global instance
window.supabaseClient = new SupabaseClient();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SupabaseClient;
}
