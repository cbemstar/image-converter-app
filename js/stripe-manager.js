/**
 * StripeManager - Comprehensive Stripe payment integration
 * Handles checkout sessions, subscription management, and Customer Portal
 */

class StripeManager {
  constructor(authManager, profileManager, supabaseClient) {
    this.authManager = authManager || window.authManager;
    this.profileManager = profileManager || window.profileManager;
    this.supabase = supabaseClient?.getClient() || window.supabaseClient?.getClient();
    
    this.stripe = null;
    this.stripePublishableKey = this.getStripePublishableKey();
    this.paymentListeners = [];
    
    this.planPricing = window.APP_CONFIG?.PLAN_PRICING || {
      pro: {
        price: 9,
        currency: 'USD',
        interval: 'month',
        stripePriceId: 'price_pro_monthly'
      },
      agency: {
        price: 49,
        currency: 'USD',
        interval: 'month',
        stripePriceId: 'price_agency_monthly'
      }
    };

    this.isInitialized = false;
    this.initialize();
  }

  /**
   * Initialize Stripe
   */
  async initialize() {
    try {
      if (!this.stripePublishableKey) {
        console.warn('StripeManager: Stripe publishable key not found');
        return;
      }

      // Load Stripe.js if not already loaded
      if (!window.Stripe) {
        await this.loadStripeJS();
      }

      // Initialize Stripe instance
      this.stripe = window.Stripe(this.stripePublishableKey);
      
      if (!this.stripe) {
        throw new Error('Failed to initialize Stripe');
      }

      // Listen for auth state changes
      if (this.authManager) {
        this.authManager.addAuthStateListener((event, session) => {
          this.handleAuthStateChange(event, session);
        });
      }

      this.isInitialized = true;
      console.log('StripeManager initialized successfully');
      
    } catch (error) {
      console.error('StripeManager initialization error:', error);
    }
  }

