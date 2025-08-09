/**
 * AuthModal - Reusable authentication modal component
 * Can be used across different pages to prompt for authentication
 */

class AuthModal {
  constructor(authManager) {
    this.authManager = authManager || window.authManager;
    this.modal = null;
    this.isOpen = false;
    this.onSuccess = null;
    this.onCancel = null;
    
    this.createModal();
    this.setupEventListeners();
  }

  createModal() {
    // Create modal HTML
    const modalHTML = `
      <div id="authModal" class="auth-modal-overlay" style="display: none;">
        <div class="auth-modal-container">
          <div class="auth-modal-header">
            <h3>Sign In Required</h3>
            <button class="auth-modal-close" aria-label="Close modal">&times;</button>
          </div>
          
          <div class="auth-modal-content">
            <p>Please sign in to access this feature and save your work.</p>
            
            <div class="auth-modal-buttons">
              <button class="auth-modal-btn auth-modal-btn-primary" id="authModalSignIn">
                Sign In
              </button>
              <button class="auth-modal-btn auth-modal-btn-secondary" id="authModalSignUp">
                Create Account
              </button>
            </div>
            
            <div class="auth-modal-divider">
              <span>or continue with</span>
            </div>
            
            <div class="auth-modal-social">
              <button class="auth-modal-social-btn" id="authModalGoogle">
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </button>
              <button class="auth-modal-social-btn" id="authModalGitHub">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#333">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                GitHub
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modal = document.getElementById('authModal');

    // Add styles
    this.addStyles();
  }

  addStyles() {
    const styles = `
      <style id="authModalStyles">
        .auth-modal-overlay {
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
          padding: 20px;
        }

        .auth-modal-container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
          width: 100%;
          max-width: 400px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .auth-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px 24px 0;
          margin-bottom: 16px;
        }

