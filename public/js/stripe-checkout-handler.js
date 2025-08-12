/**
 * Stripe Checkout Session Handler
 * 
 * Handles checkout session reconciliation and return URL processing
 * as specified in requirements 3.1, 3.2, and 3.3
 */

class StripeCheckoutHandler {
  constructor(supabaseClient, authManager) {
    this.supabase = supabaseClient?.getClient() || window.supabaseClient?.getClient();
    this.authManager = authManager || window.authManager;
    this.listeners = [];
    
    // Auto-initialize if on a return page
    this.init();
  }

  /**
   * Initialize and check for return parameters
   */
  init() {
    // Check URL parameters for checkout return
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    const success = urlParams.get('success');
    const canceled = urlParams.get('canceled');
    const portalUpdated = urlParams.get('portal');

    if (sessionId && success === 'true') {
      this.handleCheckoutSuccess(sessionId);
    } else if (canceled === 'true') {
      this.handleCheckoutCanceled();
    } else if (portalUpdated === 'updated') {
      this.handlePortalReturn();
    }
  }

  /**
   * Handle successful checkout return
   */
  async handleCheckoutSuccess(sessionId) {
    try {
      console.log('Processing successful checkout session:', sessionId);
      
      // Show loading state
      this.showProcessingMessage('Processing your subscription...');
      
      // Fetch checkout session details from Stripe
      const sessionDetails = await this.fetchCheckoutSession(sessionId);
      
      if (sessionDetails) {
        // Wait a moment for webhook processing
        await this.waitForWebhookProcessing(sessionId);
        
        // Refresh user data
        await this.refreshUserData();
        
        // Show success message
        this.showSuccessMessage('Subscription activated successfully!');
        
        // Notify listeners
        this.notifyListeners('checkout_success', {
          sessionId,
          sessionDetails
        });
        
        // Clean up URL
        this.cleanupUrl();
      }
      
    } catch (error) {
      console.error('Error handling checkout success:', error);
      this.showErrorMessage('There was an issue processing your subscription. Please contact support if the problem persists.');
      
      this.notifyListeners('checkout_error', {
        sessionId,
        error: error.message
      });
    }
  }

  /**
   * Handle checkout cancellation
   */
  handleCheckoutCanceled() {
    console.log('Checkout was canceled by user');
    
    this.showInfoMessage('Checkout was canceled. You can try again anytime.');
    
    this.notifyListeners('checkout_canceled', {});
    
    // Clean up URL
    this.cleanupUrl();
  }

  /**
   * Handle return from Customer Portal
   */
  async handlePortalReturn() {
    try {
      console.log('Processing return from Customer Portal');
      
      // Show loading state
      this.showProcessingMessage('Updating your billing information...');
      
      // Wait a moment for webhook processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Refresh user data
      await this.refreshUserData();
      
      // Show success message
      this.showSuccessMessage('Billing information updated successfully!');
      
      // Notify listeners
      this.notifyListeners('portal_return', {});
      
      // Clean up URL
      this.cleanupUrl();
      
    } catch (error) {
      console.error('Error handling portal return:', error);
      this.showErrorMessage('There was an issue updating your billing information.');
      
      this.notifyListeners('portal_error', {
        error: error.message
      });
    }
  }

  /**
   * Fetch checkout session details from Stripe (via Edge Function)
   */
  async fetchCheckoutSession(sessionId) {
    try {
      const { data, error } = await this.supabase.functions.invoke('get-checkout-session', {
        body: { session_id: sessionId }
      });

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching checkout session:', error);
      // Don't throw here - we can still proceed without session details
      return null;
    }
  }

  /**
   * Wait for webhook processing to complete
   */
  async waitForWebhookProcessing(sessionId, maxAttempts = 10) {
    console.log('Waiting for webhook processing...');
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Check if webhook has been processed
        const { data, error } = await this.supabase.functions.invoke('check-webhook-status', {
          body: { session_id: sessionId }
        });

        if (!error && data?.processed) {
          console.log('Webhook processing completed');
          return true;
        }

        // Wait before next attempt (exponential backoff)
        const delay = Math.min(1000 * Math.pow(1.5, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
        
      } catch (error) {
        console.warn(`Webhook check attempt ${attempt} failed:`, error.message);
      }
    }
    
    console.warn('Webhook processing check timed out - proceeding anyway');
    return false;
  }

