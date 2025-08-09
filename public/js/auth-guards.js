/**
 * Authentication Guards - Protect routes and features that require authentication
 * Provides utilities for checking authentication state and protecting content
 */

class AuthGuards {
  constructor(authManager) {
    this.authManager = authManager || window.authManager;
    this.protectedRoutes = [
      'dashboard.html',
      'profile.html',
      'settings.html',
      'subscription.html'
    ];
    
    this.init();
  }

  init() {
    // Set up route protection
    this.setupRouteProtection();
    
    // Set up element protection
    this.setupElementProtection();
    
    // Listen for auth state changes
    if (this.authManager) {
      this.authManager.addAuthStateListener((event, session) => {
        this.handleAuthStateChange(event, session);
      });
    }
  }

  /**
   * Set up automatic route protection
   */
  setupRouteProtection() {
    // Check current route on page load
    document.addEventListener('DOMContentLoaded', () => {
      this.checkCurrentRoute();
    });

    // Intercept navigation (for SPA-style navigation)
    window.addEventListener('popstate', () => {
      this.checkCurrentRoute();
    });
  }

  /**
   * Set up element-level protection
   */
  setupElementProtection() {
    // Protect elements with data-auth-required attribute
    document.addEventListener('click', (e) => {
      const element = e.target.closest('[data-auth-required]');
      if (element && !this.isAuthenticated()) {
        e.preventDefault();
        e.stopPropagation();
        
        this.showAuthRequired({
          title: element.dataset.authTitle || 'Sign In Required',
          message: element.dataset.authMessage || 'Please sign in to access this feature.',
          feature: element.dataset.authFeature || 'feature'
        });
      }
    });

    // Protect form submissions
    document.addEventListener('submit', (e) => {
      const form = e.target;
      if (form.hasAttribute('data-auth-required') && !this.isAuthenticated()) {
        e.preventDefault();
        
        this.showAuthRequired({
          title: 'Sign In Required',
          message: 'Please sign in to submit this form.',
          feature: 'form submission'
        });
      }
    });
  }

  /**
   * Check if current route requires authentication
   */
  checkCurrentRoute() {
    const currentPath = window.location.pathname;
    const requiresAuth = this.protectedRoutes.some(route => 
      currentPath.includes(route.replace('.html', ''))
    );

    if (requiresAuth && !this.isAuthenticated()) {
      this.redirectToAuth();
    }
  }

  /**
   * Handle authentication state changes
   */
  handleAuthStateChange(event, session) {
    switch (event) {
      case 'SIGNED_IN':
        this.handleSignIn(session);
        break;
      case 'SIGNED_OUT':
        this.handleSignOut();
        break;
      case 'TOKEN_REFRESHED':
        // Token refreshed, user is still authenticated
        break;
    }
  }

  /**
   * Handle successful sign in
   */
  handleSignIn(session) {
    // Update protected elements
    this.updateProtectedElements(true);
    
    // Handle redirect if there was a stored destination
    const redirectUrl = sessionStorage.getItem('auth_redirect');
    if (redirectUrl && redirectUrl !== window.location.href) {
      sessionStorage.removeItem('auth_redirect');
      window.location.href = redirectUrl;
    }
  }

  /**
   * Handle sign out
   */
  handleSignOut() {
    // Update protected elements
    this.updateProtectedElements(false);
    
    // Redirect if on protected page
    if (this.isProtectedRoute()) {
      window.location.href = '/';
    }
  }

  /**
   * Update visibility of protected elements
   */
  updateProtectedElements(isAuthenticated) {
    // Elements that require authentication
    const authRequiredElements = document.querySelectorAll('[data-auth-required]');
    authRequiredElements.forEach(element => {
      if (isAuthenticated) {
        element.style.display = element.dataset.authDisplay || '';
        element.classList.remove('auth-hidden');
        element.removeAttribute('disabled');
      } else {
        element.style.display = 'none';
        element.classList.add('auth-hidden');
        if (element.tagName === 'BUTTON' || element.tagName === 'INPUT') {
          element.setAttribute('disabled', 'true');
        }
      }
    });

    // Elements that should only show for guests
    const guestOnlyElements = document.querySelectorAll('[data-guest-only]');
    guestOnlyElements.forEach(element => {
      if (isAuthenticated) {
        element.style.display = 'none';
        element.classList.add('auth-hidden');
      } else {
        element.style.display = element.dataset.guestDisplay || '';
        element.classList.remove('auth-hidden');
      }
    });

    // Update user info elements
    if (isAuthenticated) {
      this.updateUserInfoElements();
    }
  }

  /**
   * Update elements that display user information
   */
  updateUserInfoElements() {
    const user = this.authManager?.getCurrentUser();
    if (!user) return;

    const userInfoElements = document.querySelectorAll('[data-user-info]');
    userInfoElements.forEach(element => {
      const infoType = element.dataset.userInfo;
      
      switch (infoType) {
        case 'email':
          element.textContent = user.email;
          break;
        case 'name':
          element.textContent = user.user_metadata?.full_name || 
                               user.email.split('@')[0];
          break;
        case 'avatar':
          if (element.tagName === 'IMG') {
            element.src = user.user_metadata?.avatar_url || 
                         this.generateAvatarUrl(user.email);
          }
          break;
        case 'initials':
          const name = user.user_metadata?.full_name || user.email;
          element.textContent = this.getInitials(name);
          break;
      }
    });
  }

