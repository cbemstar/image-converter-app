/**
 * Dashboard - Main dashboard functionality for user account management
 * Provides comprehensive dashboard with usage metrics, quick actions, and account overview
 */

class Dashboard {
  constructor(authManager, profileManager, quotaManager) {
    this.authManager = authManager || window.authManager;
    this.profileManager = profileManager || window.profileManager;
    this.quotaManager = quotaManager || window.quotaManager;
    
    this.refreshInterval = null;
    this.isInitialized = false;
    this.currentUser = null;
    this.currentProfile = null;
    
    this.initialize();
  }

  /**
   * Initialize the dashboard
   */
  async initialize() {
    try {
      // Wait for dependencies
      await this.waitForDependencies();
      
      // Check authentication
      if (!this.authManager.isAuthenticated()) {
        this.redirectToAuth();
        return;
      }
      
      this.currentUser = this.authManager.getCurrentUser();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Initialize lazy loading for dashboard components
      this.initializeLazyLoading();
      
      // Load critical dashboard data first
      await this.loadCriticalData();
      
      // Load non-critical data with lazy loading
      this.loadNonCriticalData();
      
      // Set up auto-refresh
      this.setupAutoRefresh();
      
      this.isInitialized = true;
      console.log('Dashboard initialized successfully');
      
    } catch (error) {
      console.error('Dashboard initialization error:', error);
      this.showError('Failed to initialize dashboard');
    }
  }