        .auth-modal-header h3 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: #1f2937;
        }

        .auth-modal-close {
          background: none;
          border: none;
          font-size: 24px;
          color: #6b7280;
          cursor: pointer;
          padding: 4px;
          line-height: 1;
          border-radius: 4px;
          transition: background-color 0.2s;
        }

        .auth-modal-close:hover {
          background: #f3f4f6;
          color: #374151;
        }

        .auth-modal-content {
          padding: 0 24px 24px;
        }

        .auth-modal-content p {
          color: #6b7280;
          margin-bottom: 24px;
          line-height: 1.5;
        }

        .auth-modal-buttons {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
        }

        .auth-modal-btn {
          flex: 1;
          padding: 12px 16px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
        }

        .auth-modal-btn-primary {
          background: #3b82f6;
          color: white;
        }

        .auth-modal-btn-primary:hover {
          background: #2563eb;
        }

        .auth-modal-btn-secondary {
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #d1d5db;
        }

        .auth-modal-btn-secondary:hover {
          background: #e5e7eb;
        }

        .auth-modal-divider {
          text-align: center;
          margin: 20px 0;
          position: relative;
          color: #6b7280;
          font-size: 14px;
        }

        .auth-modal-divider::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 1px;
          background: #e5e7eb;
        }

        .auth-modal-divider span {
          background: white;
          padding: 0 16px;
          position: relative;
        }

        .auth-modal-social {
          display: flex;
          gap: 12px;
        }

        .auth-modal-social-btn {
          flex: 1;
          padding: 12px;
          border: 1px solid #d1d5db;
          background: white;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-weight: 500;
          color: #374151;
          font-size: 14px;
        }

        .auth-modal-social-btn:hover {
          border-color: #9ca3af;
          background: #f9fafb;
        }

        /* Animation */
        .auth-modal-overlay {
          opacity: 0;
          transition: opacity 0.2s ease-out;
        }

        .auth-modal-overlay.show {
          opacity: 1;
        }

        .auth-modal-container {
          transform: scale(0.95) translateY(-10px);
          transition: transform 0.2s ease-out;
        }

        .auth-modal-overlay.show .auth-modal-container {
          transform: scale(1) translateY(0);
        }

        /* Responsive */
        @media (max-width: 480px) {
          .auth-modal-overlay {
            padding: 10px;
          }

          .auth-modal-buttons {
            flex-direction: column;
          }

          .auth-modal-social {
            flex-direction: column;
          }
        }
      </style>
    `;

    if (!document.getElementById('authModalStyles')) {
      document.head.insertAdjacentHTML('beforeend', styles);
    }
  }

  setupEventListeners() {
    // Close modal
    this.modal.querySelector('.auth-modal-close').addEventListener('click', () => {
      this.close();
    });

    // Close on overlay click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });

    // Sign in button
    document.getElementById('authModalSignIn').addEventListener('click', () => {
      this.redirectToAuth('signin');
    });

    // Sign up button
    document.getElementById('authModalSignUp').addEventListener('click', () => {
      this.redirectToAuth('signup');
    });

    // Social sign in
    document.getElementById('authModalGoogle').addEventListener('click', () => {
      this.handleSocialSignIn('google');
    });

    document.getElementById('authModalGitHub').addEventListener('click', () => {
      this.handleSocialSignIn('github');
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  /**
   * Show the authentication modal
   */
  show(options = {}) {
    if (this.isOpen) return;

    this.onSuccess = options.onSuccess || null;
    this.onCancel = options.onCancel || null;

    // Update content if provided
    if (options.title) {
      this.modal.querySelector('.auth-modal-header h3').textContent = options.title;
    }

    if (options.message) {
      this.modal.querySelector('.auth-modal-content p').textContent = options.message;
    }

    // Show modal
    this.modal.style.display = 'flex';
    
    // Trigger animation
    requestAnimationFrame(() => {
      this.modal.classList.add('show');
    });

    this.isOpen = true;

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Focus management
    this.modal.querySelector('.auth-modal-close').focus();
  }

  /**
   * Hide the authentication modal
   */
  close() {
    if (!this.isOpen) return;

    this.modal.classList.remove('show');
    
    setTimeout(() => {
      this.modal.style.display = 'none';
      document.body.style.overflow = '';
    }, 200);

    this.isOpen = false;

    // Call cancel callback
    if (this.onCancel) {
      this.onCancel();
    }
  }

  /**
   * Redirect to auth page
   */
  redirectToAuth(tab = 'signin') {
    // Store current page for redirect after auth
    sessionStorage.setItem('auth_redirect', window.location.href);
    
    // Store preferred tab
    sessionStorage.setItem('auth_tab', tab);
    
    // Determine correct path to auth.html
    const pathDepth = window.location.pathname.split('/').length - 2;
    const basePath = '../'.repeat(Math.max(0, pathDepth - 1));
    
    // Redirect to auth page
    window.location.href = `${basePath}auth.html`;
  }

  /**
   * Handle social sign in
   */
  async handleSocialSignIn(provider) {
    if (!this.authManager) {
      console.error('AuthManager not available');
      return;
    }

    try {
      // Store current page for redirect
      sessionStorage.setItem('auth_redirect', window.location.href);
      
      await this.authManager.signInWithProvider(provider);
    } catch (error) {
      console.error(`${provider} sign in error:`, error);
    }
  }

  /**
   * Check if user is authenticated, show modal if not
   */
  requireAuth(options = {}) {
    if (!this.authManager) {
      console.error('AuthManager not available');
      return false;
    }

    if (this.authManager.isAuthenticated()) {
      return true;
    }

    this.show({
      title: options.title || 'Sign In Required',
      message: options.message || 'Please sign in to access this feature and save your work.',
      onSuccess: options.onSuccess,
      onCancel: options.onCancel
    });

    return false;
  }

  /**
   * Static method to create and show auth modal
   */
  static show(options = {}) {
    if (!window.authModalInstance) {
      window.authModalInstance = new AuthModal();
    }
    window.authModalInstance.show(options);
  }

  /**
   * Static method to require authentication
   */
  static requireAuth(options = {}) {
    if (!window.authModalInstance) {
      window.authModalInstance = new AuthModal();
    }
    return window.authModalInstance.requireAuth(options);
  }
}

// Create global instance when auth manager is available
if (typeof window !== 'undefined') {
  window.addEventListener('supabase-auth-change', () => {
    if (window.authManager && !window.authModalInstance) {
      window.authModalInstance = new AuthModal(window.authManager);
    }
  });

  // Initialize immediately if auth manager is already available
  if (window.authManager) {
    window.authModalInstance = new AuthModal(window.authManager);
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthModal;
}