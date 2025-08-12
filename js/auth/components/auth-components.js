/**
 * Authentication Components
 * Provides sign-in/sign-out components with provider options and header state management
 */

import { useAuth } from '../hooks/useAuth.js';
import { getAuthProviders } from '../auth-providers.js';

class AuthComponents {
  constructor() {
    this.useAuth = useAuth();
    this.authProviders = getAuthProviders();
    this.components = new Map();
    
    // Ensure only one navigation state is rendered at a time
    this.navigationState = 'loading'; // 'loading', 'guest', 'authenticated'
    this.headerElements = {
      signInButton: null,
      userMenu: null,
      loadingIndicator: null
    };
    
    this.initialize();
  }

  /**
   * Initialize auth components
   */
  initialize() {
    // Subscribe to auth state changes
    this.useAuth.subscribe((state) => {
      this.handleAuthStateChange(state);
    });

    // Set up DOM mutation observer to handle dynamic content
    this.setupMutationObserver();
  }

  /**
   * Handle authentication state changes with header state management
   */
  handleAuthStateChange(state) {
    console.log('AuthComponents: Auth state changed', state);
    
    // Update navigation state
    if (state.loading) {
      this.navigationState = 'loading';
    } else if (state.isAuthenticated) {
      this.navigationState = 'authenticated';
    } else {
      this.navigationState = 'guest';
    }

    // Update all auth components
    this.updateAllComponents();
    
    // Ensure header state consistency
    this.ensureHeaderStateConsistency();
  }

  /**
   * Ensure header never renders both Sign-In and User menu simultaneously
   */
  ensureHeaderStateConsistency() {
    const signInElements = document.querySelectorAll('[data-auth-component="sign-in"], [data-guest-only]');
    const userMenuElements = document.querySelectorAll('[data-auth-component="user-menu"], [data-auth-required]');
    const loadingElements = document.querySelectorAll('[data-auth-component="loading"]');

    // Hide all elements first
    [...signInElements, ...userMenuElements, ...loadingElements].forEach(el => {
      el.style.display = 'none';
      el.classList.add('hidden');
    });

    // Show appropriate elements based on navigation state
    switch (this.navigationState) {
      case 'loading':
        loadingElements.forEach(el => {
          el.style.display = el.dataset.authDisplay || 'block';
          el.classList.remove('hidden');
        });
        break;
        
      case 'authenticated':
        userMenuElements.forEach(el => {
          el.style.display = el.dataset.authDisplay || 'block';
          el.classList.remove('hidden');
        });
        break;
        
      case 'guest':
        signInElements.forEach(el => {
          el.style.display = el.dataset.guestDisplay || 'block';
          el.classList.remove('hidden');
        });
        break;
    }

    console.log(`AuthComponents: Header state set to ${this.navigationState}`);
  }

