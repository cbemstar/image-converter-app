/**
 * Usage Tracking Hook
 * 
 * Provides quota monitoring, real-time usage updates, and usage history
 * Requirements: 5.1, 5.6, 2.4
 */

import { supabase } from '../auth/supabase-client.js';

class UsageTracker {
  constructor() {
    this.listeners = new Set();
    this.currentUsage = null;
    this.loading = false;
    this.error = null;
    this.refreshInterval = null;
    
    // Bind methods
    this.subscribe = this.subscribe.bind(this);
    this.unsubscribe = this.unsubscribe.bind(this);
    this.fetchUsage = this.fetchUsage.bind(this);
    this.refreshUsage = this.refreshUsage.bind(this);
    this.recordConversion = this.recordConversion.bind(this);
    this.checkQuotaAvailable = this.checkQuotaAvailable.bind(this);
    this.getUsageHistory = this.getUsageHistory.bind(this);
    this.showWarningIfNeeded = this.showWarningIfNeeded.bind(this);
  }

  /**
   * Subscribe to usage updates
   * @param {Function} callback - Called when usage data changes
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.listeners.add(callback);
    
    // Immediately call with current data if available
    if (this.currentUsage) {
      callback({
        usage: this.currentUsage,
        loading: this.loading,
        error: this.error
      });
    }
    
    // Return unsubscribe function
    return () => this.unsubscribe(callback);
  }

  /**
   * Unsubscribe from usage updates
   * @param {Function} callback - Callback to remove
   */
  unsubscribe(callback) {
    this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of state changes
   */
  notifyListeners() {
    const state = {
      usage: this.currentUsage,
      loading: this.loading,
      error: this.error
    };
    
    this.listeners.forEach(callback => {
      try {
        callback(state);
      } catch (error) {
        console.error('Error in usage tracker listener:', error);
      }
    });
  }

  /**
   * Get current period start date
   * @returns {string} ISO date string for start of current month
   */
  getCurrentPeriodStart() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  }

