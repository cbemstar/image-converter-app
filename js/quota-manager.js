/**
 * QuotaManager - Comprehensive quota management system with API call tracking
 * Handles storage, conversion, and API call limits with real-time enforcement
 */

class QuotaManager {
  constructor(authManager, profileManager, supabaseClient) {
    this.authManager = authManager || window.authManager;
    this.profileManager = profileManager || window.profileManager;
    this.supabase = supabaseClient?.getClient() || window.supabaseClient?.getClient();
    
    this.quotaListeners = [];
    this.warningThresholds = {
      warning: 0.7,    // 70%
      critical: 0.85,  // 85%
      exceeded: 0.95   // 95%
    };
    
    this.planLimits = window.APP_CONFIG?.PLAN_LIMITS || {
      free: {
        storage: 52428800,      // 50MB
        conversions: 500,
        apiCalls: 5000,
        maxFileSize: 26214400   // 25MB
      },
      pro: {
        storage: 2147483648,    // 2GB
        conversions: 5000,
        apiCalls: 50000,
        maxFileSize: 104857600  // 100MB
      },
      agency: {
        storage: 21474836480,   // 20GB
        conversions: 50000,
        apiCalls: 500000,
        maxFileSize: 262144000  // 250MB
      }
    };

    this.currentUsage = {
      storage: 0,
      conversions: 0,
      apiCalls: 0
    };

    this.isInitialized = false;
    this.initialize();
  }

  /**
   * Initialize the quota manager
   */
  async initialize() {
    try {
      if (!this.supabase) {
        console.error('QuotaManager: Supabase client not available');
        return;
      }

      // Listen for auth state changes
      if (this.authManager) {
        this.authManager.addAuthStateListener((event, session) => {
          this.handleAuthStateChange(event, session);
        });
      }

      // Load current usage if user is authenticated
      if (this.authManager?.isAuthenticated()) {
        await this.loadCurrentUsage();
      }

      this.isInitialized = true;
      
    } catch (error) {
      console.error('QuotaManager initialization error:', error);
    }
  }

  /**
   * Handle authentication state changes
   */
  async handleAuthStateChange(event, session) {
    switch (event) {
      case 'SIGNED_IN':
        await this.loadCurrentUsage();
        break;
      case 'SIGNED_OUT':
        this.clearUsageData();
        break;
    }
  }

  /**
   * Load current usage from database
   */
  async loadCurrentUsage() {
    try {
      const user = this.authManager?.getCurrentUser();
      if (!user) return;

      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

      // Get monthly usage
      const { data: monthlyUsage, error: monthlyError } = await this.supabase
        .from('monthly_usage')
        .select('*')
        .eq('user_id', user.id)
        .eq('month_year', currentMonth)
        .single();

      if (monthlyError && monthlyError.code !== 'PGRST116') {
        throw monthlyError;
      }

      // Get storage usage from files
      const { data: files, error: filesError } = await this.supabase
        .from('user_files')
        .select('file_size')
        .eq('user_id', user.id);

      if (filesError) {
        throw filesError;
      }

      const storageUsed = files.reduce((total, file) => total + (file.file_size || 0), 0);

      this.currentUsage = {
        storage: storageUsed,
        conversions: monthlyUsage?.conversions_count || 0,
        apiCalls: monthlyUsage?.api_calls || 0
      };

      this.notifyQuotaListeners('usage_loaded', this.currentUsage);

    } catch (error) {
      console.error('Error loading current usage:', error);
      // Set default values on error
      this.currentUsage = { storage: 0, conversions: 0, apiCalls: 0 };
    }
  }

  /**
   * Get current user's plan limits
   */
  getCurrentPlanLimits() {
    const profile = this.profileManager?.getCurrentProfile();
    const plan = profile?.subscription_plan || 'free';
    return this.planLimits[plan] || this.planLimits.free;
  }

  /**
   * Check storage quota before file upload
   */
  async checkStorageQuota(fileSize) {
    try {
      const limits = this.getCurrentPlanLimits();
      const currentStorage = this.currentUsage.storage;
      const newTotal = currentStorage + fileSize;

      const result = {
        allowed: newTotal <= limits.storage,
        current: currentStorage,
        limit: limits.storage,
        newTotal: newTotal,
        percentage: (newTotal / limits.storage) * 100,
        remaining: Math.max(0, limits.storage - newTotal)
      };

      // Check file size limit
      if (fileSize > limits.maxFileSize) {
        result.allowed = false;
        result.error = 'FILE_TOO_LARGE';
        result.maxFileSize = limits.maxFileSize;
      }

      // Trigger warnings if approaching limits
      if (result.allowed) {
        this.checkAndTriggerWarnings('storage', result.percentage);
      }

      return result;

    } catch (error) {
      console.error('Error checking storage quota:', error);
      return {
        allowed: false,
        error: 'QUOTA_CHECK_FAILED',
        current: 0,
        limit: 0
      };
    }
  }

