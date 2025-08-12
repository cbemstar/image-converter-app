/**
 * Billing Management UI Component
 * 
 * Provides UI components for subscription management and billing operations
 * as specified in requirements 4.1, 4.2, 4.6, and 4.7
 */

class BillingManagement {
  constructor(authManager, profileManager, checkoutHandler) {
    this.authManager = authManager || window.authManager;
    this.profileManager = profileManager || window.profileManager;
    this.checkoutHandler = checkoutHandler || window.stripeCheckoutHandler;
    
    this.currentSubscription = null;
    this.isLoading = false;
    this.listeners = [];
    
    this.init();
  }

  /**
   * Initialize billing management
   */
  async init() {
    try {
      // Wait for dependencies
      await this.waitForDependencies();
      
      // Load current subscription data
      await this.loadSubscriptionData();
      
      // Set up auth state listener
      this.setupAuthListener();
      
      console.log('BillingManagement initialized');
      
    } catch (error) {
      console.error('BillingManagement initialization error:', error);
    }
  }

  /**
   * Wait for required dependencies
   */
  async waitForDependencies() {
    return new Promise((resolve) => {
      const checkDependencies = () => {
        if (this.authManager && this.profileManager && this.checkoutHandler) {
          resolve();
        } else {
          setTimeout(checkDependencies, 100);
        }
      };
      checkDependencies();
    });
  }

  /**
   * Set up authentication state listener
   */
  setupAuthListener() {
    if (this.authManager && typeof this.authManager.addAuthStateListener === 'function') {
      this.authManager.addAuthStateListener((event, session) => {
        if (event === 'SIGNED_IN') {
          this.loadSubscriptionData();
        } else if (event === 'SIGNED_OUT') {
          this.clearSubscriptionData();
        }
      });
    }
  }

  /**
   * Load current subscription data
   */
  async loadSubscriptionData() {
    try {
      const profile = this.profileManager?.getCurrentProfile();
      if (profile && profile.subscription_info) {
        this.currentSubscription = profile.subscription_info;
        this.notifyListeners('subscription_loaded', this.currentSubscription);
      }
    } catch (error) {
      console.error('Error loading subscription data:', error);
    }
  }

  /**
   * Clear subscription data
   */
  clearSubscriptionData() {
    this.currentSubscription = null;
    this.notifyListeners('subscription_cleared', null);
  }

  /**
   * Get current subscription status
   */
  getSubscriptionStatus() {
    if (!this.currentSubscription) {
      return {
        plan: 'free',
        status: 'active',
        hasActiveSubscription: false
      };
    }

    return {
      plan: this.currentSubscription.plan || 'free',
      status: this.currentSubscription.status || 'active',
      hasActiveSubscription: this.currentSubscription.plan !== 'free',
      currentPeriodEnd: this.currentSubscription.current_period_end,
      cancelAtPeriodEnd: this.currentSubscription.cancel_at_period_end
    };
  }

