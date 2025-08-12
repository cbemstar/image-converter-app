/**
 * Email Verification Guards
 * Enforces email verification requirements for paid features and sensitive operations
 */

import { useAuth } from './hooks/useAuth.js';
import { getEmailVerification } from './components/email-verification.js';

class VerificationGuards {
  constructor() {
    this.useAuth = useAuth();
    this.emailVerification = getEmailVerification();
    this.guardedElements = new Map();
    this.guardedFeatures = new Set();
    
    this.initialize();
  }

  /**
   * Initialize verification guards system
   */
  initialize() {
    // Subscribe to auth state changes
    this.useAuth.subscribe((state) => {
      this.handleAuthStateChange(state);
    });

    // Set up automatic guards for common features
    this.setupAutomaticGuards();
  }

  /**
   * Handle authentication state changes
   */
  handleAuthStateChange(state) {
    console.log('VerificationGuards: Auth state changed', state);
    
    // Update all guarded elements
    this.updateGuardedElements(state);
  }

  /**
   * Set up automatic guards for common paid features
   */
  setupAutomaticGuards() {
    // Guard Stripe Checkout access
    this.addFeatureGuard('stripe-checkout', {
      requireEmailVerification: true,
      blockMessage: 'Email verification required to access billing features',
      redirectToVerification: true
    });

    // Guard Customer Portal access
    this.addFeatureGuard('customer-portal', {
      requireEmailVerification: true,
      blockMessage: 'Email verification required to manage billing',
      redirectToVerification: true
    });

    // Guard plan upgrades
    this.addFeatureGuard('plan-upgrade', {
      requireEmailVerification: true,
      blockMessage: 'Please verify your email before upgrading your plan',
      redirectToVerification: true
    });

    // Guard subscription management
    this.addFeatureGuard('subscription-management', {
      requireEmailVerification: true,
      blockMessage: 'Email verification required for subscription changes',
      redirectToVerification: true
    });

    // Guard premium conversions (if applicable)
    this.addFeatureGuard('premium-conversions', {
      requireEmailVerification: true,
      blockMessage: 'Email verification required for premium features',
      showUpgradeOption: true
    });

    // Set up element-based guards
    this.setupElementGuards();
  }

  /**
   * Set up guards based on data attributes
   */
  setupElementGuards() {
    // Find elements that require email verification
    const verificationRequiredElements = document.querySelectorAll('[data-require-verified-email]');
    
    verificationRequiredElements.forEach((element) => {
      if (!element.id) {
        element.id = 'verification-guard-' + Math.random().toString(36).substr(2, 9);
      }

      this.addElementGuard(element.id, {
        requireEmailVerification: true,
        blockMessage: element.dataset.blockMessage || 'Email verification required',
        fallbackContent: element.dataset.fallbackContent
      });
    });

    // Find billing-related elements
    const billingElements = document.querySelectorAll('[data-billing-feature]');
    
    billingElements.forEach((element) => {
      if (!element.id) {
        element.id = 'billing-guard-' + Math.random().toString(36).substr(2, 9);
      }

      this.addElementGuard(element.id, {
        requireEmailVerification: true,
        blockMessage: 'Email verification required for billing features',
        showVerificationPrompt: true
      });
    });
  }

  /**
   * Add feature guard
   */
  addFeatureGuard(featureName, options = {}) {
    const guard = {
      featureName,
      options: {
        requireEmailVerification: options.requireEmailVerification === true,
        blockMessage: options.blockMessage || 'Email verification required',
        redirectToVerification: options.redirectToVerification === true,
        showUpgradeOption: options.showUpgradeOption === true,
        customHandler: options.customHandler,
        ...options
      }
    };

    this.guardedFeatures.add(featureName);
    console.log(`VerificationGuards: Added feature guard for ${featureName}`);
    
    return guard;
  }

  /**
   * Add element guard
   */
  addElementGuard(elementId, options = {}) {
    const element = document.getElementById(elementId);
    if (!element) {
      console.error(`VerificationGuards: Element not found: ${elementId}`);
      return null;
    }

    const guard = {
      element,
      options: {
        requireEmailVerification: options.requireEmailVerification === true,
        blockMessage: options.blockMessage || 'Email verification required',
        fallbackContent: options.fallbackContent,
        showVerificationPrompt: options.showVerificationPrompt === true,
        customHandler: options.customHandler,
        ...options
      },
      originalContent: element.innerHTML,
      originalClickHandler: element.onclick
    };

    this.guardedElements.set(elementId, guard);
    this.updateElementGuard(guard);
    
    return guard;
  }