  /**
   * Load Stripe.js dynamically
   */
  loadStripeJS() {
    return new Promise((resolve, reject) => {
      if (window.Stripe) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Get Stripe publishable key
   */
  getStripePublishableKey() {
    // Try to get from window config first
    if (window.STRIPE_CONFIG && window.STRIPE_CONFIG.STRIPE_PUBLISHABLE_KEY) {
      return window.STRIPE_CONFIG.STRIPE_PUBLISHABLE_KEY;
    }
    
    // Try to get from process.env (if available)
    if (typeof process !== 'undefined' && process.env && process.env.STRIPE_PUBLISHABLE_KEY) {
      return process.env.STRIPE_PUBLISHABLE_KEY;
    }
    
    // Development fallback (replace with actual test key)
    return 'pk_test_your-publishable-key-here';
  }

  /**
   * Handle authentication state changes
   */
  handleAuthStateChange(event, session) {
    switch (event) {
      case 'SIGNED_IN':
        this.handleUserSignIn(session);
        break;
      case 'SIGNED_OUT':
        this.clearPaymentData();
        break;
    }
  }

  /**
   * Handle user sign in
   */
  async handleUserSignIn(session) {
    try {
      // Ensure user has Stripe customer ID
      await this.ensureStripeCustomer(session.user);
    } catch (error) {
      console.error('Error handling user sign in:', error);
    }
  }

  /**
   * Ensure user has Stripe customer ID
   */
  async ensureStripeCustomer(user) {
    try {
      const profile = await this.profileManager?.loadUserProfile();
      
      if (!profile?.stripe_customer_id) {
        // Create Stripe customer via Edge Function
        const { data, error } = await this.supabase.functions.invoke('create-stripe-customer', {
          body: {
            user_id: user.id,
            email: user.email,
            name: user.user_metadata?.full_name || user.email.split('@')[0]
          }
        });

        if (error) {
          console.error('Error creating Stripe customer:', error);
          return;
        }

        // Update profile with Stripe customer ID
        if (data.customer_id && this.profileManager) {
          await this.profileManager.updateStripeCustomerId(data.customer_id);
        }
      }

    } catch (error) {
      console.error('Error ensuring Stripe customer:', error);
    }
  }

  /**
   * Create checkout session for subscription
   */
  async createCheckoutSession(planType, options = {}) {
    try {
      if (!this.isInitialized) {
        throw new Error('StripeManager not initialized');
      }

      const user = this.authManager?.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const planConfig = this.planPricing[planType];
      if (!planConfig) {
        throw new Error(`Invalid plan type: ${planType}`);
      }

      const {
        successUrl = `${window.location.origin}/dashboard.html?success=true`,
        cancelUrl = `${window.location.origin}/pricing.html?canceled=true`,
        allowPromotionCodes = true,
        billingAddressCollection = 'auto',
        customerUpdate = { address: 'auto', name: 'auto' }
      } = options;

      // Create checkout session via Edge Function
      const { data, error } = await this.supabase.functions.invoke('create-checkout-session', {
        body: {
          user_id: user.id,
          price_id: planConfig.stripePriceId,
          success_url: successUrl,
          cancel_url: cancelUrl,
          allow_promotion_codes: allowPromotionCodes,
          billing_address_collection: billingAddressCollection,
          customer_update: customerUpdate
        }
      });

      if (error) {
        throw error;
      }

      if (!data.session_id) {
        throw new Error('No session ID returned from checkout creation');
      }

      this.notifyPaymentListeners('checkout_session_created', {
        sessionId: data.session_id,
        planType,
        planConfig
      });

      return {
        success: true,
        sessionId: data.session_id,
        planType,
        planConfig
      };

    } catch (error) {
      console.error('Error creating checkout session:', error);
      this.notifyPaymentListeners('checkout_error', { error: error.message });
      throw error;
    }
  }

  /**
   * Redirect to Stripe Checkout
   */
  async redirectToCheckout(sessionId) {
    try {
      if (!this.stripe) {
        throw new Error('Stripe not initialized');
      }

      this.notifyPaymentListeners('checkout_redirect', { sessionId });

      const { error } = await this.stripe.redirectToCheckout({
        sessionId: sessionId
      });

      if (error) {
        throw error;
      }

    } catch (error) {
      console.error('Error redirecting to checkout:', error);
      this.notifyPaymentListeners('checkout_error', { error: error.message });
      throw error;
    }
  }

  /**
   * Create checkout session and redirect (convenience method)
   */
  async purchasePlan(planType, options = {}) {
    try {
      const checkoutResult = await this.createCheckoutSession(planType, options);
      await this.redirectToCheckout(checkoutResult.sessionId);
      
      return checkoutResult;

    } catch (error) {
      console.error('Error purchasing plan:', error);
      throw error;
    }
  }

  /**
   * Create Customer Portal session
   */
  async createCustomerPortalSession(options = {}) {
    try {
      const user = this.authManager?.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const {
        returnUrl = `${window.location.origin}/dashboard.html`
      } = options;

      // Create portal session via Edge Function
      const { data, error } = await this.supabase.functions.invoke('create-portal-session', {
        body: {
          user_id: user.id,
          return_url: returnUrl
        }
      });

      if (error) {
        throw error;
      }

      if (!data.portal_url) {
        throw new Error('No portal URL returned');
      }

      this.notifyPaymentListeners('portal_session_created', {
        portalUrl: data.portal_url
      });

      return {
        success: true,
        portalUrl: data.portal_url
      };

    } catch (error) {
      console.error('Error creating Customer Portal session:', error);
      this.notifyPaymentListeners('portal_error', { error: error.message });
      throw error;
    }
  }

  /**
   * Redirect to Customer Portal
   */
  async redirectToCustomerPortal(options = {}) {
    try {
      const portalResult = await this.createCustomerPortalSession(options);
      
      this.notifyPaymentListeners('portal_redirect', {
        portalUrl: portalResult.portalUrl
      });

      // Redirect to Customer Portal
      window.location.href = portalResult.portalUrl;
      
      return portalResult;

    } catch (error) {
      console.error('Error redirecting to Customer Portal:', error);
      throw error;
    }
  }

  /**
   * Get current subscription status
   */
  async getSubscriptionStatus() {
    try {
      const profile = this.profileManager?.getCurrentProfile();
      if (!profile) {
        return {
          plan: 'free',
          status: 'active',
          subscription: null
        };
      }

      const subscriptionInfo = this.profileManager.getSubscriptionInfo();
      
      return {
        plan: subscriptionInfo.plan,
        status: subscriptionInfo.status,
        subscription: subscriptionInfo.subscription_details
      };

    } catch (error) {
      console.error('Error getting subscription status:', error);
      return {
        plan: 'free',
        status: 'active',
        subscription: null
      };
    }
  }

  /**
   * Check if user has active subscription
   */
  async hasActiveSubscription() {
    try {
      const status = await this.getSubscriptionStatus();
      return status.plan !== 'free' && status.status === 'active';
    } catch (error) {
      console.error('Error checking subscription status:', error);
      return false;
    }
  }

  /**
   * Get plan features and pricing
   */
  getPlanFeatures(planType) {
    const features = {
      free: {
        name: 'Free',
        price: 0,
        currency: 'USD',
        interval: 'month',
        features: [
          '50 MB storage',
          '500 conversions/month',
          '5,000 API calls/month',
          '25 MB max file size',
          'Basic support'
        ],
        limitations: [
          'Limited storage space',
          'Monthly conversion limits',
          'Basic file size limits'
        ]
      },
      pro: {
        name: 'Pro',
        price: this.planPricing.pro.price,
        currency: this.planPricing.pro.currency,
        interval: this.planPricing.pro.interval,
        features: [
          '2 GB storage',
          '5,000 conversions/month',
          '50,000 API calls/month',
          '100 MB max file size',
          'Priority support',
          'Advanced tools',
          'Batch processing'
        ],
        popular: true
      },
      agency: {
        name: 'Agency',
        price: this.planPricing.agency.price,
        currency: this.planPricing.agency.currency,
        interval: this.planPricing.agency.interval,
        features: [
          '20 GB storage',
          '50,000 conversions/month',
          '500,000 API calls/month',
          '250 MB max file size',
          '24/7 priority support',
          'All advanced tools',
          'Unlimited batch processing',
          'API access',
          'White-label options'
        ]
      }
    };

    return features[planType] || features.free;
  }

  /**
   * Get all plan features for comparison
   */
  getAllPlanFeatures() {
    return {
      free: this.getPlanFeatures('free'),
      pro: this.getPlanFeatures('pro'),
      agency: this.getPlanFeatures('agency')
    };
  }

  /**
   * Handle successful payment
   */
  handlePaymentSuccess(sessionId) {
    this.notifyPaymentListeners('payment_success', { sessionId });
    
    // Show success message
    this.showPaymentMessage('Payment successful! Your subscription is now active.', 'success');
    
    // Refresh profile data
    if (this.profileManager) {
      this.profileManager.loadUserProfile();
    }
  }

  /**
   * Handle payment cancellation
   */
  handlePaymentCancellation() {
    this.notifyPaymentListeners('payment_cancelled', {});
    
    // Show cancellation message
    this.showPaymentMessage('Payment was cancelled. You can try again anytime.', 'info');
  }

  /**
   * Handle payment error
   */
  handlePaymentError(error) {
    this.notifyPaymentListeners('payment_error', { error });
    
    // Show error message
    this.showPaymentMessage(`Payment failed: ${error.message}`, 'error');
  }

  /**
   * Show payment message to user
   */
  showPaymentMessage(message, type = 'info') {
    // Try to use existing notification system
    if (window.quotaNotifications) {
      window.quotaNotifications.showNotification({
        type: type,
        title: type === 'success' ? 'Payment Successful' : 
               type === 'error' ? 'Payment Error' : 'Payment Info',
        message: message,
        autoClose: type === 'success' ? 5000 : false
      });
    } else {
      // Fallback to alert
      alert(message);
    }
  }

  /**
   * Validate webhook signature (client-side verification)
   */
  validateWebhookSignature(payload, signature, secret) {
    // This would typically be done server-side
    // Client-side validation is not recommended for security
    console.warn('Webhook signature validation should be done server-side');
    return true;
  }

  /**
   * Process webhook event (for testing purposes)
   */
  processWebhookEvent(event) {
    console.log('Processing webhook event:', event.type);
    
    switch (event.type) {
      case 'checkout.session.completed':
        this.handleCheckoutCompleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        this.handlePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        this.handlePaymentFailed(event.data.object);
        break;
      case 'customer.subscription.updated':
        this.handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        this.handleSubscriptionDeleted(event.data.object);
        break;
      default:
        console.log('Unhandled webhook event type:', event.type);
    }
  }

  /**
   * Handle checkout completed webhook
   */
  handleCheckoutCompleted(session) {
    this.notifyPaymentListeners('checkout_completed', { session });
    
    // Refresh user profile to get updated subscription
    if (this.profileManager) {
      setTimeout(() => {
        this.profileManager.loadUserProfile();
      }, 2000); // Small delay to allow webhook processing
    }
  }

  /**
   * Handle payment succeeded webhook
   */
  handlePaymentSucceeded(invoice) {
    this.notifyPaymentListeners('payment_succeeded', { invoice });
  }

  /**
   * Handle payment failed webhook
   */
  handlePaymentFailed(invoice) {
    this.notifyPaymentListeners('payment_failed', { invoice });
    
    this.showPaymentMessage(
      'Payment failed. Please update your payment method in the Customer Portal.',
      'error'
    );
  }

  /**
   * Handle subscription updated webhook
   */
  handleSubscriptionUpdated(subscription) {
    this.notifyPaymentListeners('subscription_updated', { subscription });
    
    // Refresh user profile
    if (this.profileManager) {
      this.profileManager.loadUserProfile();
    }
  }

  /**
   * Handle subscription deleted webhook
   */
  handleSubscriptionDeleted(subscription) {
    this.notifyPaymentListeners('subscription_deleted', { subscription });
    
    this.showPaymentMessage(
      'Your subscription has been cancelled. You\'ve been moved to the free plan.',
      'info'
    );
    
    // Refresh user profile
    if (this.profileManager) {
      this.profileManager.loadUserProfile();
    }
  }

  /**
   * Clear payment data on sign out
   */
  clearPaymentData() {
    this.notifyPaymentListeners('payment_data_cleared', {});
  }

  /**
   * Add payment event listener
   */
  addPaymentListener(callback) {
    this.paymentListeners.push(callback);
  }

  /**
   * Remove payment event listener
   */
  removePaymentListener(callback) {
    this.paymentListeners = this.paymentListeners.filter(listener => listener !== callback);
  }

  /**
   * Notify all payment listeners
   */
  notifyPaymentListeners(event, data) {
    this.paymentListeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error in payment listener:', error);
      }
    });
  }

