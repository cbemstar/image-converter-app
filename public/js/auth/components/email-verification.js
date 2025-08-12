/**
 * Email Verification Components
 * Handles email verification flow and components
 */

import { useAuth } from '../hooks/useAuth.js';
import { getAuthProviders } from '../auth-providers.js';

class EmailVerification {
  constructor() {
    this.useAuth = useAuth();
    this.authProviders = getAuthProviders();
    this.verificationComponents = new Map();
    
    this.initialize();
  }

  /**
   * Initialize email verification system
   */
  initialize() {
    // Subscribe to auth state changes
    this.useAuth.subscribe((state) => {
      this.handleAuthStateChange(state);
    });

    // Check for email confirmation in URL
    this.checkEmailConfirmationInUrl();
  }

  /**
   * Handle authentication state changes
   */
  handleAuthStateChange(state) {
    console.log('EmailVerification: Auth state changed', state);
    
    // Update all verification components
    this.updateAllComponents(state);
  }

  /**
   * Check for email confirmation parameters in URL
   */
  checkEmailConfirmationInUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('type');
    const token = urlParams.get('token');
    
    if (type === 'email_confirmation' || token) {
      console.log('Email confirmation detected in URL');
      this.handleEmailConfirmationCallback();
    }
  }

  /**
   * Handle email confirmation callback
   */
  async handleEmailConfirmationCallback() {
    try {
      // The Supabase client should automatically handle the confirmation
      // We just need to wait for the auth state to update
      this.showMessage('Verifying your email...', 'info');
      
      // Wait a moment for the auth state to update
      setTimeout(() => {
        const state = this.useAuth.getState();
        if (state.isEmailVerified) {
          this.showMessage('Email verified successfully!', 'success');
          this.handlePostVerificationRedirect();
        } else if (!state.loading) {
          this.showMessage('Email verification failed. Please try again.', 'error');
        }
      }, 2000);
      
    } catch (error) {
      console.error('Email confirmation error:', error);
      this.showMessage('Email verification failed. Please try again.', 'error');
    }
  }

  /**
   * Handle redirect after successful verification
   */
  handlePostVerificationRedirect() {
    // Check for stored callback URL
    const callbackUrl = sessionStorage.getItem('auth_redirect');
    
    if (callbackUrl && callbackUrl !== window.location.href) {
      sessionStorage.removeItem('auth_redirect');
      setTimeout(() => {
        window.location.href = callbackUrl;
      }, 1500); // Give user time to see success message
    } else {
      // Default redirect to dashboard or home
      setTimeout(() => {
        window.location.href = '/dashboard.html';
      }, 1500);
    }
  }

  /**
   * Create email verification banner component
   */
  createVerificationBanner(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Verification banner container not found: ${containerId}`);
      return null;
    }

    const component = {
      type: 'banner',
      container,
      options: {
        dismissible: options.dismissible !== false,
        showResendButton: options.showResendButton !== false,
        autoHide: options.autoHide === true,
        ...options
      }
    };

    this.verificationComponents.set(containerId, component);
    this.renderVerificationBanner(component);
    
    return component;
  }

  /**
   * Render email verification banner
   */
  renderVerificationBanner(component) {
    const { container, options } = component;
    const state = this.useAuth.getState();

    // Hide banner if user is not authenticated or email is verified
    if (!state.isAuthenticated || state.isEmailVerified) {
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    
    let html = `
      <div class="email-verification-banner">
        <div class="banner-content">
          <div class="banner-icon">⚠️</div>
          <div class="banner-message">
            <strong>Email verification required</strong>
            <p>Please check your email and click the verification link to access all features.</p>
          </div>
          <div class="banner-actions">
    `;

    if (options.showResendButton) {
      html += `
        <button onclick="emailVerification.resendVerification('${container.id}')" 
                class="btn btn-sm btn-primary">
          Resend Email
        </button>
      `;
    }

    if (options.dismissible) {
      html += `
        <button onclick="emailVerification.dismissBanner('${container.id}')" 
                class="btn btn-sm btn-outline">
          Dismiss
        </button>
      `;
    }

    html += `
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Auto-hide after specified time
    if (options.autoHide && options.autoHideDelay) {
      setTimeout(() => {
        this.dismissBanner(container.id);
      }, options.autoHideDelay);
    }
  }

  /**
   * Create email verification modal component
   */
  createVerificationModal(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Verification modal container not found: ${containerId}`);
      return null;
    }

    const component = {
      type: 'modal',
      container,
      options: {
        closeable: options.closeable !== false,
        showResendButton: options.showResendButton !== false,
        ...options
      }
    };

    this.verificationComponents.set(containerId, component);
    this.renderVerificationModal(component);
    
    return component;
  }

  /**
   * Render email verification modal
   */
  renderVerificationModal(component) {
    const { container, options } = component;
    const state = this.useAuth.getState();

    // Hide modal if user is not authenticated or email is verified
    if (!state.isAuthenticated || state.isEmailVerified) {
      container.innerHTML = '';
      return;
    }

    let html = `
      <div class="email-verification-modal">
        <div class="modal-backdrop" onclick="emailVerification.closeModal('${container.id}')"></div>
        <div class="modal-content">
          <div class="modal-header">
            <h3>Verify Your Email</h3>
    `;

    if (options.closeable) {
      html += `
        <button onclick="emailVerification.closeModal('${container.id}')" 
                class="modal-close">×</button>
      `;
    }

    html += `
          </div>
          <div class="modal-body">
            <div class="verification-icon">📧</div>
            <p>We've sent a verification email to:</p>
            <strong>${state.user?.email}</strong>
            <p>Please check your inbox and click the verification link to continue.</p>
            
            <div class="verification-tips">
              <h4>Didn't receive the email?</h4>
              <ul>
                <li>Check your spam/junk folder</li>
                <li>Make sure ${state.user?.email} is correct</li>
                <li>Wait a few minutes and check again</li>
              </ul>
            </div>
          </div>
          <div class="modal-footer">
    `;

    if (options.showResendButton) {
      html += `
        <button onclick="emailVerification.resendVerification('${container.id}')" 
                class="btn btn-primary">
          Resend Verification Email
        </button>
      `;
    }

    html += `
            <button onclick="emailVerification.closeModal('${container.id}')" 
                    class="btn btn-outline">
              I'll verify later
            </button>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  /**
   * Create inline verification prompt component
   */
  createInlinePrompt(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Inline prompt container not found: ${containerId}`);
      return null;
    }

    const component = {
      type: 'inline',
      container,
      options: {
        compact: options.compact === true,
        showResendButton: options.showResendButton !== false,
        ...options
      }
    };

    this.verificationComponents.set(containerId, component);
    this.renderInlinePrompt(component);
    
    return component;
  }

  /**
   * Render inline verification prompt
   */
  renderInlinePrompt(component) {
    const { container, options } = component;
    const state = this.useAuth.getState();

    // Hide prompt if user is not authenticated or email is verified
    if (!state.isAuthenticated || state.isEmailVerified) {
      container.innerHTML = '';
      return;
    }

    const compactClass = options.compact ? 'compact' : '';
    
    let html = `
      <div class="email-verification-prompt ${compactClass}">
        <div class="prompt-icon">⚠️</div>
        <div class="prompt-content">
    `;

    if (options.compact) {
      html += `
        <span>Email verification required</span>
      `;
    } else {
      html += `
        <h4>Email Verification Required</h4>
        <p>Please verify your email address to access all features.</p>
      `;
    }

    html += `
        </div>
        <div class="prompt-actions">
    `;

    if (options.showResendButton) {
      html += `
        <button onclick="emailVerification.resendVerification('${container.id}')" 
                class="btn btn-sm btn-primary">
          ${options.compact ? 'Resend' : 'Resend Email'}
        </button>
      `;
    }

    html += `
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  /**
   * Update all verification components
   */
  updateAllComponents(state) {
    this.verificationComponents.forEach((component) => {
      switch (component.type) {
        case 'banner':
          this.renderVerificationBanner(component);
          break;
        case 'modal':
          this.renderVerificationModal(component);
          break;
        case 'inline':
          this.renderInlinePrompt(component);
          break;
      }
    });
  }

  /**
   * Resend verification email
   */
  async resendVerification(containerId) {
    const user = this.useAuth.getUser();
    if (!user?.email) {
      this.showMessage('No email address found.', 'error');
      return;
    }

    try {
      this.showMessage('Sending verification email...', 'info');
      
      await this.authProviders.resendConfirmation(user.email);
      
      this.showMessage('Verification email sent! Please check your inbox.', 'success');
      
      // Update button state temporarily
      const component = this.verificationComponents.get(containerId);
      if (component) {
        const button = component.container.querySelector('button[onclick*="resendVerification"]');
        if (button) {
          const originalText = button.textContent;
          button.textContent = 'Email Sent!';
          button.disabled = true;
          
          setTimeout(() => {
            button.textContent = originalText;
            button.disabled = false;
          }, 5000);
        }
      }
      
    } catch (error) {
      console.error('Resend verification error:', error);
      this.showMessage('Failed to send verification email. Please try again.', 'error');
    }
  }

  /**
   * Dismiss verification banner
   */
  dismissBanner(containerId) {
    const component = this.verificationComponents.get(containerId);
    if (component && component.type === 'banner') {
      component.container.style.display = 'none';
      
      // Store dismissal in session storage
      sessionStorage.setItem('email-verification-banner-dismissed', 'true');
    }
  }

  /**
   * Close verification modal
   */
  closeModal(containerId) {
    const component = this.verificationComponents.get(containerId);
    if (component && component.type === 'modal') {
      component.container.innerHTML = '';
    }
  }

  /**
   * Show verification modal
   */
  showModal(containerId) {
    const component = this.verificationComponents.get(containerId);
    if (component && component.type === 'modal') {
      this.renderVerificationModal(component);
    }
  }

  /**
   * Check if verification banner was dismissed
   */
  isBannerDismissed() {
    return sessionStorage.getItem('email-verification-banner-dismissed') === 'true';
  }

  /**
   * Reset banner dismissal
   */
  resetBannerDismissal() {
    sessionStorage.removeItem('email-verification-banner-dismissed');
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
   * Get verification component
   */
  getComponent(containerId) {
    return this.verificationComponents.get(containerId);
  }

  /**
   * Remove verification component
   */
  removeComponent(containerId) {
    const component = this.verificationComponents.get(containerId);
    if (component) {
      component.container.innerHTML = '';
      this.verificationComponents.delete(containerId);
    }
  }

  /**
   * Check if user needs email verification
   */
  needsVerification() {
    const state = this.useAuth.getState();
    return state.isAuthenticated && !state.isEmailVerified;
  }

  /**
   * Get verification status
   */
  getVerificationStatus() {
    const state = this.useAuth.getState();
    
    return {
      isAuthenticated: state.isAuthenticated,
      isEmailVerified: state.isEmailVerified,
      needsVerification: this.needsVerification(),
      userEmail: state.user?.email,
      bannerDismissed: this.isBannerDismissed()
    };
  }
}

// Create global instance
let emailVerification = null;

export const getEmailVerification = () => {
  if (!emailVerification) {
    emailVerification = new EmailVerification();
  }
  return emailVerification;
};

// Initialize on load and expose globally
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    const verification = getEmailVerification();
    window.emailVerification = verification;
  });
}

export default EmailVerification;