  /**
   * Check conversion quota before processing
   */
  async checkConversionQuota() {
    try {
      const limits = this.getCurrentPlanLimits();
      const current = this.currentUsage.conversions;
      const newTotal = current + 1;

      const result = {
        allowed: newTotal <= limits.conversions,
        current: current,
        limit: limits.conversions,
        newTotal: newTotal,
        percentage: (newTotal / limits.conversions) * 100,
        remaining: Math.max(0, limits.conversions - newTotal)
      };

      // Trigger warnings if approaching limits
      if (result.allowed) {
        this.checkAndTriggerWarnings('conversions', result.percentage);
      }

      return result;

    } catch (error) {
      console.error('Error checking conversion quota:', error);
      return {
        allowed: false,
        error: 'QUOTA_CHECK_FAILED',
        current: 0,
        limit: 0
      };
    }
  }

  /**
   * Check API call quota and increment if allowed with caching and optimized Edge Function
   */
  async checkAndIncrementApiCalls() {
    try {
      const user = this.authManager?.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Check API cache first for recent calls
      const cacheKey = `api_quota_${user.id}`;
      if (window.apiCache) {
        const cachedResult = window.apiCache.get(cacheKey);
        if (cachedResult && cachedResult.allowed) {
          // Use cached result for successful checks within cache window
          return cachedResult;
        }
      }

      // Use optimized Edge Function for server-side quota checking
      const { data, error } = await this.supabase.functions.invoke('quota-check-optimized', {
        body: {
          user_id: user.id,
          action_type: 'api_call'
        }
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        return {
          allowed: false,
          error: data.error,
          current: data.current_usage,
          limit: data.limit
        };
      }

      // Update local usage
      this.currentUsage.apiCalls = data.current_usage;

      const limits = this.getCurrentPlanLimits();
      const percentage = (data.current_usage / limits.apiCalls) * 100;

      // Trigger warnings if approaching limits
      this.checkAndTriggerWarnings('apiCalls', percentage);

      const result = {
        allowed: true,
        current: data.current_usage,
        limit: data.limit,
        percentage: percentage,
        remaining: Math.max(0, data.limit - data.current_usage)
      };

      // Cache successful result briefly
      if (window.apiCache && result.allowed) {
        window.apiCache.set(cacheKey, result, 10000); // 10 second cache
      }

      return result;

    } catch (error) {
      console.error('Error checking API call quota:', error);
      return {
        allowed: false,
        error: 'API_QUOTA_CHECK_FAILED',
        current: 0,
        limit: 0
      };
    }
  }

  /**
   * Update storage usage after file operations
   */
  async updateStorageUsage(sizeChange) {
    try {
      this.currentUsage.storage = Math.max(0, this.currentUsage.storage + sizeChange);
      
      const limits = this.getCurrentPlanLimits();
      const percentage = (this.currentUsage.storage / limits.storage) * 100;
      
      this.notifyQuotaListeners('storage_updated', {
        current: this.currentUsage.storage,
        limit: limits.storage,
        percentage: percentage
      });

      return this.currentUsage.storage;

    } catch (error) {
      console.error('Error updating storage usage:', error);
      throw error;
    }
  }

  /**
   * Update conversion usage after processing
   */
  async updateConversionUsage() {
    try {
      const user = this.authManager?.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const currentMonth = new Date().toISOString().slice(0, 7);

      // Update in database
      const { data, error } = await this.supabase
        .from('monthly_usage')
        .upsert({
          user_id: user.id,
          month_year: currentMonth,
          conversions_count: this.currentUsage.conversions + 1
        }, {
          onConflict: 'user_id,month_year'
        })
        .select('conversions_count')
        .single();

      if (error) throw error;

      this.currentUsage.conversions = data.conversions_count;

      const limits = this.getCurrentPlanLimits();
      const percentage = (this.currentUsage.conversions / limits.conversions) * 100;

      this.notifyQuotaListeners('conversions_updated', {
        current: this.currentUsage.conversions,
        limit: limits.conversions,
        percentage: percentage
      });

      return this.currentUsage.conversions;

    } catch (error) {
      console.error('Error updating conversion usage:', error);
      throw error;
    }
  }

  /**
   * Get usage percentage for a specific quota type
   */
  getUsagePercentage(quotaType) {
    const limits = this.getCurrentPlanLimits();
    const current = this.currentUsage[quotaType] || 0;
    const limit = limits[quotaType] || 1;
    
    return Math.min(100, (current / limit) * 100);
  }

  /**
   * Get all current usage data
   */
  getCurrentUsage() {
    const limits = this.getCurrentPlanLimits();
    
    return {
      storage: {
        current: this.currentUsage.storage,
        limit: limits.storage,
        percentage: this.getUsagePercentage('storage'),
        remaining: Math.max(0, limits.storage - this.currentUsage.storage)
      },
      conversions: {
        current: this.currentUsage.conversions,
        limit: limits.conversions,
        percentage: this.getUsagePercentage('conversions'),
        remaining: Math.max(0, limits.conversions - this.currentUsage.conversions)
      },
      apiCalls: {
        current: this.currentUsage.apiCalls,
        limit: limits.apiCalls,
        percentage: this.getUsagePercentage('apiCalls'),
        remaining: Math.max(0, limits.apiCalls - this.currentUsage.apiCalls)
      }
    };
  }

  /**
   * Check and trigger warnings based on usage percentage
   */
  checkAndTriggerWarnings(quotaType, percentage) {
    const thresholds = this.warningThresholds;
    
    if (percentage >= thresholds.exceeded * 100) {
      this.triggerQuotaWarning(quotaType, 'exceeded', percentage);
    } else if (percentage >= thresholds.critical * 100) {
      this.triggerQuotaWarning(quotaType, 'critical', percentage);
    } else if (percentage >= thresholds.warning * 100) {
      this.triggerQuotaWarning(quotaType, 'warning', percentage);
    }
  }

  /**
   * Trigger quota warning
   */
  triggerQuotaWarning(quotaType, level, percentage) {
    const warningData = {
      quotaType,
      level,
      percentage: Math.round(percentage),
      timestamp: new Date().toISOString()
    };

    this.notifyQuotaListeners('quota_warning', warningData);

    // Show user notification
    this.showQuotaWarning(warningData);
  }

  /**
   * Show quota warning to user
   */
  showQuotaWarning(warningData) {
    const { quotaType, level, percentage } = warningData;
    
    const messages = {
      warning: `You've used ${percentage}% of your ${quotaType} quota. Consider upgrading to avoid interruptions.`,
      critical: `You've used ${percentage}% of your ${quotaType} quota. Upgrade now to continue using all features.`,
      exceeded: `You've exceeded your ${quotaType} quota. Please upgrade to continue.`
    };

    const message = messages[level] || messages.warning;

    // Try to use existing notification system
    if (window.showToast) {
      const type = level === 'exceeded' ? 'error' : level === 'critical' ? 'warning' : 'info';
      window.showToast(message, type);
    } else {
      // Fallback notification
      this.showQuotaNotification(message, level);
    }
  }

  /**
   * Show quota notification (fallback)
   */
  showQuotaNotification(message, level) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `quota-notification quota-${level}`;
    notification.innerHTML = `
      <div class="quota-notification-content">
        <i class="fas fa-exclamation-triangle"></i>
        <span>${message}</span>
        <button class="quota-notification-close" onclick="this.parentElement.parentElement.remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;

    // Add styles if not already present
    if (!document.getElementById('quotaNotificationStyles')) {
      const styles = document.createElement('style');
      styles.id = 'quotaNotificationStyles';
      styles.textContent = `
        .quota-notification {
          position: fixed;
          top: 20px;
          right: 20px;
          max-width: 400px;
          padding: 16px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 10000;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .quota-notification.quota-warning {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          color: #92400e;
        }
        .quota-notification.quota-critical {
          background: #fee2e2;
          border: 1px solid #ef4444;
          color: #dc2626;
        }
        .quota-notification.quota-exceeded {
          background: #fecaca;
          border: 1px solid #dc2626;
          color: #991b1b;
        }
        .quota-notification-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .quota-notification-close {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          color: inherit;
          opacity: 0.7;
        }
        .quota-notification-close:hover {
          opacity: 1;
          background: rgba(0,0,0,0.1);
        }
      `;
      document.head.appendChild(styles);
    }

    document.body.appendChild(notification);

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 10000);
  }

  /**
   * Reset monthly usage (called on month change)
   */
  async resetMonthlyUsage() {
    try {
      this.currentUsage.conversions = 0;
      this.currentUsage.apiCalls = 0;

      this.notifyQuotaListeners('monthly_reset', {
        conversions: 0,
        apiCalls: 0
      });

      return true;

    } catch (error) {
      console.error('Error resetting monthly usage:', error);
      throw error;
    }
  }

  /**
   * Check if user can perform action based on quota
   */
  async canPerformAction(actionType, actionData = {}) {
    try {
      switch (actionType) {
        case 'upload':
          return await this.checkStorageQuota(actionData.fileSize || 0);
        case 'convert':
          return await this.checkConversionQuota();
        case 'api_call':
          return await this.checkAndIncrementApiCalls();
        default:
          return { allowed: true };
      }
    } catch (error) {
      console.error('Error checking action permission:', error);
      return { allowed: false, error: 'PERMISSION_CHECK_FAILED' };
    }
  }

  /**
   * Get upgrade suggestions based on current usage
   */
  getUpgradeSuggestions() {
    const usage = this.getCurrentUsage();
    const profile = this.profileManager?.getCurrentProfile();
    const currentPlan = profile?.subscription_plan || 'free';
    
    const suggestions = [];

    // Check each quota type
    Object.entries(usage).forEach(([type, data]) => {
      if (data.percentage > 80) {
        suggestions.push({
          type,
          percentage: data.percentage,
          current: data.current,
          limit: data.limit,
          urgency: data.percentage > 95 ? 'high' : data.percentage > 90 ? 'medium' : 'low'
        });
      }
    });

    // Suggest appropriate plan
    let suggestedPlan = null;
    if (currentPlan === 'free' && suggestions.length > 0) {
      suggestedPlan = 'pro';
    } else if (currentPlan === 'pro' && suggestions.some(s => s.urgency === 'high')) {
      suggestedPlan = 'agency';
    }

    return {
      suggestions,
      suggestedPlan,
      currentPlan
    };
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Format number with commas
   */
  formatNumber(num) {
    return new Intl.NumberFormat().format(num);
  }

  /**
   * Clear usage data on sign out
   */
  clearUsageData() {
    this.currentUsage = { storage: 0, conversions: 0, apiCalls: 0 };
    this.notifyQuotaListeners('usage_cleared', {});
  }

  /**
   * Add quota change listener
   */
  addQuotaListener(callback) {
    this.quotaListeners.push(callback);
  }

  /**
   * Remove quota change listener
   */
  removeQuotaListener(callback) {
    this.quotaListeners = this.quotaListeners.filter(listener => listener !== callback);
  }

  /**
   * Notify all quota listeners
   */
  notifyQuotaListeners(event, data) {
    this.quotaListeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error in quota listener:', error);
      }
    });
  }

  /**
   * Create usage meter HTML
   */
  createUsageMeter(quotaType, options = {}) {
    const usage = this.getCurrentUsage()[quotaType];
    if (!usage) return '';

    const {
      showLabel = true,
      showNumbers = true,
      className = '',
      size = 'medium'
    } = options;

    const percentage = Math.min(100, usage.percentage);
    const colorClass = percentage >= 95 ? 'danger' : percentage >= 85 ? 'warning' : 'success';

    return `
      <div class="usage-meter ${className} usage-meter-${size}" data-quota-type="${quotaType}">
        ${showLabel ? `<div class="usage-meter-label">${this.formatQuotaLabel(quotaType)}</div>` : ''}
        <div class="usage-meter-bar">
          <div class="usage-meter-fill usage-meter-${colorClass}" style="width: ${percentage}%"></div>
        </div>
        ${showNumbers ? `
          <div class="usage-meter-text">
            ${this.formatUsageText(quotaType, usage)}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Format quota label for display
   */
  formatQuotaLabel(quotaType) {
    const labels = {
      storage: 'Storage',
      conversions: 'Conversions',
      apiCalls: 'API Calls'
    };
    return labels[quotaType] || quotaType;
  }

  /**
   * Format usage text for display
   */
  formatUsageText(quotaType, usage) {
    switch (quotaType) {
      case 'storage':
        return `${this.formatFileSize(usage.current)} / ${this.formatFileSize(usage.limit)}`;
      case 'conversions':
      case 'apiCalls':
        return `${this.formatNumber(usage.current)} / ${this.formatNumber(usage.limit)}`;
      default:
        return `${usage.current} / ${usage.limit}`;
    }
  }
}

// Global utility functions
window.checkQuota = async function(actionType, actionData = {}) {
  if (!window.quotaManager) {
    console.warn('QuotaManager not available');
    return { allowed: true };
  }
  return await window.quotaManager.canPerformAction(actionType, actionData);
};

window.updateUsage = async function(usageType, amount = 1) {
  if (!window.quotaManager) {
    console.warn('QuotaManager not available');
    return;
  }
  
  switch (usageType) {
    case 'storage':
      return await window.quotaManager.updateStorageUsage(amount);
    case 'conversions':
      return await window.quotaManager.updateConversionUsage();
    default:
      console.warn('Unknown usage type:', usageType);
  }
};

// Create global instance when dependencies are available
if (typeof window !== 'undefined') {
  window.addEventListener('supabase-auth-change', () => {
    if (window.authManager && window.profileManager && window.supabaseClient && !window.quotaManager) {
      window.quotaManager = new QuotaManager(window.authManager, window.profileManager, window.supabaseClient);
    }
  });

  // Initialize immediately if dependencies are already available
  if (window.authManager && window.profileManager && window.supabaseClient) {
    window.quotaManager = new QuotaManager(window.authManager, window.profileManager, window.supabaseClient);
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = QuotaManager;
}