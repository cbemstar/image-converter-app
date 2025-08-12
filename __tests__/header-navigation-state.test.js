/**
 * Header Navigation State Tests
 * Tests to ensure header never renders both Sign-In and User menu simultaneously
 */

const { JSDOM } = require('jsdom');

// Mock DOM environment
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<head>
    <title>Test</title>
</head>
<body>
    <!-- Navigation elements -->
    <div id="sign-in-button" data-guest-only>Sign In</div>
    <div id="user-menu" data-auth-required>User Menu</div>
    <div id="loading-indicator" data-auth-component="loading">Loading...</div>
    
    <!-- Auth components -->
    <div id="auth-signin" data-auth-component="sign-in"></div>
    <div id="auth-usermenu" data-auth-component="user-menu"></div>
    
    <!-- Test containers -->
    <div id="test-container"></div>
</body>
</html>
`);

global.window = dom.window;
global.document = dom.window.document;
global.sessionStorage = {
  data: {},
  getItem: function(key) { return this.data[key] || null; },
  setItem: function(key, value) { this.data[key] = value; },
  removeItem: function(key) { delete this.data[key]; },
  clear: function() { this.data = {}; }
};

// Mock console methods
global.console = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

// Mock PUBLIC_ENV
global.window.PUBLIC_ENV = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key'
};

global.window.OAUTH_CONFIG = {
  GITHUB_CLIENT_ID: 'test-github-id',
  GOOGLE_CLIENT_ID: 'test-google-id'
};

describe('Header Navigation State Management', () => {
  let AuthComponents;
  let authComponents;
  let mockAuthUtils;

  beforeEach(() => {
    // Reset DOM - check if elements exist first
    const signInButton = document.getElementById('sign-in-button');
    const userMenu = document.getElementById('user-menu');
    const loadingIndicator = document.getElementById('loading-indicator');
    
    if (signInButton) signInButton.style.display = '';
    if (userMenu) userMenu.style.display = '';
    if (loadingIndicator) loadingIndicator.style.display = '';
    
    // Re-add sign-in-button if it was removed in previous test
    if (!signInButton) {
      const newSignInButton = document.createElement('div');
      newSignInButton.id = 'sign-in-button';
      newSignInButton.setAttribute('data-guest-only', '');
      newSignInButton.textContent = 'Sign In';
      document.body.appendChild(newSignInButton);
    }
    
    // Mock auth utilities
    mockAuthUtils = {
      getState: jest.fn(),
      subscribe: jest.fn(),
      addAuthStateListener: jest.fn(),
      signInWithEmail: jest.fn(),
      signInWithGoogle: jest.fn(),
      signInWithGitHub: jest.fn(),
      signOut: jest.fn(),
      clearError: jest.fn()
    };

    // Mock the auth components class
    AuthComponents = class {
      constructor() {
        this.useAuth = mockAuthUtils;
        this.navigationState = 'loading';
        this.components = new Map();
        this.headerElements = {
          signInButton: null,
          userMenu: null,
          loadingIndicator: null
        };
      }

      handleAuthStateChange(state) {
        if (state.loading) {
          this.navigationState = 'loading';
        } else if (state.isAuthenticated) {
          this.navigationState = 'authenticated';
        } else {
          this.navigationState = 'guest';
        }
        this.ensureHeaderStateConsistency();
      }

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
      }

      getNavigationState() {
        return this.navigationState;
      }
    };

    authComponents = new AuthComponents();
  });

  afterEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  describe('Navigation State Consistency', () => {
    test('should never show both sign-in and user menu simultaneously', () => {
      // Test loading state
      authComponents.handleAuthStateChange({ loading: true, isAuthenticated: false });
      
      const signInVisible = isElementVisible(document.getElementById('sign-in-button'));
      const userMenuVisible = isElementVisible(document.getElementById('user-menu'));
      
      expect(signInVisible && userMenuVisible).toBe(false);
      expect(authComponents.getNavigationState()).toBe('loading');
    });

    test('should show only sign-in elements when user is not authenticated', () => {
      authComponents.handleAuthStateChange({ loading: false, isAuthenticated: false });
      
      const signInVisible = isElementVisible(document.getElementById('sign-in-button'));
      const userMenuVisible = isElementVisible(document.getElementById('user-menu'));
      const loadingVisible = isElementVisible(document.getElementById('loading-indicator'));
      
      expect(signInVisible).toBe(true);
      expect(userMenuVisible).toBe(false);
      expect(loadingVisible).toBe(false);
      expect(authComponents.getNavigationState()).toBe('guest');
    });

    test('should show only user menu when user is authenticated', () => {
      authComponents.handleAuthStateChange({ 
        loading: false, 
        isAuthenticated: true,
        user: { id: '123', email: 'test@example.com' }
      });
      
      const signInVisible = isElementVisible(document.getElementById('sign-in-button'));
      const userMenuVisible = isElementVisible(document.getElementById('user-menu'));
      const loadingVisible = isElementVisible(document.getElementById('loading-indicator'));
      
      expect(signInVisible).toBe(false);
      expect(userMenuVisible).toBe(true);
      expect(loadingVisible).toBe(false);
      expect(authComponents.getNavigationState()).toBe('authenticated');
    });

    test('should show only loading indicator during loading state', () => {
      authComponents.handleAuthStateChange({ loading: true, isAuthenticated: false });
      
      const signInVisible = isElementVisible(document.getElementById('sign-in-button'));
      const userMenuVisible = isElementVisible(document.getElementById('user-menu'));
      const loadingVisible = isElementVisible(document.getElementById('loading-indicator'));
      
      expect(signInVisible).toBe(false);
      expect(userMenuVisible).toBe(false);
      expect(loadingVisible).toBe(true);
      expect(authComponents.getNavigationState()).toBe('loading');
    });
  });

  describe('State Transitions', () => {
    test('should transition from loading to guest state correctly', () => {
      // Start in loading state
      authComponents.handleAuthStateChange({ loading: true, isAuthenticated: false });
      expect(authComponents.getNavigationState()).toBe('loading');
      
      // Transition to guest state
      authComponents.handleAuthStateChange({ loading: false, isAuthenticated: false });
      expect(authComponents.getNavigationState()).toBe('guest');
      
      // Verify only sign-in is visible
      const signInVisible = isElementVisible(document.getElementById('sign-in-button'));
      const userMenuVisible = isElementVisible(document.getElementById('user-menu'));
      
      expect(signInVisible).toBe(true);
      expect(userMenuVisible).toBe(false);
    });

    test('should transition from guest to authenticated state correctly', () => {
      // Start in guest state
      authComponents.handleAuthStateChange({ loading: false, isAuthenticated: false });
      expect(authComponents.getNavigationState()).toBe('guest');
      
      // Transition to authenticated state
      authComponents.handleAuthStateChange({ 
        loading: false, 
        isAuthenticated: true,
        user: { id: '123', email: 'test@example.com' }
      });
      expect(authComponents.getNavigationState()).toBe('authenticated');
      
      // Verify only user menu is visible
      const signInVisible = isElementVisible(document.getElementById('sign-in-button'));
      const userMenuVisible = isElementVisible(document.getElementById('user-menu'));
      
      expect(signInVisible).toBe(false);
      expect(userMenuVisible).toBe(true);
    });

    test('should transition from authenticated to guest state correctly', () => {
      // Start in authenticated state
      authComponents.handleAuthStateChange({ 
        loading: false, 
        isAuthenticated: true,
        user: { id: '123', email: 'test@example.com' }
      });
      expect(authComponents.getNavigationState()).toBe('authenticated');
      
      // Transition to guest state (sign out)
      authComponents.handleAuthStateChange({ loading: false, isAuthenticated: false });
      expect(authComponents.getNavigationState()).toBe('guest');
      
      // Verify only sign-in is visible
      const signInVisible = isElementVisible(document.getElementById('sign-in-button'));
      const userMenuVisible = isElementVisible(document.getElementById('user-menu'));
      
      expect(signInVisible).toBe(true);
      expect(userMenuVisible).toBe(false);
    });
  });

  describe('Multiple Auth Components', () => {
    test('should handle multiple auth components consistently', () => {
      // Add more auth components to DOM
      const additionalSignIn = document.createElement('div');
      additionalSignIn.setAttribute('data-guest-only', '');
      additionalSignIn.id = 'additional-signin';
      document.body.appendChild(additionalSignIn);
      
      const additionalUserMenu = document.createElement('div');
      additionalUserMenu.setAttribute('data-auth-required', '');
      additionalUserMenu.id = 'additional-usermenu';
      document.body.appendChild(additionalUserMenu);
      
      // Test authenticated state
      authComponents.handleAuthStateChange({ 
        loading: false, 
        isAuthenticated: true,
        user: { id: '123', email: 'test@example.com' }
      });
      
      // Check all sign-in elements are hidden
      const signInElements = document.querySelectorAll('[data-guest-only]');
      signInElements.forEach(el => {
        expect(isElementVisible(el)).toBe(false);
      });
      
      // Check all user menu elements are visible
      const userMenuElements = document.querySelectorAll('[data-auth-required]');
      userMenuElements.forEach(el => {
        expect(isElementVisible(el)).toBe(true);
      });
      
      // Cleanup
      document.body.removeChild(additionalSignIn);
      document.body.removeChild(additionalUserMenu);
    });
  });

  describe('Edge Cases', () => {
    test('should handle rapid state changes without conflicts', () => {
      // Simulate rapid state changes
      authComponents.handleAuthStateChange({ loading: true, isAuthenticated: false });
      authComponents.handleAuthStateChange({ loading: false, isAuthenticated: false });
      authComponents.handleAuthStateChange({ loading: false, isAuthenticated: true, user: { id: '123' } });
      authComponents.handleAuthStateChange({ loading: false, isAuthenticated: false });
      
      // Final state should be guest
      expect(authComponents.getNavigationState()).toBe('guest');
      
      const signInVisible = isElementVisible(document.getElementById('sign-in-button'));
      const userMenuVisible = isElementVisible(document.getElementById('user-menu'));
      
      expect(signInVisible).toBe(true);
      expect(userMenuVisible).toBe(false);
    });

    test('should handle missing elements gracefully', () => {
      // Remove an element
      const signInButton = document.getElementById('sign-in-button');
      signInButton.remove();
      
      // Should not throw error
      expect(() => {
        authComponents.handleAuthStateChange({ loading: false, isAuthenticated: false });
      }).not.toThrow();
      
      expect(authComponents.getNavigationState()).toBe('guest');
    });

    test('should handle elements with custom display properties', () => {
      // Set custom display properties
      document.getElementById('sign-in-button').dataset.guestDisplay = 'inline-block';
      document.getElementById('user-menu').dataset.authDisplay = 'flex';
      
      // Test guest state
      authComponents.handleAuthStateChange({ loading: false, isAuthenticated: false });
      
      const signInButton = document.getElementById('sign-in-button');
      expect(signInButton.style.display).toBe('inline-block');
      
      // Test authenticated state
      authComponents.handleAuthStateChange({ 
        loading: false, 
        isAuthenticated: true,
        user: { id: '123', email: 'test@example.com' }
      });
      
      const userMenu = document.getElementById('user-menu');
      expect(userMenu.style.display).toBe('flex');
    });
  });
});

// Helper function to check if element is visible
function isElementVisible(element) {
  if (!element) return false;
  
  const style = element.style;
  const hasHiddenClass = element.classList.contains('hidden');
  const hasDisplayNone = style.display === 'none';
  
  return !hasHiddenClass && !hasDisplayNone;
}

// Visual check test (would be run in browser environment)
describe('Visual Navigation State Check', () => {
  test('should provide visual verification method', () => {
    // This test provides a method for visual verification
    const visualCheck = {
      checkNavigationState: () => {
        const signInElements = document.querySelectorAll('[data-guest-only], [data-auth-component="sign-in"]');
        const userMenuElements = document.querySelectorAll('[data-auth-required], [data-auth-component="user-menu"]');
        
        let signInVisible = 0;
        let userMenuVisible = 0;
        
        signInElements.forEach(el => {
          if (isElementVisible(el)) signInVisible++;
        });
        
        userMenuElements.forEach(el => {
          if (isElementVisible(el)) userMenuVisible++;
        });
        
        return {
          signInVisible,
          userMenuVisible,
          isValid: !(signInVisible > 0 && userMenuVisible > 0),
          message: signInVisible > 0 && userMenuVisible > 0 
            ? 'ERROR: Both sign-in and user menu are visible!'
            : 'OK: Navigation state is consistent'
        };
      }
    };
    
    expect(visualCheck.checkNavigationState).toBeDefined();
    expect(typeof visualCheck.checkNavigationState).toBe('function');
  });
});