  /**
   * Get current period end date
   * @returns {string} ISO date string for end of current month
   */
  getCurrentPeriodEnd() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  }

  /**
   * Fetch current usage data from Supabase
   * @returns {Promise<Object|null>} Usage data or null if not found
   */
  async fetchUsage() {
    try {
      this.loading = true;
      this.error = null;
      this.notifyListeners();

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        // User not authenticated, return guest usage from localStorage
        const guestUsage = this.getGuestUsage();
        this.currentUsage = guestUsage;
        this.loading = false;
        this.notifyListeners();
        return guestUsage;
      }

      const periodStart = this.getCurrentPeriodStart();
      
      // Fetch usage record with plan information
      const { data, error } = await supabase
        .from('usage_records')
        .select(`
          conversions_used,
          conversions_limit,
          period_start,
          period_end,
          user_subscriptions!inner(
            plan_id,
            status,
            current_period_end,
            plans!inner(
              name,
              monthly_conversions,
              features
            )
          )
        `)
        .eq('user_id', user.id)
        .eq('period_start', periodStart)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      let usageData;
      
      if (!data) {
        // No usage record found, create default for free tier
        usageData = {
          conversionsUsed: 0,
          conversionsLimit: 10, // Free tier default
          periodStart: periodStart,
          periodEnd: this.getCurrentPeriodEnd(),
          planName: 'Free',
          planStatus: 'active',
          features: ['Basic image conversion'],
          remainingConversions: 10
        };
      } else {
        const plan = data.user_subscriptions.plans;
        usageData = {
          conversionsUsed: data.conversions_used,
          conversionsLimit: data.conversions_limit,
          periodStart: data.period_start,
          periodEnd: data.period_end,
          planName: plan.name,
          planStatus: data.user_subscriptions.status,
          features: plan.features || [],
          remainingConversions: Math.max(0, data.conversions_limit - data.conversions_used),
          subscriptionEnd: data.user_subscriptions.current_period_end
        };
      }

      this.currentUsage = usageData;
      this.loading = false;
      this.notifyListeners();
      
      // Check if warning should be shown
      this.showWarningIfNeeded(usageData);
      
      return usageData;
      
    } catch (error) {
      console.error('Error fetching usage:', error);
      this.error = error.message;
      this.loading = false;
      this.notifyListeners();
      return null;
    }
  }

  /**
   * Get guest usage from localStorage (for non-authenticated users)
   * @returns {Object} Guest usage data
   */
  getGuestUsage() {
    const stored = localStorage.getItem('guestUsage');
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    
    let guestData;
    
    if (stored) {
      try {
        guestData = JSON.parse(stored);
        
        // Reset daily if more than 24 hours have passed
        if (now - guestData.lastReset > oneDay) {
          guestData = {
            conversionsUsed: 0,
            lastReset: now
          };
          localStorage.setItem('guestUsage', JSON.stringify(guestData));
        }
      } catch (error) {
        guestData = {
          conversionsUsed: 0,
          lastReset: now
        };
        localStorage.setItem('guestUsage', JSON.stringify(guestData));
      }
    } else {
      guestData = {
        conversionsUsed: 0,
        lastReset: now
      };
      localStorage.setItem('guestUsage', JSON.stringify(guestData));
    }

    return {
      conversionsUsed: guestData.conversionsUsed,
      conversionsLimit: 3, // Guest limit
      periodStart: new Date(guestData.lastReset).toISOString().split('T')[0],
      periodEnd: new Date(guestData.lastReset + oneDay).toISOString().split('T')[0],
      planName: 'Guest',
      planStatus: 'active',
      features: ['Limited conversions'],
      remainingConversions: Math.max(0, 3 - guestData.conversionsUsed),
      isGuest: true
    };
  }

  /**
   * Update guest usage in localStorage
   * @param {number} increment - Number to add to usage count
   */
  updateGuestUsage(increment = 1) {
    const current = this.getGuestUsage();
    const newUsage = {
      conversionsUsed: current.conversionsUsed + increment,
      lastReset: JSON.parse(localStorage.getItem('guestUsage')).lastReset
    };
    
    localStorage.setItem('guestUsage', JSON.stringify(newUsage));
    
    // Update current usage and notify listeners
    this.currentUsage = {
      ...current,
      conversionsUsed: newUsage.conversionsUsed,
      remainingConversions: Math.max(0, 3 - newUsage.conversionsUsed)
    };
    
    this.notifyListeners();
  }

  /**
   * Refresh usage data (force fetch from server)
   * @returns {Promise<Object|null>} Updated usage data
   */
  async refreshUsage() {
    return await this.fetchUsage();
  }

  /**
   * Record a successful conversion (client-side tracking)
   * Note: Server-side tracking happens in Edge Functions
   * @returns {Promise<void>}
   */
  async recordConversion() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Update guest usage
        this.updateGuestUsage(1);
        return;
      }

      // For authenticated users, refresh from server
      // The actual increment happens server-side in Edge Functions
      await this.refreshUsage();
      
    } catch (error) {
      console.error('Error recording conversion:', error);
    }
  }

  /**
   * Check if user has quota available for conversions
   * @param {number} count - Number of conversions to check for (default: 1)
   * @returns {boolean} True if quota is available
   */
  checkQuotaAvailable(count = 1) {
    if (!this.currentUsage) {
      return false;
    }
    
    return this.currentUsage.remainingConversions >= count;
  }

  /**
   * Get usage history for the current user
   * @param {number} months - Number of months to fetch (default: 6)
   * @returns {Promise<Array>} Array of usage records
   */
  async getUsageHistory(months = 6) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        return [];
      }

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);
      
      const { data, error } = await supabase
        .from('usage_records')
        .select(`
          period_start,
          period_end,
          conversions_used,
          conversions_limit,
          user_subscriptions!inner(
            plans!inner(name)
          )
        `)
        .eq('user_id', user.id)
        .gte('period_start', startDate.toISOString().split('T')[0])
        .lte('period_start', endDate.toISOString().split('T')[0])
        .order('period_start', { ascending: false });

      if (error) {
        throw error;
      }

      return data.map(record => ({
        periodStart: record.period_start,
        periodEnd: record.period_end,
        conversionsUsed: record.conversions_used,
        conversionsLimit: record.conversions_limit,
        planName: record.user_subscriptions.plans.name,
        utilizationPercent: Math.round((record.conversions_used / record.conversions_limit) * 100)
      }));
      
    } catch (error) {
      console.error('Error fetching usage history:', error);
      return [];
    }
  }

  /**
   * Show usage limit warning notifications if needed
   * @param {Object} usageData - Current usage data
   */
  showWarningIfNeeded(usageData) {
    const { conversionsUsed, conversionsLimit, remainingConversions } = usageData;
    const utilizationPercent = (conversionsUsed / conversionsLimit) * 100;
    
    // Show warnings at different thresholds
    if (utilizationPercent >= 90 && remainingConversions > 0) {
      this.showNotification(
        `You've used ${conversionsUsed} of ${conversionsLimit} conversions this month. Only ${remainingConversions} remaining.`,
        'warning'
      );
    } else if (remainingConversions === 0) {
      this.showNotification(
        'You\'ve reached your monthly conversion limit. Upgrade your plan to continue converting images.',
        'error'
      );
    } else if (utilizationPercent >= 75) {
      this.showNotification(
        `You've used ${conversionsUsed} of ${conversionsLimit} conversions this month.`,
        'info'
      );
    }
  }

  /**
   * Show notification (uses existing notification system)
   * @param {string} message - Notification message
   * @param {string} type - Notification type (info, warning, error, success)
   */
  showNotification(message, type = 'info') {
    // Use existing notification system if available
    if (window.showNotification) {
      window.showNotification(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Start automatic refresh of usage data
   * @param {number} intervalMs - Refresh interval in milliseconds (default: 30 seconds)
   */
  startAutoRefresh(intervalMs = 30000) {
    this.stopAutoRefresh();
    
    this.refreshInterval = setInterval(async () => {
      try {
        await this.refreshUsage();
      } catch (error) {
        console.error('Auto refresh error:', error);
      }
    }, intervalMs);
  }

  /**
   * Stop automatic refresh
   */
  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.stopAutoRefresh();
    this.listeners.clear();
    this.currentUsage = null;
  }
}

// Create singleton instance
const usageTracker = new UsageTracker();

/**
 * Hook for usage tracking functionality
 * @returns {Object} Usage tracking methods and state
 */
export function useUsage() {
  return {
    // State access
    getCurrentUsage: () => usageTracker.currentUsage,
    isLoading: () => usageTracker.loading,
    getError: () => usageTracker.error,
    
    // Methods
    subscribe: usageTracker.subscribe,
    unsubscribe: usageTracker.unsubscribe,
    fetchUsage: usageTracker.fetchUsage,
    refreshUsage: usageTracker.refreshUsage,
    recordConversion: usageTracker.recordConversion,
    checkQuotaAvailable: usageTracker.checkQuotaAvailable,
    getUsageHistory: usageTracker.getUsageHistory,
    
    // Auto-refresh control
    startAutoRefresh: usageTracker.startAutoRefresh,
    stopAutoRefresh: usageTracker.stopAutoRefresh,
    
    // Cleanup
    destroy: usageTracker.destroy
  };
}

// Export singleton for direct access
export { usageTracker };

// Make available globally for legacy compatibility
window.useUsage = useUsage;
window.usageTracker = usageTracker;