  /**
   * Generate avatar URL for user
   */
  generateAvatarUrl(email) {
    const name = encodeURIComponent(email);
    return `https://ui-avatars.com/api/?name=${name}&background=3b82f6&color=fff&size=40`;
  }

  /**
   * Get initials from name or email
   */
  getInitials(nameOrEmail) {
    if (nameOrEmail.includes('@')) {
      // It's an email, use first letter
      return nameOrEmail.charAt(0).toUpperCase();
    }
    
    // It's a name, get first letter of each word
    return nameOrEmail
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return this.authManager?.isAuthenticated() || false;
  }

  /**
   * Check if current route is protected
   */
  isProtectedRoute() {
    const currentPath = window.location.pathname;
    return this.protectedRoutes.some(route => 
      currentPath.includes(route.replace('.html', ''))
    );
  }

  /**
   * Require authentication for a specific action
   */
  requireAuth(options = {}) {
    if (this.isAuthenticated()) {
      return true;
    }

    this.showAuthRequired(options);
    return false;
  }

  /**
   * Show authentication required modal or redirect
   */
  showAuthRequired(options = {}) {
    // Try to use auth modal if available
    if (window.AuthModal) {
      window.AuthModal.show({
        title: options.title || 'Sign In Required',
        message: options.message || 'Please sign in to access this feature.',
        onSuccess: options.onSuccess,
        onCancel: options.onCancel
      });
      return;
    }

    // Fallback to redirect
    this.redirectToAuth();
  }

  /**
   * Redirect to authentication page
   */
  redirectToAuth() {
    // Store current page for redirect after auth
    sessionStorage.setItem('auth_redirect', window.location.href);
    
    // Determine correct path to auth.html
    const pathDepth = window.location.pathname.split('/').length - 2;
    const basePath = '../'.repeat(Math.max(0, pathDepth - 1));
    
    // Redirect to auth page
    window.location.href = `${basePath}auth.html`;
  }

  /**
   * Protect a function call with authentication
   */
  withAuth(fn, options = {}) {
    return (...args) => {
      if (this.requireAuth(options)) {
        return fn.apply(this, args);
      }
    };
  }

  /**
   * Create an authentication-protected event handler
   */
  protectedHandler(handler, options = {}) {
    return (event) => {
      if (this.requireAuth(options)) {
        return handler(event);
      } else {
        event.preventDefault();
        event.stopPropagation();
      }
    };
  }

  /**
   * Add authentication requirement to an element
   */
  protectElement(element, options = {}) {
    element.setAttribute('data-auth-required', 'true');
    
    if (options.title) {
      element.setAttribute('data-auth-title', options.title);
    }
    
    if (options.message) {
      element.setAttribute('data-auth-message', options.message);
    }
    
    if (options.feature) {
      element.setAttribute('data-auth-feature', options.feature);
    }

    // Update element state based on current auth status
    this.updateProtectedElements(this.isAuthenticated());
  }

  /**
   * Remove authentication requirement from an element
   */
  unprotectElement(element) {
    element.removeAttribute('data-auth-required');
    element.removeAttribute('data-auth-title');
    element.removeAttribute('data-auth-message');
    element.removeAttribute('data-auth-feature');
    element.classList.remove('auth-hidden');
    element.style.display = '';
    element.removeAttribute('disabled');
  }

  /**
   * Get user role/permissions (for future use)
   */
  getUserRole() {
    const user = this.authManager?.getCurrentUser();
    return user?.user_metadata?.role || 'user';
  }

  /**
   * Check if user has specific permission
   */
  hasPermission(permission) {
    const role = this.getUserRole();
    
    // Define role permissions
    const permissions = {
      admin: ['*'],
      user: ['read', 'write', 'upload', 'convert']
    };

    const userPermissions = permissions[role] || [];
    return userPermissions.includes('*') || userPermissions.includes(permission);
  }

  /**
   * Protect element based on permissions
   */
  requirePermission(permission, options = {}) {
    if (!this.isAuthenticated()) {
      return this.requireAuth(options);
    }

    if (!this.hasPermission(permission)) {
      if (options.onInsufficientPermissions) {
        options.onInsufficientPermissions();
      } else {
        console.warn(`Insufficient permissions: ${permission} required`);
      }
      return false;
    }

    return true;
  }
}

// Utility functions for easy access
window.requireAuth = function(options = {}) {
  if (!window.authGuards) {
    window.authGuards = new AuthGuards();
  }
  return window.authGuards.requireAuth(options);
};

window.withAuth = function(fn, options = {}) {
  if (!window.authGuards) {
    window.authGuards = new AuthGuards();
  }
  return window.authGuards.withAuth(fn, options);
};

window.protectedHandler = function(handler, options = {}) {
  if (!window.authGuards) {
    window.authGuards = new AuthGuards();
  }
  return window.authGuards.protectedHandler(handler, options);
};

// Create global instance when auth manager is available
if (typeof window !== 'undefined') {
  window.addEventListener('supabase-auth-change', () => {
    if (window.authManager && !window.authGuards) {
      window.authGuards = new AuthGuards(window.authManager);
    }
  });

  // Initialize immediately if auth manager is already available
  if (window.authManager) {
    window.authGuards = new AuthGuards(window.authManager);
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthGuards;
}