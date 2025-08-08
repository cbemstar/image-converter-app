/**
 * ToolIntegration - Universal integration script for all tools
 * Provides authentication, quota checking, and usage tracking for tools
 */

class ToolIntegration {
  constructor(toolConfig = {}) {
    this.toolName = toolConfig.name || this.detectToolName();
    this.toolType = toolConfig.type || 'utility';
    this.requiresAuth = toolConfig.requiresAuth === true; // Default to false
    this.quotaType = toolConfig.quotaType || 'conversions';
    this.trackUsage = toolConfig.trackUsage !== false; // Default to true
    
    this.authManager = null;
    this.quotaManager = null;
    this.analyticsManager = null;
    this.errorHandler = null;
    
    this.isInitialized = false;
    this.initialize();
  }

  /**
   * Initialize tool integration
   */
  async initialize() {
    try {
      // Wait for core managers to be available
      await this.waitForManagers();
      
      // Set up authentication check only if explicitly required
      if (this.requiresAuth) {
        this.setupAuthenticationCheck();
      }
      
      // Set up quota monitoring
      this.setupQuotaMonitoring();
      
      // Set up usage tracking
      if (this.trackUsage) {
        this.setupUsageTracking();
      }
      
      // Set up UI enhancements
      this.setupUIEnhancements();
      
      this.isInitialized = true;
      console.log(`Tool integration initialized for: ${this.toolName}`);
      
    } catch (error) {
      console.error('Tool integration initialization error:', error);
      if (this.errorHandler) {
        this.errorHandler.handleError(error, { tool: this.toolName });
      }
    }
  }

  /**
   * Wait for core managers to be available
   */
  async waitForManagers() {
    return new Promise((resolve) => {
      const checkManagers = () => {
        this.authManager = window.authManager;
        this.quotaManager = window.quotaManager;
        this.analyticsManager = window.analyticsManager;
        this.errorHandler = window.errorHandler;
        
        // We need at least error handler to be available
        if (this.errorHandler) {
          resolve();
        } else {
          setTimeout(checkManagers, 100);
        }
      };
      checkManagers();
    });
  }

  /**
   * Detect tool name from URL or page title
   */
  detectToolName() {
    const path = window.location.pathname;
    const pathParts = path.split('/');
    
    // Try to get tool name from path
    if (pathParts.includes('tools') && pathParts.length > 2) {
      const toolIndex = pathParts.indexOf('tools');
      return pathParts[toolIndex + 1] || 'unknown-tool';
    }
    
    // Fallback to page title
    return document.title.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'unknown-tool';
  }

  /**
   * Set up authentication check
   */
  setupAuthenticationCheck() {
    if (!this.authManager) return;

    // Listen for auth state changes
    this.authManager.addAuthStateListener((event, session) => {
      if (event === 'SIGNED_OUT') {
        this.handleSignOut();
      } else if (event === 'SIGNED_IN') {
        this.handleSignIn(session);
      }
    });

    // Show user info if already signed in
    if (this.authManager.isAuthenticated()) {
      this.displayUserInfo();
    }
  }