  /**
   * Wait for required dependencies
   */
  async waitForDependencies() {
    return new Promise((resolve) => {
      const checkDependencies = () => {
        if (this.authManager && this.profileManager && this.quotaManager) {
          resolve();
        } else {
          setTimeout(checkDependencies, 100);
        }
      };
      checkDependencies();
    });
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Listen for quota changes
    if (this.quotaManager) {
      this.quotaManager.addQuotaListener((event, data) => {
        this.handleQuotaUpdate(event, data);
      });
    }

    // Listen for profile changes
    if (this.profileManager) {
      this.profileManager.addProfileListener((event, data) => {
        this.handleProfileUpdate(event, data);
      });
    }

    // Listen for auth state changes
    if (this.authManager) {
      this.authManager.addAuthStateListener((event, session) => {
        this.handleAuthStateChange(event, session);
      });
    }

    // Set up upgrade button
    const upgradeBtn = document.getElementById('upgradeBtn');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleUpgradeClick();
      });
    }

    // Set up refresh button if exists
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.refreshDashboard();
      });
    }
  }

  /**
   * Initialize lazy loading for dashboard components
   */
  initializeLazyLoading() {
    if (window.lazyLoader) {
      // Register dashboard-specific lazy loading
      window.lazyLoader.registerComponent('.usage-meters', async (element) => {
        await this.loadUsageData();
      }, { priority: 'high' });

      window.lazyLoader.registerComponent('.recent-activity', async (element) => {
        await this.loadRecentActivity();
      }, { priority: 'normal' });

      window.lazyLoader.registerComponent('.quick-actions', async (element) => {
        this.setupQuickActions();
      }, { priority: 'low' });
    }
  }

  /**
   * Load critical dashboard data (above the fold)
   */
  async loadCriticalData() {
    try {
      // Show loading state
      this.showLoadingState();
      
      // Load profile data first (needed for plan display)
      await this.loadProfileData();
      
      // Load usage data (critical for dashboard)
      await this.loadUsageData();
      
    } catch (error) {
      console.error('Error loading critical dashboard data:', error);
      this.showError('Failed to load dashboard data');
    } finally {
      this.hideLoadingState();
    }
  }

  /**
   * Load non-critical data (below the fold, lazy loaded)
   */
  loadNonCriticalData() {
    // These will be loaded by lazy loader when they come into view
    setTimeout(() => {
      if (window.lazyLoader) {
        window.lazyLoader.loadAllVisible();
      } else {
        // Fallback if lazy loader not available
        this.loadRecentActivity();
        this.setupQuickActions();
      }
    }, 100);
  }

  /**
   * Load user profile data with caching
   */
  async loadProfileData() {
    try {
      const userId = this.currentUser?.id;
      if (!userId) return;

      // Try cache first
      let profile = null;
      if (window.userDataCache) {
        profile = window.userDataCache.getUserProfile(userId);
      }

      // Load from server if not cached
      if (!profile) {
        profile = await this.profileManager.loadUserProfile();
        
        // Cache the result
        if (profile && window.userDataCache) {
          window.userDataCache.setUserProfile(userId, profile);
        }
      }

      if (profile) {
        this.currentProfile = profile;
        this.displayUserInfo(profile);
        this.displayPlanInfo(profile);
      }
    } catch (error) {
      console.error('Error loading profile data:', error);
    }
  }

  /**
   * Display user information in header
   */
  displayUserInfo(profile) {
    // User name and email
    const name = profile.user_metadata?.full_name || 
                 this.currentUser?.user_metadata?.full_name || 
                 this.currentUser?.email?.split('@')[0] || 'User';
    
    const welcomeElement = document.getElementById('dashboardWelcome');
    if (welcomeElement) {
      welcomeElement.textContent = `Welcome back, ${name}!`;
    }

    const emailElement = document.getElementById('dashboardEmail');
    if (emailElement) {
      emailElement.textContent = this.currentUser?.email || 'No email';
    }
    
    // User avatar
    const avatarElement = document.getElementById('dashboardAvatar');
    if (avatarElement) {
      const avatarUrl = profile.user_metadata?.avatar_url || 
                       this.currentUser?.user_metadata?.avatar_url ||
                       `https://ui-avatars.com/api/?name=${encodeURIComponent(this.currentUser?.email || 'User')}&background=3b82f6&color=fff&size=60`;
      avatarElement.src = avatarUrl;
      avatarElement.alt = `${name}'s avatar`;
    }
  }

  /**
   * Display plan information
   */
  displayPlanInfo(profile) {
    const planBadge = document.getElementById('planBadge');
    if (!planBadge) return;

    const plan = profile.subscription_plan || 'free';
    const planIcons = {
      free: 'user',
      pro: 'star', 
      agency: 'crown'
    };
    
    const planColors = {
      free: '#6b7280',
      pro: '#3b82f6',
      agency: '#f59e0b'
    };

    planBadge.innerHTML = `
      <i class="fas fa-${planIcons[plan]}"></i>
      ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan
    `;
    
    // Update badge color
    planBadge.style.background = `${planColors[plan]}33`;
    planBadge.style.color = planColors[plan];
  }

  /**
   * Load usage data and update meters with caching
   */
  async loadUsageData() {
    try {
      if (!this.quotaManager) return;
      
      const userId = this.currentUser?.id;
      let usage = null;

      // Try cache first
      if (userId && window.userDataCache) {
        usage = window.userDataCache.getUserUsage(userId);
      }

      // Load from quota manager if not cached
      if (!usage) {
        usage = this.quotaManager.getCurrentUsage();
        
        // Cache the result
        if (usage && userId && window.userDataCache) {
          window.userDataCache.setUserUsage(userId, usage);
        }
      }
      
      if (usage) {
        // Update storage usage
        this.updateUsageMeter('storage', usage.storage);
        
        // Update conversions usage  
        this.updateUsageMeter('conversions', usage.conversions);
        
        // Update API calls usage
        this.updateUsageMeter('apiCalls', usage.apiCalls);

        // Check for upgrade suggestions
        this.checkUpgradeSuggestions();
      }

    } catch (error) {
      console.error('Error loading usage data:', error);
    }
  }

  /**
   * Update usage meter display
   */
  updateUsageMeter(type, usage) {
    if (!usage) return;
    
    const percentage = Math.min(100, usage.percentage || 0);
    const colorClass = percentage >= 95 ? 'danger' : percentage >= 85 ? 'warning' : 'success';

    // Update meter fill
    const fillElement = document.getElementById(`${type}UsageFill`);
    if (fillElement) {
      fillElement.style.width = `${percentage}%`;
      fillElement.className = `usage-meter-fill usage-meter-${colorClass}`;
    }

    // Update usage text
    const textElement = document.getElementById(`${type}UsageText`);
    if (textElement) {
      textElement.textContent = this.formatUsageText(type, usage);
    }

    // Update stats
    this.updateUsageStats(type, usage);
  }

  /**
   * Format usage text for display
   */
  formatUsageText(type, usage) {
    switch (type) {
      case 'storage':
        return `${this.formatFileSize(usage.current || 0)} / ${this.formatFileSize(usage.limit || 0)}`;
      case 'conversions':
      case 'apiCalls':
        return `${this.formatNumber(usage.current || 0)} / ${this.formatNumber(usage.limit || 0)}`;
      default:
        return `${usage.current || 0} / ${usage.limit || 0}`;
    }
  }

  /**
   * Update usage statistics
   */
  updateUsageStats(type, usage) {
    // Update remaining count
    const remainingElement = document.getElementById(`${type}Remaining`);
    if (remainingElement) {
      const remaining = Math.max(0, (usage.limit || 0) - (usage.current || 0));
      remainingElement.textContent = type === 'storage' ? 
        this.formatFileSize(remaining) : this.formatNumber(remaining);
    }

    // Update today's count (would need actual daily tracking)
    const todayElement = document.getElementById(`${type}Today`);
    if (todayElement) {
      // Placeholder - would need actual daily usage tracking
      todayElement.textContent = '0';
    }

    // Update total files for storage
    if (type === 'storage') {
      this.updateFileCount();
    }
  }

  /**
   * Update file count display
   */
  async updateFileCount() {
    try {
      if (!this.profileManager) return;
      
      const fileStats = await this.profileManager.getUserFileStats();
      const totalFilesElement = document.getElementById('totalFiles');
      
      if (totalFilesElement && fileStats) {
        totalFilesElement.textContent = this.formatNumber(fileStats.file_count || 0);
      }
    } catch (error) {
      console.error('Error updating file count:', error);
    }
  }

  /**
   * Check and display upgrade suggestions
   */
  checkUpgradeSuggestions() {
    if (!this.quotaManager) return;
    
    const suggestions = this.quotaManager.getUpgradeSuggestions();
    const upgradePrompt = document.getElementById('upgradePrompt');
    const upgradeMessage = document.getElementById('upgradeMessage');

    if (suggestions.suggestions && suggestions.suggestions.length > 0) {
      const highUrgency = suggestions.suggestions.filter(s => s.urgency === 'high');
      
      if (highUrgency.length > 0) {
        const quota = highUrgency[0];
        if (upgradeMessage) {
          upgradeMessage.textContent = 
            `You've used ${Math.round(quota.percentage)}% of your ${quota.type} quota. Upgrade now to continue using all features.`;
        }
        if (upgradePrompt) {
          upgradePrompt.classList.add('show');
        }
      }
    }
  }

  /**
   * Load and display recent activity
   */
  async loadRecentActivity() {
    try {
      const activityList = document.getElementById('recentActivity');
      if (!activityList) return;

      // For now, show welcome message
      // In a real implementation, this would load from usage_analytics table
      activityList.innerHTML = `
        <li class="activity-item">
          <div class="activity-icon" style="background: #10b981;">
            <i class="fas fa-check"></i>
          </div>
          <div class="activity-content">
            <div class="activity-title">Welcome to your dashboard!</div>
            <div class="activity-time">Start using tools to see activity here</div>
          </div>
        </li>
      `;

      // TODO: Load actual activity from database
      // const activities = await this.loadUserActivity();
      // this.displayActivities(activities);

    } catch (error) {
      console.error('Error loading recent activity:', error);
    }
  }

  /**
   * Set up quick actions
   */
  setupQuickActions() {
    // Quick actions are already defined in HTML
    // Could add dynamic behavior here based on user plan
    
    const quickActions = document.querySelectorAll('.quick-action');
    quickActions.forEach(action => {
      action.addEventListener('click', (e) => {
        // Track quick action usage
        if (window.analyticsManager) {
          const toolName = action.href.split('/').pop().replace('.html', '');
          window.analyticsManager.trackInteraction('quick_action', 'click', {
            tool: toolName,
            source: 'dashboard'
          });
        }
      });
    });
  }

  /**
   * Handle quota updates
   */
  handleQuotaUpdate(event, data) {
    switch (event) {
      case 'storage_updated':
        this.updateUsageMeter('storage', data);
        break;
      case 'conversions_updated':
        this.updateUsageMeter('conversions', data);
        break;
      case 'api_calls_updated':
        this.updateUsageMeter('apiCalls', data);
        break;
      case 'quota_warning':
        this.handleQuotaWarning(data);
        break;
    }
  }

  /**
   * Handle quota warnings
   */
  handleQuotaWarning(warningData) {
    // Show upgrade prompt for critical warnings
    if (warningData.level === 'critical' || warningData.level === 'exceeded') {
      const upgradePrompt = document.getElementById('upgradePrompt');
      const upgradeMessage = document.getElementById('upgradeMessage');
      
      if (upgradeMessage) {
        upgradeMessage.textContent = 
          `You've used ${Math.round(warningData.percentage)}% of your ${warningData.quotaType} quota. Upgrade to continue using all features.`;
      }
      
      if (upgradePrompt) {
        upgradePrompt.classList.add('show');
      }
    }
  }

  /**
   * Handle profile updates
   */
  handleProfileUpdate(event, data) {
    if (event === 'profile_updated') {
      this.currentProfile = data;
      this.displayUserInfo(data);
      this.displayPlanInfo(data);
    }
  }

  /**
   * Handle auth state changes
   */
  handleAuthStateChange(event, session) {
    if (event === 'SIGNED_OUT') {
      this.cleanup();
      this.redirectToAuth();
    } else if (event === 'SIGNED_IN') {
      this.currentUser = session?.user;
      this.refreshDashboard();
    }
  }

  /**
   * Handle upgrade button click
   */
  handleUpgradeClick() {
    // Redirect to pricing page
    window.location.href = '/pricing.html';
    
    // Track upgrade intent
    if (window.analyticsManager) {
      window.analyticsManager.trackInteraction('upgrade_button', 'click', {
        source: 'dashboard',
        current_plan: this.currentProfile?.subscription_plan || 'free'
      });
    }
  }

  /**
   * Refresh dashboard data
   */
  async refreshDashboard() {
    try {
      await this.loadDashboardData();
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
      this.showError('Failed to refresh dashboard');
    }
  }

  /**
   * Set up auto-refresh
   */
  setupAutoRefresh() {
    // Refresh usage data every 30 seconds
    this.refreshInterval = setInterval(() => {
      this.loadUsageData();
    }, 30000);
  }

  /**
   * Show loading state
   */
  showLoadingState() {
    // Could add loading spinners or skeleton screens
    const loadingElements = document.querySelectorAll('.loading-placeholder');
    loadingElements.forEach(el => {
      el.style.display = 'block';
    });
  }

  /**
   * Hide loading state
   */
  hideLoadingState() {
    const loadingElements = document.querySelectorAll('.loading-placeholder');
    loadingElements.forEach(el => {
      el.style.display = 'none';
    });
  }

  /**
   * Show error message
   */
  showError(message) {
    console.error('Dashboard Error:', message);
    
    // Could show toast notification
    if (window.showToast) {
      window.showToast(message, 'error');
    } else {
      // Fallback to console
      console.error(message);
    }
  }

  /**
   * Redirect to authentication
   */
  redirectToAuth() {
    sessionStorage.setItem('auth_redirect', window.location.href);
    window.location.href = '/auth.html';
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
   * Format number for display
   */
  formatNumber(num) {
    return new Intl.NumberFormat().format(num);
  }

  /**
   * Format date for display
   */
  formatDate(date) {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  }

  /**
   * Get dashboard statistics
   */
  getDashboardStats() {
    if (!this.quotaManager) return null;
    
    const usage = this.quotaManager.getCurrentUsage();
    return {
      storage: usage.storage,
      conversions: usage.conversions,
      apiCalls: usage.apiCalls,
      plan: this.currentProfile?.subscription_plan || 'free',
      user: this.currentUser
    };
  }

  /**
   * Export dashboard data
   */
  async exportDashboardData() {
    try {
      const stats = this.getDashboardStats();
      const exportData = {
        user: {
          email: this.currentUser?.email,
          plan: stats?.plan
        },
        usage: {
          storage: stats?.storage,
          conversions: stats?.conversions,
          apiCalls: stats?.apiCalls
        },
        exportedAt: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dashboard-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error exporting dashboard data:', error);
      this.showError('Failed to export dashboard data');
    }
  }

  /**
   * Clean up dashboard
   */
  cleanup() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * Destroy dashboard instance
   */
  destroy() {
    this.cleanup();
    this.isInitialized = false;
  }
}

// Create global instance when dependencies are available
if (typeof window !== 'undefined') {
  window.addEventListener('supabase-auth-change', () => {
    if (window.authManager && window.profileManager && window.quotaManager && !window.dashboard) {
      window.dashboard = new Dashboard(window.authManager, window.profileManager, window.quotaManager);
    }
  });

  // Initialize immediately if dependencies are already available
  if (window.authManager && window.profileManager && window.quotaManager) {
    window.dashboard = new Dashboard(window.authManager, window.profileManager, window.quotaManager);
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Dashboard;
}