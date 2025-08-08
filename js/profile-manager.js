/**
 * ProfileManager - User profile management system
 * Handles user profile data, preferences, and subscription information
 */

class ProfileManager {
  constructor(authManager, supabaseClient) {
    this.authManager = authManager || window.authManager;
    this.supabase = supabaseClient?.getClient() || window.supabaseClient?.getClient();
    this.currentProfile = null;
    this.profileListeners = [];
    this.isInitialized = false;
    
    if (!this.supabase) {
      console.error('ProfileManager: Supabase client not available');
      return;
    }
    
    if (!this.authManager) {
      console.error('ProfileManager: AuthManager not available');
      return;
    }
    
    this.initialize();
  }

  /**
   * Initialize the profile manager
   */
  async initialize() {
    try {
      // Listen for auth state changes
      this.authManager.addAuthStateListener((event, session) => {
        this.handleAuthStateChange(event, session);
      });

      // Load profile if user is already authenticated
      if (this.authManager.isAuthenticated()) {
        await this.loadUserProfile();
      }

      this.isInitialized = true;
      
    } catch (error) {
      console.error('ProfileManager initialization error:', error);
    }
  }

  /**
   * Handle authentication state changes
   */
  async handleAuthStateChange(event, session) {
    switch (event) {
      case 'SIGNED_IN':
        await this.loadUserProfile();
        break;
      case 'SIGNED_OUT':
        this.clearProfile();
        break;
      case 'USER_UPDATED':
        await this.loadUserProfile();
        break;
    }
  }