  /**
   * Format price for display
   */
  formatPrice(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  /**
   * Get upgrade recommendation based on usage
   */
  getUpgradeRecommendation(currentPlan, usageData) {
    if (currentPlan === 'agency') {
      return null; // Already on highest plan
    }

    const recommendations = [];

    // Check storage usage
    if (usageData.storage?.percentage > 80) {
      recommendations.push({
        reason: 'storage',
        message: 'You\'re running low on storage space',
        suggestedPlan: currentPlan === 'free' ? 'pro' : 'agency'
      });
    }

    // Check conversion usage
    if (usageData.conversions?.percentage > 80) {
      recommendations.push({
        reason: 'conversions',
        message: 'You\'re approaching your monthly conversion limit',
        suggestedPlan: currentPlan === 'free' ? 'pro' : 'agency'
      });
    }

    // Check API usage
    if (usageData.apiCalls?.percentage > 80) {
      recommendations.push({
        reason: 'api_calls',
        message: 'You\'re approaching your API call limit',
        suggestedPlan: currentPlan === 'free' ? 'pro' : 'agency'
      });
    }

    return recommendations.length > 0 ? recommendations[0] : null;
  }
}

// Global utility functions
window.purchasePlan = async function(planType, options = {}) {
  if (!window.stripeManager) {
    throw new Error('StripeManager not available');
  }
  return await window.stripeManager.purchasePlan(planType, options);
};

window.openCustomerPortal = async function(options = {}) {
  if (!window.stripeManager) {
    throw new Error('StripeManager not available');
  }
  return await window.stripeManager.redirectToCustomerPortal(options);
};

window.getSubscriptionStatus = async function() {
  if (!window.stripeManager) {
    return { plan: 'free', status: 'active', subscription: null };
  }
  return await window.stripeManager.getSubscriptionStatus();
};

// Create global instance when dependencies are available
if (typeof window !== 'undefined') {
  window.addEventListener('supabase-auth-change', () => {
    if (window.authManager && window.profileManager && window.supabaseClient && !window.stripeManager) {
      window.stripeManager = new StripeManager(window.authManager, window.profileManager, window.supabaseClient);
    }
  });

  // Initialize immediately if dependencies are already available
  if (window.authManager && window.profileManager && window.supabaseClient) {
    window.stripeManager = new StripeManager(window.authManager, window.profileManager, window.supabaseClient);
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StripeManager;
}