  /**
   * Update element guard based on verification status
   */
  updateElementGuard(guard) {
    const state = this.useAuth.getState();
    const { element, options, originalContent, originalClickHandler } = guard;

    // Check if guard should be active
    const shouldBlock = this.shouldBlockAccess(options, state);

    if (shouldBlock) {
      // Block access - show fallback content or verification prompt
      this.blockElementAccess(element, options);
    } else {
      // Allow access - restore original content
      this.allowElementAccess(element, originalContent, originalClickHandler);
    }
  }

  /**
   * Block element access
   */
  blockElementAccess(element, options) {
    // Remove original click handler
    element.onclick = null;

    // Show fallback content or verification prompt
    if (options.fallbackContent) {
      element.innerHTML = options.fallbackContent;
    } else if (options.showVerificationPrompt) {
      element.innerHTML = this.createVerificationPrompt(options.blockMessage);
    } else {
      element.innerHTML = this.createBlockedMessage(options.blockMessage);
    }

    // Add blocked styling
    element.classList.add('verification-blocked');
  }

  /**
   * Allow element access
   */
  allowElementAccess(element, originalContent, originalClickHandler) {
    // Restore original content and handler
    element.innerHTML = originalContent;
    element.onclick = originalClickHandler;
    
    // Remove blocked styling
    element.classList.remove('verification-blocked');
  }

  /**
   * Create verification prompt HTML
   */
  createVerificationPrompt(message) {
    return `
      <div class="verification-prompt">
        <div class="prompt-icon">⚠️</div>
        <div class="prompt-message">
          <p>${message}</p>
          <button onclick="verificationGuards.showVerificationModal()" class="btn btn-primary btn-sm">
            Verify Email
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Create blocked message HTML
   */
  createBlockedMessage(message) {
    return `
      <div class="verification-blocked-message">
        <div class="blocked-icon">🔒</div>
        <p>${message}</p>
      </div>
    `;
  }

  /**
   * Update all guarded elements
   */
  updateGuardedElements(state) {
    this.guardedElements.forEach((guard) => {
      this.updateElementGuard(guard);
    });
  }

  /**
   * Check if access should be blocked
   */
  shouldBlockAccess(options, state) {
    // Not authenticated - always block
    if (!state.isAuthenticated) {
      return true;
    }

    // Email verification required but not verified
    if (options.requireEmailVerification && !state.isEmailVerified) {
      return true;
    }

    // Custom handler check
    if (options.customHandler) {
      try {
        return !options.customHandler(state);
      } catch (error) {
        console.error('Error in custom verification handler:', error);
        return true; // Block on error for security
      }
    }

    return false;
  }

  /**
   * Check feature access
   */
  checkFeatureAccess(featureName, showMessage = true) {
    const state = this.useAuth.getState();

    // Check if feature is guarded
    if (!this.guardedFeatures.has(featureName)) {
      return true; // Not guarded, allow access
    }

    // Check authentication
    if (!state.isAuthenticated) {
      if (showMessage) {
        this.showMessage('Please sign in to access this feature', 'warning');
      }
      return false;
    }

    // Check email verification for billing features
    const billingFeatures = ['stripe-checkout', 'customer-portal', 'plan-upgrade', 'subscription-management'];
    if (billingFeatures.includes(featureName) && !state.isEmailVerified) {
      if (showMessage) {
        this.showEmailVerificationRequired(featureName);
      }
      return false;
    }

    return true;
  }

  /**
   * Show email verification required message
   */
  showEmailVerificationRequired(featureName) {
    const messages = {
      'stripe-checkout': 'Please verify your email address before making a purchase',
      'customer-portal': 'Email verification is required to access billing management',
      'plan-upgrade': 'Please verify your email before upgrading your plan',
      'subscription-management': 'Email verification is required for subscription changes',
      'premium-conversions': 'Email verification is required for premium features'
    };

    const message = messages[featureName] || 'Email verification is required for this feature';
    
    this.showMessage(message, 'warning');
    
    // Show verification modal after a short delay
    setTimeout(() => {
      this.showVerificationModal();
    }, 1000);
  }

  /**
   * Show verification modal
   */
  showVerificationModal() {
    // Try to use existing email verification modal
    if (this.emailVerification.showModal) {
      this.emailVerification.showModal('verification-modal');
    } else {
      // Fallback: create a simple modal
      this.createSimpleVerificationModal();
    }
  }

  /**
   * Create simple verification modal
   */
  createSimpleVerificationModal() {
    const user = this.useAuth.getUser();
    if (!user) return;

    const modal = document.createElement('div');
    modal.className = 'verification-modal-overlay';
    modal.innerHTML = `
      <div class="verification-modal">
        <div class="modal-header">
          <h3>Email Verification Required</h3>
          <button onclick="this.closest('.verification-modal-overlay').remove()" class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <p>Please verify your email address to access billing features.</p>
          <p><strong>Email:</strong> ${user.email}</p>
          <p>Check your inbox for a verification email.</p>
        </div>
        <div class="modal-footer">
          <button onclick="verificationGuards.resendVerification()" class="btn btn-primary">
            Resend Verification Email
          </button>
          <button onclick="this.closest('.verification-modal-overlay').remove()" class="btn btn-outline">
            Close
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Auto-remove after 30 seconds
    setTimeout(() => {
      if (modal.parentNode) {
        modal.remove();
      }
    }, 30000);
  }