  /**
   * Show authentication prompt
   */
  showAuthPrompt() {
    // Create auth prompt overlay
    const overlay = document.createElement('div');
    overlay.className = 'auth-prompt-overlay';
    overlay.innerHTML = `
      <div class="auth-prompt">
        <div class="auth-prompt-content">
          <h3>Sign In Required</h3>
          <p>Please sign in to use this tool and save your work.</p>
          <div class="auth-prompt-buttons">
            <button class="btn btn-primary" onclick="window.location.href='/auth.html'">
              Sign In
            </button>
            <button class="btn btn-secondary" onclick="this.closest('.auth-prompt-overlay').remove()">
              Continue as Guest
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Add styles
    const styles = `
      <style>
        .auth-prompt-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
        }
        .auth-prompt {
          background: white;
          border-radius: 12px;
          padding: 30px;
          max-width: 400px;
          text-align: center;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
        }
        .auth-prompt h3 {
          margin-bottom: 12px;
          color: #1f2937;
        }
        .auth-prompt p {
          margin-bottom: 24px;
          color: #6b7280;
        }
        .auth-prompt-buttons {
          display: flex;
          gap: 12px;
          justify-content: center;
        }
        .btn {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          display: inline-block;
        }
        .btn-primary {
          background: #3b82f6;
          color: white;
        }
        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
        }
      </style>
    `;
    
    if (!document.getElementById('auth-prompt-styles')) {
      document.head.insertAdjacentHTML('beforeend', styles.replace('<style>', '<style id="auth-prompt-styles">'));
    }
    
    document.body.appendChild(overlay);
    
    // Store current page for redirect after auth
    sessionStorage.setItem('auth_redirect', window.location.href);
  }

  /**
   * Handle user sign in
   */
  handleSignIn(session) {
    // Remove auth prompt if it exists
    const authPrompt = document.querySelector('.auth-prompt-overlay');
    if (authPrompt) {
      authPrompt.remove();
    }
    
    // Show welcome message
    if (this.errorHandler) {
      this.errorHandler.showSuccess('Welcome!', 'You are now signed in and can use all features.');
    }
    
    // Update UI
    this.displayUserInfo();
    
    // Track sign in
    this.trackEvent('user_signed_in', { tool: this.toolName });
  }

  /**
   * Handle user sign out
   */
  handleSignOut() {
    // Clear user info
    this.clearUserInfo();

    // Track sign out
    this.trackEvent('user_signed_out', { tool: this.toolName });
  }

  /**
   * Display user info in tool
   */
  displayUserInfo() {
    if (!this.authManager || !this.authManager.isAuthenticated()) return;
    
    const user = this.authManager.getCurrentUser();
    if (!user) return;
    
    // Look for user info container or create one
    let userInfoContainer = document.getElementById('user-info');
    if (!userInfoContainer) {
      userInfoContainer = document.createElement('div');
      userInfoContainer.id = 'user-info';
      userInfoContainer.className = 'user-info';
      
      // Try to add to header or top of page
      const header = document.querySelector('header, .header, .tool-header');
      if (header) {
        header.appendChild(userInfoContainer);
      } else {
        document.body.insertBefore(userInfoContainer, document.body.firstChild);
      }
    }
    
    const name = user.user_metadata?.full_name || user.email.split('@')[0];
    userInfoContainer.innerHTML = `
      <div class="user-info-content">
        <img src="${user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}&background=3b82f6&color=fff&size=32`}" 
             alt="User avatar" class="user-avatar">
        <span class="user-name">${name}</span>
        <a href="/dashboard.html" class="dashboard-link">Dashboard</a>
      </div>
    `;
    
    // Add styles
    const styles = `
      <style id="user-info-styles">
        .user-info {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 1000;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          padding: 8px 12px;
        }
        .user-info-content {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .user-avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
        }
        .user-name {
          font-size: 14px;
          font-weight: 500;
          color: #374151;
        }
        .dashboard-link {
          font-size: 12px;
          color: #3b82f6;
          text-decoration: none;
          padding: 2px 6px;
          border-radius: 4px;
          background: #eff6ff;
        }
        .dashboard-link:hover {
          background: #dbeafe;
        }
      </style>
    `;
    
    if (!document.getElementById('user-info-styles')) {
      document.head.insertAdjacentHTML('beforeend', styles);
    }
  }

  /**
   * Clear user info
   */
  clearUserInfo() {
    const userInfo = document.getElementById('user-info');
    if (userInfo) {
      userInfo.remove();
    }
  }

  /**
   * Set up quota monitoring
   */
  setupQuotaMonitoring() {
    if (!this.quotaManager) return;
    
    // Listen for quota updates
    this.quotaManager.addQuotaListener((event, data) => {
      this.handleQuotaUpdate(event, data);
    });
    
    // Show quota status
    this.displayQuotaStatus();
  }

  /**
   * Handle quota updates
   */
  handleQuotaUpdate(event, data) {
    switch (event) {
      case 'quota_warning':
        this.handleQuotaWarning(data);
        break;
      case 'quota_exceeded':
        this.handleQuotaExceeded(data);
        break;
    }
  }

  /**
   * Handle quota warnings
   */
  handleQuotaWarning(data) {
    if (this.errorHandler) {
      this.errorHandler.showWarning(
        'Usage Warning',
        `You've used ${Math.round(data.percentage)}% of your ${data.quotaType} quota.`,
        {
          actions: [
            { label: 'Upgrade', action: () => window.location.href = '/pricing.html' }
          ]
        }
      );
    }
  }

  /**
   * Handle quota exceeded
   */
  handleQuotaExceeded(data) {
    if (this.errorHandler) {
      this.errorHandler.showError(
        'Quota Exceeded',
        `You have reached your ${data.quotaType} limit. Please upgrade to continue.`,
        {
          actions: [
            { label: 'Upgrade Now', action: () => window.location.href = '/pricing.html' }
          ],
          duration: 0 // Don't auto-hide
        }
      );
    }
    
    // Disable tool functionality
    this.disableToolFunctionality();
  }

  /**
   * Display quota status
   */
  displayQuotaStatus() {
    if (!this.quotaManager) return;
    
    const usage = this.quotaManager.getCurrentUsage();
    const quotaData = usage[this.quotaType];
    
    if (!quotaData) return;
    
    // Create quota status display
    let quotaStatus = document.getElementById('quota-status');
    if (!quotaStatus) {
      quotaStatus = document.createElement('div');
      quotaStatus.id = 'quota-status';
      quotaStatus.className = 'quota-status';
      
      // Add to bottom of page
      document.body.appendChild(quotaStatus);
    }
    
    const percentage = Math.min(100, quotaData.percentage || 0);
    const colorClass = percentage >= 95 ? 'danger' : percentage >= 85 ? 'warning' : 'success';
    
    quotaStatus.innerHTML = `
      <div class="quota-status-content">
        <span class="quota-label">${this.quotaType}:</span>
        <div class="quota-bar">
          <div class="quota-fill quota-${colorClass}" style="width: ${percentage}%"></div>
        </div>
        <span class="quota-text">${quotaData.current || 0} / ${quotaData.limit || 0}</span>
      </div>
    `;
    
    // Add styles
    const styles = `
      <style id="quota-status-styles">
        .quota-status {
          position: fixed;
          bottom: 20px;
          left: 20px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          padding: 12px 16px;
          z-index: 1000;
          font-size: 12px;
        }
        .quota-status-content {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .quota-label {
          font-weight: 500;
          color: #374151;
          text-transform: capitalize;
        }
        .quota-bar {
          width: 60px;
          height: 4px;
          background: #e5e7eb;
          border-radius: 2px;
          overflow: hidden;
        }
        .quota-fill {
          height: 100%;
          transition: width 0.3s ease;
        }
        .quota-success { background: #10b981; }
        .quota-warning { background: #f59e0b; }
        .quota-danger { background: #ef4444; }
        .quota-text {
          color: #6b7280;
          font-size: 11px;
        }
      </style>
    `;
    
    if (!document.getElementById('quota-status-styles')) {
      document.head.insertAdjacentHTML('beforeend', styles);
    }
  }

  /**
   * Set up usage tracking
   */
  setupUsageTracking() {
    // Track page view
    this.trackEvent('tool_page_view', {
      tool: this.toolName,
      type: this.toolType
    });
    
    // Track tool interactions
    this.setupInteractionTracking();
  }

  /**
   * Set up interaction tracking
   */
  setupInteractionTracking() {
    // Track button clicks
    document.addEventListener('click', (e) => {
      if (e.target.matches('button, .btn, [role="button"]')) {
        this.trackEvent('button_click', {
          tool: this.toolName,
          button: e.target.textContent?.trim() || 'unknown',
          element: e.target.className
        });
      }
    });
    
    // Track form submissions
    document.addEventListener('submit', (e) => {
      this.trackEvent('form_submit', {
        tool: this.toolName,
        form: e.target.id || 'unknown'
      });
    });
    
    // Track file uploads
    document.addEventListener('change', (e) => {
      if (e.target.type === 'file' && e.target.files.length > 0) {
        this.trackEvent('file_upload', {
          tool: this.toolName,
          file_count: e.target.files.length,
          file_types: Array.from(e.target.files).map(f => f.type).join(',')
        });
      }
    });
  }

  /**
   * Set up UI enhancements
   */
  setupUIEnhancements() {
    // Add back to home link if not present
    this.addBackToHomeLink();
    
    // Add tool branding
    this.addToolBranding();
  }

  /**
   * Add back to home link
   */
  addBackToHomeLink() {
    if (document.querySelector('.back-to-home')) return;
    
    const backLink = document.createElement('div');
    backLink.className = 'back-to-home';
    backLink.innerHTML = `
      <a href="/" class="back-link">
        <i class="fas fa-arrow-left"></i>
        Back to Home
      </a>
    `;
    
    // Add to top of page
    document.body.insertBefore(backLink, document.body.firstChild);
    
    // Add styles
    const styles = `
      <style id="back-to-home-styles">
        .back-to-home {
          padding: 16px 20px;
        }
        .back-link {
          color: #3b82f6;
          text-decoration: none;
          font-weight: 500;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .back-link:hover {
          text-decoration: underline;
        }
      </style>
    `;
    
    if (!document.getElementById('back-to-home-styles')) {
      document.head.insertAdjacentHTML('beforeend', styles);
    }
  }

  /**
   * Add tool branding
   */
  addToolBranding() {
    // Add consistent styling and branding
    const styles = `
      <style id="tool-branding-styles">
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .tool-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }
      </style>
    `;
    
    if (!document.getElementById('tool-branding-styles')) {
      document.head.insertAdjacentHTML('beforeend', styles);
    }
  }

  /**
   * Check quota before operation
   */
  async checkQuota(operation = 'conversion') {
    if (!this.quotaManager) return true;
    
    try {
      const canProceed = await this.quotaManager.checkQuota(this.quotaType, 1);
      
      if (!canProceed) {
        if (this.errorHandler) {
          this.errorHandler.showError(
            'Quota Exceeded',
            `You have reached your ${this.quotaType} limit. Please upgrade to continue.`,
            {
              actions: [
                { label: 'Upgrade Now', action: () => window.location.href = '/pricing.html' }
              ]
            }
          );
        }
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error checking quota:', error);
      return true; // Allow operation if quota check fails
    }
  }

  /**
   * Track tool usage
   */
  trackToolUsage(action, metadata = {}) {
    this.trackEvent('tool_usage', {
      tool: this.toolName,
      action: action,
      ...metadata
    });
  }

  /**
   * Track event
   */
  trackEvent(eventType, data = {}) {
    if (this.analyticsManager) {
      this.analyticsManager.trackEvent(eventType, {
        ...data,
        tool: this.toolName,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Disable tool functionality when quota exceeded
   */
  disableToolFunctionality() {
    // Disable all buttons and form elements
    const buttons = document.querySelectorAll('button, input[type="submit"]');
    buttons.forEach(button => {
      button.disabled = true;
      button.style.opacity = '0.5';
    });
    
    // Show overlay
    const overlay = document.createElement('div');
    overlay.className = 'quota-exceeded-overlay';
    overlay.innerHTML = `
      <div class="quota-exceeded-message">
        <h3>Usage Limit Reached</h3>
        <p>You have reached your usage limit for this tool.</p>
        <a href="/pricing.html" class="btn btn-primary">Upgrade Now</a>
      </div>
    `;
    
    document.body.appendChild(overlay);
  }

  /**
   * Get tool configuration
   */
  getConfig() {
    return {
      toolName: this.toolName,
      toolType: this.toolType,
      requiresAuth: this.requiresAuth,
      quotaType: this.quotaType,
      trackUsage: this.trackUsage
    };
  }
}

// Global utility function to initialize tool integration
window.initializeToolIntegration = function(config = {}) {
  if (!window.toolIntegration) {
    window.toolIntegration = new ToolIntegration(config);
  }
  return window.toolIntegration;
};

// Auto-initialize with default config
if (typeof window !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.toolIntegration = new ToolIntegration();
    });
  } else {
    window.toolIntegration = new ToolIntegration();
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ToolIntegration;
}