  /**
   * Open Customer Portal for billing management
   */
  async openCustomerPortal(options = {}) {
    if (this.isLoading) {
      return;
    }

    try {
      this.isLoading = true;
      this.notifyListeners('portal_opening', {});

      // Check if user has active subscription
      const status = this.getSubscriptionStatus();
      if (!status.hasActiveSubscription) {
        throw new Error('Customer Portal requires an active subscription. Please subscribe to a plan first.');
      }

      // Open Customer Portal with return URL configuration
      await this.checkoutHandler.redirectToCustomerPortal({
        returnUrl: options.returnUrl || window.location.href,
        ...options
      });

    } catch (error) {
      console.error('Error opening Customer Portal:', error);
      this.notifyListeners('portal_error', { error: error.message });
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Create billing management UI
   */
  createBillingUI(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container with ID '${containerId}' not found`);
    }

    const status = this.getSubscriptionStatus();
    
    container.innerHTML = this.generateBillingHTML(status);
    this.attachBillingEventListeners(container);
  }

  /**
   * Generate billing management HTML
   */
  generateBillingHTML(status) {
    if (!status.hasActiveSubscription) {
      return this.generateFreePlanHTML();
    }

    return this.generateSubscriptionHTML(status);
  }

  /**
   * Generate HTML for free plan users
   */
  generateFreePlanHTML() {
    return `
      <div class="billing-card">
        <div class="billing-header">
          <h3>Current Plan: Free</h3>
          <span class="plan-badge free">Free</span>
        </div>
        <div class="billing-content">
          <p>You're currently on the free plan with limited features.</p>
          <div class="plan-features">
            <ul>
              <li>10 conversions per month</li>
              <li>25MB max file size</li>
              <li>Basic support</li>
            </ul>
          </div>
          <div class="billing-actions">
            <button class="btn btn-primary upgrade-btn" data-plan="pro">
              Upgrade to Pro
            </button>
            <button class="btn btn-secondary upgrade-btn" data-plan="unlimited">
              Upgrade to Unlimited
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Generate HTML for subscription users
   */
  generateSubscriptionHTML(status) {
    const planName = status.plan.charAt(0).toUpperCase() + status.plan.slice(1);
    const statusClass = status.status === 'active' ? 'active' : 'inactive';
    const statusText = status.status === 'active' ? 'Active' : status.status;
    
    return `
      <div class="billing-card">
        <div class="billing-header">
          <h3>Current Plan: ${planName}</h3>
          <span class="plan-badge ${status.plan}">${planName}</span>
          <span class="status-badge ${statusClass}">${statusText}</span>
        </div>
        <div class="billing-content">
          <div class="subscription-details">
            ${status.currentPeriodEnd ? `
              <div class="detail-row">
                <span class="detail-label">Next billing date:</span>
                <span class="detail-value">${new Date(status.currentPeriodEnd).toLocaleDateString()}</span>
              </div>
            ` : ''}
            ${status.cancelAtPeriodEnd ? `
              <div class="detail-row">
                <span class="detail-label">Status:</span>
                <span class="detail-value warning">Cancels at period end</span>
              </div>
            ` : ''}
          </div>
          <div class="billing-actions">
            <button class="btn btn-primary portal-btn">
              Manage Billing
            </button>
            <button class="btn btn-secondary change-plan-btn">
              Change Plan
            </button>
          </div>
        </div>
      </div>
      
      <div class="billing-features">
        <h4>Your Plan Features</h4>
        <div id="current-plan-features">
          <!-- Features will be populated by JavaScript -->
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners to billing UI
   */
  attachBillingEventListeners(container) {
    // Portal button
    const portalBtn = container.querySelector('.portal-btn');
    if (portalBtn) {
      portalBtn.addEventListener('click', () => {
        this.openCustomerPortal();
      });
    }

    // Upgrade buttons
    const upgradeButtons = container.querySelectorAll('.upgrade-btn');
    upgradeButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const planId = e.target.dataset.plan;
        this.upgradeToPlan(planId);
      });
    });

    // Change plan button
    const changePlanBtn = container.querySelector('.change-plan-btn');
    if (changePlanBtn) {
      changePlanBtn.addEventListener('click', () => {
        this.showPlanChangeOptions();
      });
    }

    // Populate plan features
    this.populatePlanFeatures(container);
  }

  /**
   * Populate current plan features
   */
  populatePlanFeatures(container) {
    const featuresContainer = container.querySelector('#current-plan-features');
    if (!featuresContainer) return;

    const status = this.getSubscriptionStatus();
    const planConfig = this.checkoutHandler?.getPlanConfig(status.plan);
    
    if (planConfig && planConfig.features) {
      const featuresHTML = planConfig.features.map(feature => 
        `<div class="feature-item">✓ ${feature}</div>`
      ).join('');
      
      featuresContainer.innerHTML = featuresHTML;
    }
  }

  /**
   * Upgrade to a specific plan
   */
  async upgradeToPlan(planId) {
    try {
      this.notifyListeners('upgrade_started', { planId });
      
      // Use checkout handler to create upgrade session
      await window.redirectToCheckout(planId, {
        successUrl: `${window.location.origin}/checkout-success.html?callback=${encodeURIComponent(window.location.href)}`,
        cancelUrl: `${window.location.href}?upgrade=canceled`
      });
      
    } catch (error) {
      console.error('Error upgrading plan:', error);
      this.notifyListeners('upgrade_error', { error: error.message });
      throw error;
    }
  }

  /**
   * Show plan change options
   */
  showPlanChangeOptions() {
    // This could open a modal or redirect to pricing page
    this.notifyListeners('plan_change_requested', {});
    
    // For now, redirect to pricing page
    window.location.href = 'pricing.html?source=billing';
  }

  /**
   * Create compact billing widget
   */
  createBillingWidget(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container with ID '${containerId}' not found`);
    }

    const status = this.getSubscriptionStatus();
    const planName = status.plan.charAt(0).toUpperCase() + status.plan.slice(1);
    
    container.innerHTML = `
      <div class="billing-widget">
        <div class="widget-content">
          <div class="plan-info">
            <span class="plan-name">${planName} Plan</span>
            <span class="plan-status ${status.status}">${status.status}</span>
          </div>
          <button class="btn btn-sm ${status.hasActiveSubscription ? 'portal-btn' : 'upgrade-btn'}" 
                  ${!status.hasActiveSubscription ? 'data-plan="pro"' : ''}>
            ${status.hasActiveSubscription ? 'Manage' : 'Upgrade'}
          </button>
        </div>
      </div>
    `;

    this.attachBillingEventListeners(container);
  }

  /**
   * Add event listener
   */
  addListener(callback) {
    this.listeners.push(callback);
  }

  /**
   * Remove event listener
   */
  removeListener(callback) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  /**
   * Notify all listeners
   */
  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error in billing management listener:', error);
      }
    });
  }

  /**
   * Show billing message
   */
  showMessage(message, type = 'info') {
    // Try to use existing notification system
    if (window.quotaNotifications && typeof window.quotaNotifications.showNotification === 'function') {
      window.quotaNotifications.showNotification({
        type: type,
        title: this.getMessageTitle(type),
        message: message,
        autoClose: type === 'success' ? 5000 : false
      });
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
      if (type === 'error') {
        alert(message);
      }
    }
  }

  /**
   * Get message title based on type
   */
  getMessageTitle(type) {
    switch (type) {
      case 'success':
        return 'Billing Success';
      case 'error':
        return 'Billing Error';
      case 'info':
        return 'Billing Info';
      default:
        return 'Billing';
    }
  }
}

// Global utility functions
window.openCustomerPortal = async function(options = {}) {
  if (!window.billingManager) {
    window.billingManager = new BillingManagement();
  }
  return await window.billingManager.openCustomerPortal(options);
};

window.createBillingUI = function(containerId) {
  if (!window.billingManager) {
    window.billingManager = new BillingManagement();
  }
  return window.billingManager.createBillingUI(containerId);
};

window.createBillingWidget = function(containerId) {
  if (!window.billingManager) {
    window.billingManager = new BillingManagement();
  }
  return window.billingManager.createBillingWidget(containerId);
};

// Initialize global instance
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    if (window.authManager && window.profileManager && window.stripeCheckoutHandler && !window.billingManager) {
      window.billingManager = new BillingManagement();
    }
  });

  // Initialize when dependencies are available
  window.addEventListener('supabase-auth-change', () => {
    if (window.authManager && window.profileManager && window.stripeCheckoutHandler && !window.billingManager) {
      window.billingManager = new BillingManagement();
    }
  });
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BillingManagement;
}