  /**
   * Resend verification email
   */
  async resendVerification() {
    try {
      await this.emailVerification.resendVerification();
    } catch (error) {
      console.error('Error resending verification:', error);
      this.showMessage('Failed to send verification email', 'error');
    }
  }

  /**
   * Guard Stripe Checkout access
   */
  guardStripeCheckout(checkoutFunction, ...args) {
    if (!this.checkFeatureAccess('stripe-checkout')) {
      return Promise.reject(new Error('Email verification required for checkout'));
    }

    return checkoutFunction(...args);
  }

  /**
   * Guard Customer Portal access
   */
  guardCustomerPortal(portalFunction, ...args) {
    if (!this.checkFeatureAccess('customer-portal')) {
      return Promise.reject(new Error('Email verification required for billing management'));
    }

    return portalFunction(...args);
  }

  /**
   * Guard plan upgrade
   */
  guardPlanUpgrade(upgradeFunction, ...args) {
    if (!this.checkFeatureAccess('plan-upgrade')) {
      return Promise.reject(new Error('Email verification required for plan upgrades'));
    }

    return upgradeFunction(...args);
  }

  /**
   * Create verification guard wrapper for functions
   */
  createGuardWrapper(featureName, originalFunction) {
    return (...args) => {
      if (!this.checkFeatureAccess(featureName)) {
        return Promise.reject(new Error(`Email verification required for ${featureName}`));
      }

      return originalFunction(...args);
    };
  }

  /**
   * Show message to user
   */
  showMessage(message, type = 'info') {
    if (window.showToast) {
      window.showToast(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Remove element guard
   */
  removeElementGuard(elementId) {
    const guard = this.guardedElements.get(elementId);
    if (guard) {
      // Restore original content
      this.allowElementAccess(guard.element, guard.originalContent, guard.originalClickHandler);
      this.guardedElements.delete(elementId);
    }
  }

  /**
   * Remove feature guard
   */
  removeFeatureGuard(featureName) {
    this.guardedFeatures.delete(featureName);
  }

  /**
   * Get verification status
   */
  getVerificationStatus() {
    const state = this.useAuth.getState();
    
    return {
      isAuthenticated: state.isAuthenticated,
      isEmailVerified: state.isEmailVerified,
      guardedElements: this.guardedElements.size,
      guardedFeatures: Array.from(this.guardedFeatures),
      canAccessBilling: state.isAuthenticated && state.isEmailVerified,
      blockedFeatures: Array.from(this.guardedFeatures).filter(feature => 
        !this.checkFeatureAccess(feature, false)
      )
    };
  }

  /**
   * Test all guards
   */
  testGuards() {
    const status = this.getVerificationStatus();
    
    console.log('VerificationGuards Test Results:', {
      authenticated: status.isAuthenticated,
      emailVerified: status.isEmailVerified,
      canAccessBilling: status.canAccessBilling,
      blockedFeatures: status.blockedFeatures,
      guardedElements: status.guardedElements
    });

    return status;
  }
}

// Create global instance
let verificationGuards = null;

export const getVerificationGuards = () => {
  if (!verificationGuards) {
    verificationGuards = new VerificationGuards();
  }
  return verificationGuards;
};

// Initialize on load and expose globally
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    const guards = getVerificationGuards();
    window.verificationGuards = guards;
  });
}

export default VerificationGuards;