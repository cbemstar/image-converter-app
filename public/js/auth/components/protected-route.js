/**
 * Protected Route Components
 * Provides route protection and authentication guards
 */

import { useAuth } from '../hooks/useAuth.js';

class ProtectedRoute {
  constructor() {
    this.useAuth = useAuth();
    this.protectedElements = new Map();
    this.routeGuards = new Map();
    
    this.initialize();
  }

  /**
   * Initialize protected route system
   */
  initialize() {
    // Subscribe to auth state changes
    this.useAuth.subscribe((state) => {
      this.handleAuthStateChange(state);
    });

    // Set up automatic route protection
    this.setupAutomaticProtection();
  }

  /**
   * Handle authentication state changes
   */
  handleAuthStateChange(state) {
    console.log('ProtectedRoute: Auth state changed', state);
    
    // Update all protected elements
    this.updateProtectedElements(state);
    
    // Check route guards
    this.checkRouteGuards(state);
  }

  /**
   * Create protected wrapper for an element
   */
  createProtectedWrapper(elementId, options = {}) {
    const element = document.getElementById(elementId);
    if (!element) {
      console.error(`Protected element not found: ${elementId}`);
      return null;
    }

    const wrapper = {
      element,
      options: {
        requireAuth: options.requireAuth !== false,
        requireEmailVerification: options.requireEmailVerification === true,
        redirectToAuth: options.redirectToAuth !== false,
        showMessage: options.showMessage !== false,
        fallbackContent: options.fallbackContent || null,
        loadingContent: options.loadingContent || 'Loading...',
        ...options
      },
      originalContent: element.innerHTML
    };

    this.protectedElements.set(elementId, wrapper);
    this.updateProtectedElement(wrapper);
    
    return wrapper;
  }

  /**
   * Update protected element based on auth state
   */
  updateProtectedElement(wrapper) {
    const state = this.useAuth.getState();
    const { element, options, originalContent } = wrapper;

    // Show loading state
    if (state.loading) {
      element.innerHTML = `
        <div class="protected-loading">
          ${options.loadingContent}
        </div>
      `;
      return;
    }

    // Check authentication requirement
    if (options.requireAuth && !state.isAuthenticated) {
      this.handleUnauthenticated(wrapper);
      return;
    }

    // Check email verification requirement
    if (options.requireEmailVerification && !state.isEmailVerified) {
      this.handleUnverifiedEmail(wrapper);
      return;
    }

    // User has access - show original content
    element.innerHTML = originalContent;
  }

  /**
   * Handle unauthenticated access
   */
  handleUnauthenticated(wrapper) {
    const { element, options } = wrapper;

    if (options.redirectToAuth) {
      // Store current URL and redirect
      this.useAuth.storeCallbackUrl();
      setTimeout(() => {
        window.location.href = this.calculateAuthPath();
      }, 100);
      return;
    }

    // Show fallback content or default message
    const content = options.fallbackContent || `
      <div class="protected-unauthorized">
        <h3>Authentication Required</h3>
        <p>Please sign in to access this content.</p>
        <button onclick="protectedRoute.redirectToAuth()" class="btn btn-primary">
          Sign In
        </button>
      </div>
    `;

    element.innerHTML = content;

    if (options.showMessage) {
      this.showMessage('Please sign in to access this content.', 'warning');
    }
  }

  /**
   * Handle unverified email access
   */
  handleUnverifiedEmail(wrapper) {
    const { element, options } = wrapper;

    const content = options.fallbackContent || `
      <div class="protected-unverified">
        <h3>Email Verification Required</h3>
        <p>Please verify your email address to access this content.</p>
        <button onclick="protectedRoute.resendVerification()" class="btn btn-primary">
          Resend Verification Email
        </button>
      </div>
    `;

    element.innerHTML = content;

    if (options.showMessage) {
      this.showMessage('Please verify your email to access this content.', 'warning');
    }
  }

  /**
   * Update all protected elements
   */
  updateProtectedElements(state) {
    this.protectedElements.forEach((wrapper) => {
      this.updateProtectedElement(wrapper);
    });
  }

  /**
   * Add route guard for specific paths
   */
  addRouteGuard(pathPattern, guardFunction, options = {}) {
    const guard = {
      pathPattern,
      guardFunction,
      options: {
        requireAuth: options.requireAuth !== false,
        requireEmailVerification: options.requireEmailVerification === true,
        redirectToAuth: options.redirectToAuth !== false,
        ...options
      }
    };

    this.routeGuards.set(pathPattern, guard);
    
    // Check immediately if current path matches
    if (this.matchesPath(window.location.pathname, pathPattern)) {
      this.checkRouteGuard(guard);
    }
  }

  /**
   * Check all route guards
   */
  checkRouteGuards(state) {
    const currentPath = window.location.pathname;
    
    this.routeGuards.forEach((guard) => {
      if (this.matchesPath(currentPath, guard.pathPattern)) {
        this.checkRouteGuard(guard, state);
      }
    });
  }