  /**
   * Refresh user data after subscription changes
   */
  async refreshUserData() {
    try {
      // Refresh auth session
      if (this.authManager && typeof this.authManager.refreshSession === 'function') {
        await this.authManager.refreshSession();
      }
      
      // Refresh profile data
      if (window.profileManager && typeof window.profileManager.loadUserProfile === 'function') {
        await window.profileManager.loadUserProfile();
      }
      
      // Refresh usage data
      if (window.quotaManager && typeof window.quotaManager.refreshUsage === 'function') {
        await window.quotaManager.refreshUsage();
      }
      
      console.log('User data refreshed successfully');
      
    } catch (error) {
      console.error('Error refreshing user data:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Clean up URL parameters
   */
  cleanupUrl() {
    try {
      const url = new URL(window.location);
      url.searchParams.delete('session_id');
      url.searchParams.delete('success');
      url.searchParams.delete('canceled');
      url.searchParams.delete('portal');
      
      // Update URL without page reload
      window.history.replaceState({}, document.title, url.toString());
      
    } catch (error) {
      console.error('Error cleaning up URL:', error);
    }
  }

  /**
   * Show processing message
   */
  showProcessingMessage(message) {
    this.showMessage(message, 'info', false);
  }

  /**
   * Show success message
   */
  showSuccessMessage(message) {
    this.showMessage(message, 'success', 5000);
  }

  /**
   * Show info message
   */
  showInfoMessage(message) {
    this.showMessage(message, 'info', 5000);
  }

  /**
   * Show error message
   */
  showErrorMessage(message) {
    this.showMessage(message, 'error', false);
  }

  /**
   * Show message using available notification system
   */
  showMessage(message, type = 'info', autoClose = false) {
    try {
      // Try to use existing notification system
      if (window.quotaNotifications && typeof window.quotaNotifications.showNotification === 'function') {
        window.quotaNotifications.showNotification({
          type: type,
          title: this.getMessageTitle(type),
          message: message,
          autoClose: autoClose
        });
      } else {
        // Fallback to console and simple alert for errors
        console.log(`[${type.toUpperCase()}] ${message}`);
        if (type === 'error') {
          alert(message);
        }
      }
    } catch (error) {
      console.error('Error showing message:', error);
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Get message title based on type
   */
  getMessageTitle(type) {
    switch (type) {
      case 'success':
        return 'Success';
      case 'error':
        return 'Error';
      case 'info':
        return 'Processing';
      default:
        return 'Notification';
    }
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
        console.error('Error in checkout handler listener:', error);
      }
    });
  }

  /**
   * Create checkout session with proper return URLs and callback preservation
   */
  async createCheckoutSession(planId, options = {}) {
    try {
      const user = this.authManager?.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Preserve callback URL from current page
      const callbackUrl = this.preserveCallbackUrl();
      
      const {
        successUrl = `${window.location.origin}/checkout-success.html${callbackUrl ? `?callback=${encodeURIComponent(callbackUrl)}` : ''}`,
        cancelUrl = `${window.location.origin}/pricing.html${callbackUrl ? `?callback=${encodeURIComponent(callbackUrl)}` : ''}`,
        allowPromotionCodes = true,
        billingAddressCollection = 'auto',
        customerUpdate = { address: 'auto', name: 'auto' }
      } = options;

      // Generate idempotency key for safe retries
      const idempotencyKey = `checkout-${user.id}-${planId}-${Date.now()}`;

      // Create checkout session via API endpoint
      const response = await fetch('/api/create-checkout.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`,
          'X-Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({
          plan_id: planId,
          success_url: successUrl,
          cancel_url: cancelUrl,
          allow_promotion_codes: allowPromotionCodes,
          billing_address_collection: billingAddressCollection,
          customer_update: customerUpdate
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const data = await response.json();

      return {
        success: true,
        sessionId: data.session_id,
        url: data.url,
        planId,
        planConfig: data.plan,
        customerId: data.customer_id,
        idempotencyKey: data.idempotency_key
      };

    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  }

  /**
   * Preserve current URL as callback for return after checkout
   */
  preserveCallbackUrl() {
    try {
      // Get current URL without any existing checkout parameters
      const url = new URL(window.location);
      url.searchParams.delete('session_id');
      url.searchParams.delete('success');
      url.searchParams.delete('canceled');
      url.searchParams.delete('checkout');
      
      return url.toString();
    } catch (error) {
      console.error('Error preserving callback URL:', error);
      return window.location.href;
    }
  }

  /**
   * Get authentication token for API requests
   */
  async getAuthToken() {
    try {
      const session = await this.supabase.auth.getSession();
      return session.data.session?.access_token;
    } catch (error) {
      console.error('Error getting auth token:', error);
      throw new Error('Authentication token not available');
    }
  }

  /**
   * Get plan configuration
   */
  getPlanConfig(planId) {
    // Try to get from generated config first
    if (window.STRIPE_PLAN_CONFIG && window.STRIPE_PLAN_CONFIG.plans) {
      return window.STRIPE_PLAN_CONFIG.plans[planId];
    }
    
    // Fallback to legacy config
    if (window.stripeManager && typeof window.stripeManager.getPlanFeatures === 'function') {
      return window.stripeManager.getPlanFeatures(planId);
    }
    
    return null;
  }
}

// Global utility functions
window.createCheckoutSession = async function(planId, options = {}) {
  if (!window.stripeCheckoutHandler) {
    window.stripeCheckoutHandler = new StripeCheckoutHandler();
  }
  return await window.stripeCheckoutHandler.createCheckoutSession(planId, options);
};

window.redirectToCheckout = async function(planId, options = {}) {
  try {
    const checkoutResult = await window.createCheckoutSession(planId, options);
    
    // Redirect to Stripe Checkout
    window.location.href = checkoutResult.url;
    
    return checkoutResult;
  } catch (error) {
    console.error('Error redirecting to checkout:', error);
    throw error;
  }
};

// Initialize global instance
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    if (!window.stripeCheckoutHandler) {
      window.stripeCheckoutHandler = new StripeCheckoutHandler();
    }
  });
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StripeCheckoutHandler;
}