  /**
   * Load user profile from database
   */
  async loadUserProfile() {
    try {
      const user = this.authManager.getCurrentUser();
      if (!user) {
        this.clearProfile();
        return null;
      }

      const { data: profile, error } = await this.supabase
        .from('user_profiles')
        .select(`
          *,
          payment_subscriptions (
            id,
            plan_type,
            status,
            current_period_start,
            current_period_end
          )
        `)
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!profile) {
        // Create profile if it doesn't exist
        await this.createUserProfile(user);
        return await this.loadUserProfile();
      }

      this.currentProfile = {
        ...profile,
        user_metadata: user.user_metadata || {},
        email: user.email,
        email_confirmed_at: user.email_confirmed_at,
        last_sign_in_at: user.last_sign_in_at
      };

      this.notifyProfileListeners('profile_loaded', this.currentProfile);
      return this.currentProfile;

    } catch (error) {
      console.error('Error loading user profile:', error);
      throw error;
    }
  }

  /**
   * Create user profile in database
   */
  async createUserProfile(user) {
    try {
      const profileData = {
        id: user.id,
        subscription_plan: 'free',
        subscription_status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from('user_profiles')
        .insert(profileData)
        .select()
        .single();

      if (error) throw error;

      console.log('User profile created:', data);
      return data;

    } catch (error) {
      console.error('Error creating user profile:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(updates) {
    try {
      const user = this.authManager.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Separate auth updates from profile updates
      const authUpdates = {};
      const profileUpdates = { ...updates };

      // Handle auth-specific updates
      if (updates.email && updates.email !== user.email) {
        authUpdates.email = updates.email;
        delete profileUpdates.email;
      }

      if (updates.password) {
        authUpdates.password = updates.password;
        delete profileUpdates.password;
      }

      if (updates.full_name || updates.avatar_url) {
        authUpdates.data = {
          ...user.user_metadata,
          full_name: updates.full_name || user.user_metadata?.full_name,
          avatar_url: updates.avatar_url || user.user_metadata?.avatar_url
        };
        delete profileUpdates.full_name;
        delete profileUpdates.avatar_url;
      }

      // Update auth data if needed
      if (Object.keys(authUpdates).length > 0) {
        const { error: authError } = await this.supabase.auth.updateUser(authUpdates);
        if (authError) throw authError;
      }

      // Update profile data if needed
      if (Object.keys(profileUpdates).length > 0) {
        profileUpdates.updated_at = new Date().toISOString();

        const { data, error } = await this.supabase
          .from('user_profiles')
          .update(profileUpdates)
          .eq('id', user.id)
          .select()
          .single();

        if (error) throw error;
      }

      // Reload profile to get updated data
      await this.loadUserProfile();
      
      this.notifyProfileListeners('profile_updated', this.currentProfile);
      return this.currentProfile;

    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }

  /**
   * Get current user profile
   */
  getCurrentProfile() {
    return this.currentProfile;
  }

  /**
   * Get user subscription information
   */
  getSubscriptionInfo() {
    if (!this.currentProfile) return null;

    const subscription = this.currentProfile.payment_subscriptions?.[0];
    
    return {
      plan: this.currentProfile.subscription_plan || 'free',
      status: this.currentProfile.subscription_status || 'active',
      subscription_details: subscription ? {
        plan_type: subscription.plan_type,
        status: subscription.status,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end
      } : null
    };
  }

  /**
   * Check if user has specific plan
   */
  hasPlan(planType) {
    const subscription = this.getSubscriptionInfo();
    return subscription?.plan === planType;
  }

  /**
   * Check if user has active subscription
   */
  hasActiveSubscription() {
    const subscription = this.getSubscriptionInfo();
    return subscription?.status === 'active' && subscription?.plan !== 'free';
  }

  /**
   * Get user preferences for a specific tool
   */
  async getUserPreferences(toolType) {
    try {
      const user = this.authManager.getCurrentUser();
      if (!user) return {};

      const { data, error } = await this.supabase
        .from('user_preferences')
        .select('preferences')
        .eq('user_id', user.id)
        .eq('tool_type', toolType)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data?.preferences || {};

    } catch (error) {
      console.error('Error getting user preferences:', error);
      return {};
    }
  }

  /**
   * Save user preferences for a specific tool
   */
  async saveUserPreferences(toolType, preferences) {
    try {
      const user = this.authManager.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await this.supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          tool_type: toolType,
          preferences: preferences,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,tool_type'
        })
        .select()
        .single();

      if (error) throw error;

      this.notifyProfileListeners('preferences_updated', { toolType, preferences });
      return data;

    } catch (error) {
      console.error('Error saving user preferences:', error);
      throw error;
    }
  }

  /**
   * Get all user preferences
   */
  async getAllUserPreferences() {
    try {
      const user = this.authManager.getCurrentUser();
      if (!user) return {};

      const { data, error } = await this.supabase
        .from('user_preferences')
        .select('tool_type, preferences')
        .eq('user_id', user.id);

      if (error) throw error;

      // Convert to object with tool_type as keys
      const preferencesMap = {};
      data.forEach(item => {
        preferencesMap[item.tool_type] = item.preferences;
      });

      return preferencesMap;

    } catch (error) {
      console.error('Error getting all user preferences:', error);
      return {};
    }
  }

  /**
   * Delete user preferences for a specific tool
   */
  async deleteUserPreferences(toolType) {
    try {
      const user = this.authManager.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { error } = await this.supabase
        .from('user_preferences')
        .delete()
        .eq('user_id', user.id)
        .eq('tool_type', toolType);

      if (error) throw error;

      this.notifyProfileListeners('preferences_deleted', { toolType });
      return true;

    } catch (error) {
      console.error('Error deleting user preferences:', error);
      throw error;
    }
  }

  /**
   * Reset all user preferences
   */
  async resetAllPreferences() {
    try {
      const user = this.authManager.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { error } = await this.supabase
        .from('user_preferences')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      this.notifyProfileListeners('all_preferences_reset', {});
      return true;

    } catch (error) {
      console.error('Error resetting all preferences:', error);
      throw error;
    }
  }

  /**
   * Update user's Stripe customer ID
   */
  async updateStripeCustomerId(customerId) {
    try {
      const user = this.authManager.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await this.supabase
        .from('user_profiles')
        .update({
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      // Update current profile
      if (this.currentProfile) {
        this.currentProfile.stripe_customer_id = customerId;
      }

      return data;

    } catch (error) {
      console.error('Error updating Stripe customer ID:', error);
      throw error;
    }
  }

  /**
   * Get user's usage statistics
   */
  async getUserUsageStats(monthYear = null) {
    try {
      const user = this.authManager.getCurrentUser();
      if (!user) return null;

      const currentMonth = monthYear || new Date().toISOString().slice(0, 7);

      const { data, error } = await this.supabase
        .from('monthly_usage')
        .select('*')
        .eq('user_id', user.id)
        .eq('month_year', currentMonth)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data || {
        conversions_count: 0,
        api_calls: 0,
        storage_used: 0
      };

    } catch (error) {
      console.error('Error getting usage stats:', error);
      return null;
    }
  }

  /**
   * Get user's file count and total size
   */
  async getUserFileStats() {
    try {
      const user = this.authManager.getCurrentUser();
      if (!user) return null;

      const { data, error } = await this.supabase
        .from('user_files')
        .select('file_size')
        .eq('user_id', user.id);

      if (error) throw error;

      const totalFiles = data.length;
      const totalSize = data.reduce((sum, file) => sum + (file.file_size || 0), 0);

      return {
        file_count: totalFiles,
        total_size: totalSize
      };

    } catch (error) {
      console.error('Error getting file stats:', error);
      return null;
    }
  }

  /**
   * Validate profile data
   */
  validateProfileData(data) {
    const errors = {};

    // Email validation
    if (data.email && !this.isValidEmail(data.email)) {
      errors.email = 'Please enter a valid email address';
    }

    // Name validation
    if (data.full_name && data.full_name.length > 100) {
      errors.full_name = 'Name must be less than 100 characters';
    }

    // Password validation
    if (data.password && data.password.length < 6) {
      errors.password = 'Password must be at least 6 characters long';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  /**
   * Validate email format
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Clear profile data
   */
  clearProfile() {
    this.currentProfile = null;
    this.notifyProfileListeners('profile_cleared', null);
  }

  /**
   * Add profile change listener
   */
  addProfileListener(callback) {
    this.profileListeners.push(callback);
  }

  /**
   * Remove profile change listener
   */
  removeProfileListener(callback) {
    this.profileListeners = this.profileListeners.filter(listener => listener !== callback);
  }

  /**
   * Notify all profile listeners
   */
  notifyProfileListeners(event, data) {
    this.profileListeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error in profile listener:', error);
      }
    });
  }

  /**
   * Export user data (for GDPR compliance)
   */
  async exportUserData() {
    try {
      const user = this.authManager.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get profile data
      const profile = await this.loadUserProfile();
      
      // Get preferences
      const preferences = await this.getAllUserPreferences();
      
      // Get usage stats
      const usageStats = await this.getUserUsageStats();
      
      // Get file stats
      const fileStats = await this.getUserFileStats();

      const exportData = {
        profile: {
          id: profile.id,
          email: profile.email,
          full_name: profile.user_metadata?.full_name,
          subscription_plan: profile.subscription_plan,
          subscription_status: profile.subscription_status,
          created_at: profile.created_at,
          updated_at: profile.updated_at
        },
        preferences,
        usage_stats: usageStats,
        file_stats: fileStats,
        exported_at: new Date().toISOString()
      };

      return exportData;

    } catch (error) {
      console.error('Error exporting user data:', error);
      throw error;
    }
  }

  /**
   * Delete user account and all associated data
   */
  async deleteUserAccount() {
    try {
      const user = this.authManager.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // This would typically be handled by a server-side function
      // due to the complexity of deleting all related data
      console.warn('Account deletion should be handled server-side');
      
      // For now, just sign out the user
      await this.authManager.signOut();
      
      throw new Error('Account deletion must be requested through support');

    } catch (error) {
      console.error('Error deleting user account:', error);
      throw error;
    }
  }
}

// Create global instance when dependencies are available
if (typeof window !== 'undefined') {
  window.addEventListener('supabase-auth-change', () => {
    if (window.authManager && window.supabaseClient && !window.profileManager) {
      window.profileManager = new ProfileManager(window.authManager, window.supabaseClient);
    }
  });

  // Initialize immediately if dependencies are already available
  if (window.authManager && window.supabaseClient) {
    window.profileManager = new ProfileManager(window.authManager, window.supabaseClient);
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProfileManager;
}