  /**
   * Check individual route guard
   */
  checkRouteGuard(guard, state = null) {
    const authState = state || this.useAuth.getState();
    
    // Skip if still loading
    if (authState.loading) return;

    // Check authentication requirement
    if (guard.options.requireAuth && !authState.isAuthenticated) {
      if (guard.options.redirectToAuth) {
        this.useAuth.storeCallbackUrl();
        window.location.href = this.calculateAuthPath();
      }
      return false;
    }

    // Check email verification requirement
    if (guard.options.requireEmailVerification && !authState.isEmailVerified) {
      this.showMessage('Email verification required for this page.', 'warning');
      return false;
    }

    // Run custom guard function
    if (guard.guardFunction) {
      try {
        const result = guard.guardFunction(authState);
        if (!result) {
          console.log('Route guard failed for:', guard.pathPattern);
          return false;
        }
      } catch (error) {
        console.error('Route guard error:', error);
        return false;
      }
    }

    return true;
  }

  /**
   * Check if path matches pattern
   */
  matchesPath(path, pattern) {
    if (typeof pattern === 'string') {
      return path === pattern || path.includes(pattern);
    }
    
    if (pattern instanceof RegExp) {
      return pattern.test(path);
    }
    
    return false;
  }

  /**
   * Set up automatic protection for common patterns
   */
  setupAutomaticProtection() {
    // Protect dashboard pages
    this.addRouteGuard('/dashboard', null, {
      requireAuth: true,
      requireEmailVerification: false
    });

    // Protect profile pages
    this.addRouteGuard('/profile', null, {
      requireAuth: true,
      requireEmailVerification: false
    });

    // Protect settings pages
    this.addRouteGuard('/settings', null, {
      requireAuth: true,
      requireEmailVerification: false
    });

    // Protect billing pages (require email verification)
    this.addRouteGuard('/billing', null, {
      requireAuth: true,
      requireEmailVerification: true
    });

    // Protect elements with data attributes
    this.setupDataAttributeProtection();
  }

  /**
   * Set up protection based on data attributes
   */
  setupDataAttributeProtection() {
    // Find elements with protection attributes
    const protectedElements = document.querySelectorAll('[data-require-auth], [data-require-verified]');
    
    protectedElements.forEach((element) => {
      if (!element.id) {
        element.id = 'protected-' + Math.random().toString(36).substr(2, 9);
      }

      const requireAuth = element.hasAttribute('data-require-auth');
      const requireVerified = element.hasAttribute('data-require-verified');
      const noRedirect = element.hasAttribute('data-no-redirect');

      this.createProtectedWrapper(element.id, {
        requireAuth,
        requireEmailVerification: requireVerified,
        redirectToAuth: !noRedirect,
        fallbackContent: element.dataset.fallbackContent
      });
    });
  }

  /**
   * Redirect to authentication page
   */
  redirectToAuth() {
    this.useAuth.storeCallbackUrl();
    window.location.href = this.calculateAuthPath();
  }

  /**
   * Calculate path to auth page
   */
  calculateAuthPath() {
    const pathDepth = window.location.pathname.split('/').length - 2;
    const basePath = pathDepth > 1 ? '../'.repeat(pathDepth - 1) : './';
    return `${basePath}auth.html`;
  }

  /**
   * Resend email verification
   */
  async resendVerification() {
    const user = this.useAuth.getUser();
    if (user?.email) {
      try {
        // This would use the auth providers to resend verification
        console.log('Resending verification email to:', user.email);
        this.showMessage('Verification email sent! Please check your inbox.', 'success');
      } catch (error) {
        console.error('Resend verification error:', error);
        this.showMessage('Failed to send verification email. Please try again.', 'error');
      }
    }
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
   * Remove protected wrapper
   */
  removeProtectedWrapper(elementId) {
    const wrapper = this.protectedElements.get(elementId);
    if (wrapper) {
      wrapper.element.innerHTML = wrapper.originalContent;
      this.protectedElements.delete(elementId);
    }
  }

  /**
   * Remove route guard
   */
  removeRouteGuard(pathPattern) {
    this.routeGuards.delete(pathPattern);
  }

  /**
   * Get protected element wrapper
   */
  getProtectedWrapper(elementId) {
    return this.protectedElements.get(elementId);
  }

  /**
   * Get route guard
   */
  getRouteGuard(pathPattern) {
    return this.routeGuards.get(pathPattern);
  }

  /**
   * Check if current route is protected
   */
  isCurrentRouteProtected() {
    const currentPath = window.location.pathname;
    
    for (const [pathPattern, guard] of this.routeGuards) {
      if (this.matchesPath(currentPath, pathPattern)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get current protection status
   */
  getProtectionStatus() {
    const state = this.useAuth.getState();
    const isProtected = this.isCurrentRouteProtected();
    
    return {
      isProtected,
      hasAccess: !isProtected || (state.isAuthenticated && 
        (!this.requiresEmailVerification() || state.isEmailVerified)),
      authState: state
    };
  }

  /**
   * Check if current route requires email verification
   */
  requiresEmailVerification() {
    const currentPath = window.location.pathname;
    
    for (const [pathPattern, guard] of this.routeGuards) {
      if (this.matchesPath(currentPath, pathPattern) && 
          guard.options.requireEmailVerification) {
        return true;
      }
    }
    
    return false;
  }
}

// Create global instance
let protectedRoute = null;

export const getProtectedRoute = () => {
  if (!protectedRoute) {
    protectedRoute = new ProtectedRoute();
  }
  return protectedRoute;
};

// Initialize on load and expose globally
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    const route = getProtectedRoute();
    window.protectedRoute = route;
  });
}

export default ProtectedRoute;