  /**
   * Create sign-in component
   */
  createSignInComponent(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Sign-in container not found: ${containerId}`);
      return null;
    }

    const component = {
      type: 'sign-in',
      container,
      options: {
        showProviders: options.showProviders !== false,
        showEmailForm: options.showEmailForm !== false,
        showSignUpLink: options.showSignUpLink !== false,
        callbackUrl: options.callbackUrl,
        ...options
      }
    };

    this.components.set(containerId, component);
    this.renderSignInComponent(component);
    
    return component;
  }

  /**
   * Render sign-in component
   */
  renderSignInComponent(component) {
    const { container, options } = component;
    const state = this.useAuth.getState();

    let html = `
      <div class="auth-component sign-in-component" data-auth-component="sign-in">
        <div class="auth-header">
          <h3>Sign In</h3>
        </div>
    `;

    // Show loading state
    if (state.loading) {
      html += `
        <div class="auth-loading">
          <div class="spinner"></div>
          <p>Loading...</p>
        </div>
      `;
    } else {
      // OAuth providers
      if (options.showProviders) {
        const providers = this.authProviders.getAvailableProviders()
          .filter(p => p.id !== 'email');

        if (providers.length > 0) {
          html += '<div class="oauth-providers">';
          providers.forEach(provider => {
            html += `
              <button class="btn btn-oauth btn-${provider.id}" 
                      onclick="authComponents.signInWithProvider('${provider.id}', '${options.callbackUrl || ''}')">
                <span class="provider-icon">${provider.icon}</span>
                Continue with ${provider.name}
              </button>
            `;
          });
          html += '</div>';

          if (options.showEmailForm) {
            html += '<div class="auth-divider"><span>or</span></div>';
          }
        }
      }

      // Email form
      if (options.showEmailForm) {
        html += `
          <form class="email-auth-form" onsubmit="authComponents.handleEmailSignIn(event, '${container.id}')">
            <div class="form-group">
              <input type="email" id="${container.id}-email" placeholder="Email address" required>
            </div>
            <div class="form-group">
              <input type="password" id="${container.id}-password" placeholder="Password" required>
            </div>
            <button type="submit" class="btn btn-primary">Sign In</button>
          </form>
        `;

        // Forgot password link
        html += `
          <div class="auth-links">
            <a href="#" onclick="authComponents.showForgotPassword('${container.id}')">Forgot password?</a>
          </div>
        `;
      }

      // Sign up link
      if (options.showSignUpLink) {
        html += `
          <div class="auth-footer">
            <p>Don't have an account? 
              <a href="#" onclick="authComponents.showSignUp('${container.id}')">Sign up</a>
            </p>
          </div>
        `;
      }
    }

    // Error display
    if (state.error) {
      html += `
        <div class="auth-error">
          <p>${state.error.message}</p>
          <button onclick="authComponents.clearError()" class="btn-close">×</button>
        </div>
      `;
    }

    html += '</div>';
    container.innerHTML = html;
  }

  /**
   * Create user menu component
   */
  createUserMenuComponent(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`User menu container not found: ${containerId}`);
      return null;
    }

    const component = {
      type: 'user-menu',
      container,
      options: {
        showAvatar: options.showAvatar !== false,
        showUserInfo: options.showUserInfo !== false,
        showSignOutButton: options.showSignOutButton !== false,
        ...options
      }
    };

    this.components.set(containerId, component);
    this.renderUserMenuComponent(component);
    
    return component;
  }

  /**
   * Render user menu component
   */
  renderUserMenuComponent(component) {
    const { container, options } = component;
    const state = this.useAuth.getState();

    if (!state.isAuthenticated) {
      container.innerHTML = '';
      return;
    }

    const user = state.user;
    let html = `
      <div class="auth-component user-menu-component" data-auth-component="user-menu">
    `;

    // User avatar and info
    if (options.showAvatar || options.showUserInfo) {
      html += '<div class="user-info">';
      
      if (options.showAvatar) {
        const avatarUrl = user.user_metadata?.avatar_url || 
          `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}&background=0066cc&color=fff`;
        html += `<img src="${avatarUrl}" alt="User avatar" class="user-avatar">`;
      }
      
      if (options.showUserInfo) {
        const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
        html += `
          <div class="user-details">
            <div class="user-name">${displayName}</div>
            <div class="user-email">${user.email}</div>
          </div>
        `;
      }
      
      html += '</div>';
    }

    // Email verification status
    if (!state.isEmailVerified) {
      html += `
        <div class="email-verification-notice">
          <p>Please verify your email to access all features</p>
          <button onclick="authComponents.resendVerification()" class="btn btn-sm">Resend</button>
        </div>
      `;
    }

    // Menu items
    html += `
      <div class="user-menu-items">
        <a href="/profile.html" class="menu-item">Profile</a>
        <a href="/dashboard.html" class="menu-item">Dashboard</a>
        <a href="/settings.html" class="menu-item">Settings</a>
      </div>
    `;

    // Sign out button
    if (options.showSignOutButton) {
      html += `
        <div class="user-menu-footer">
          <button onclick="authComponents.signOut()" class="btn btn-outline">Sign Out</button>
        </div>
      `;
    }

    html += '</div>';
    container.innerHTML = html;
  }

  /**
   * Create loading component
   */
  createLoadingComponent(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Loading container not found: ${containerId}`);
      return null;
    }

    const component = {
      type: 'loading',
      container
    };

    this.components.set(containerId, component);
    this.renderLoadingComponent(component);
    
    return component;
  }

  /**
   * Render loading component
   */
  renderLoadingComponent(component) {
    const { container } = component;
    
    container.innerHTML = `
      <div class="auth-component loading-component" data-auth-component="loading">
        <div class="auth-loading">
          <div class="spinner"></div>
          <span>Loading...</span>
        </div>
      </div>
    `;
  }

  /**
   * Update all components
   */
  updateAllComponents() {
    this.components.forEach((component, containerId) => {
      switch (component.type) {
        case 'sign-in':
          this.renderSignInComponent(component);
          break;
        case 'user-menu':
          this.renderUserMenuComponent(component);
          break;
        case 'loading':
          this.renderLoadingComponent(component);
          break;
      }
    });
  }

  /**
   * Handle email sign in form submission
   */
  async handleEmailSignIn(event, containerId) {
    event.preventDefault();
    
    const emailInput = document.getElementById(`${containerId}-email`);
    const passwordInput = document.getElementById(`${containerId}-password`);
    
    if (!emailInput || !passwordInput) return;

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) return;

    try {
      const component = this.components.get(containerId);
      await this.useAuth.signIn(email, password, {
        callbackUrl: component?.options?.callbackUrl
      });
    } catch (error) {
      console.error('Email sign in error:', error);
      // Error will be displayed via state update
    }
  }

  /**
   * Sign in with OAuth provider
   */
  async signInWithProvider(provider, callbackUrl) {
    try {
      await this.useAuth.signInWithProvider(provider, { callbackUrl });
    } catch (error) {
      console.error(`${provider} sign in error:`, error);
    }
  }

  /**
   * Sign out current user
   */
  async signOut() {
    try {
      await this.useAuth.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }

  /**
   * Show forgot password form
   */
  showForgotPassword(containerId) {
    // TODO: Implement forgot password modal/form
    const email = prompt('Enter your email address:');
    if (email) {
      this.useAuth.resetPassword(email);
    }
  }

  /**
   * Show sign up form
   */
  showSignUp(containerId) {
    // TODO: Implement sign up modal/form or redirect
    console.log('Show sign up form');
  }

  /**
   * Resend email verification
   */
  async resendVerification() {
    const user = this.useAuth.getUser();
    if (user?.email) {
      try {
        await this.authProviders.resendConfirmation(user.email);
        alert('Verification email sent! Please check your inbox.');
      } catch (error) {
        console.error('Resend verification error:', error);
        alert('Failed to send verification email. Please try again.');
      }
    }
  }

  /**
   * Clear current error
   */
  clearError() {
    this.useAuth.clearError();
  }

  /**
   * Set up mutation observer to handle dynamic content
   */
  setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // Check if any auth-related elements were added
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.hasAttribute('data-auth-component') || 
                  node.querySelector('[data-auth-component]')) {
                shouldUpdate = true;
              }
            }
          });
        }
      });
      
      if (shouldUpdate) {
        this.ensureHeaderStateConsistency();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Get component by container ID
   */
  getComponent(containerId) {
    return this.components.get(containerId);
  }

  /**
   * Remove component
   */
  removeComponent(containerId) {
    const component = this.components.get(containerId);
    if (component) {
      component.container.innerHTML = '';
      this.components.delete(containerId);
    }
  }

  /**
   * Get current navigation state
   */
  getNavigationState() {
    return this.navigationState;
  }
}

// Create global instance
let authComponents = null;

export const getAuthComponents = () => {
  if (!authComponents) {
    authComponents = new AuthComponents();
  }
  return authComponents;
};

// Initialize on load and expose globally
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    const components = getAuthComponents();
    window.authComponents = components;
  });
}

export default AuthComponents;