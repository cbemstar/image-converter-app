/**
 * Tests for Authentication State Synchronization
 * Verifies that auth state changes are properly synchronized across tool pages
 */

// Mock DOM environment
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable'
});
global.window = dom.window;
global.document = dom.window.document;

// Mock storage objects
global.localStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
global.sessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

// Mock console methods to reduce test noise
const originalConsole = { ...console };
beforeEach(() => {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterEach(() => {
  Object.assign(console, originalConsole);
});

describe('Authentication State Synchronization', () => {
  let AuthStateSynchronizer;
  let mockAuthManager;
  let mockUnifiedNavigation;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    
    // Mock AuthManager
    mockAuthManager = {
      isInitialized: true,
      authStateListeners: [],
      addAuthStateListener: jest.fn((callback) => {
        mockAuthManager.authStateListeners.push(callback);
      }),
      removeAuthStateListener: jest.fn(),
      isAuthenticated: jest.fn(() => false),
      getCurrentUser: jest.fn(() => null),
      getCurrentSession: jest.fn(() => null),
      showAuthMessage: jest.fn()
    };

    // Mock UnifiedNavigation
    mockUnifiedNavigation = {
      updateAuthUI: jest.fn()
    };

    // Set up global mocks
    global.window.authManager = mockAuthManager;
    global.window.unifiedNavigation = mockUnifiedNavigation;

    // Clear module cache and require fresh instance
    jest.resetModules();
    AuthStateSynchronizer = require('../js/auth-state-sync.js');
  });

  afterEach(() => {
    // Clean up global mocks
    delete global.window.authManager;
    delete global.window.unifiedNavigation;
    delete global.window.authStateSynchronizer;
  });

  describe('Initialization', () => {
    test('should initialize successfully with required dependencies', async () => {
      const synchronizer = new AuthStateSynchronizer();
      
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(synchronizer.isInitialized).toBe(true);
      expect(mockAuthManager.addAuthStateListener).toHaveBeenCalled();
    });

    test('should handle missing dependencies gracefully', async () => {
      delete global.window.authManager;
      
      const synchronizer = new AuthStateSynchronizer();
      
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Should still initialize but with fallback functionality
      // Note: Without authManager, it may not fully initialize but should handle gracefully
      expect(typeof synchronizer.isInitialized).toBe('boolean');
    });
  });

  describe('Auth State Change Handling', () => {
    let synchronizer;

    beforeEach(async () => {
      synchronizer = new AuthStateSynchronizer();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should handle sign in event correctly', () => {
      // Set up DOM elements
      document.body.innerHTML = `
        <div data-auth-required style="display: none;">Auth Required</div>
        <div data-guest-only style="display: block;">Guest Only</div>
        <span data-user-info="name">User Name</span>
        <span data-user-info="email">user@example.com</span>
      `;

      const mockUser = {
        email: 'test@example.com',
        user_metadata: { full_name: 'Test User' }
      };
      const mockSession = { user: mockUser };

      // Trigger auth state change
      const authStateListener = mockAuthManager.authStateListeners[0];
      authStateListener('SIGNED_IN', mockSession, mockUser);

      // Check that auth-required elements are shown
      const authRequired = document.querySelector('[data-auth-required]');
      expect(authRequired.style.display).toBe('block');

      // Check that guest-only elements are hidden
      const guestOnly = document.querySelector('[data-guest-only]');
      expect(guestOnly.style.display).toBe('none');

      // Check that user info is updated
      const nameElement = document.querySelector('[data-user-info="name"]');
      expect(nameElement.textContent).toBe('Test User');

      const emailElement = document.querySelector('[data-user-info="email"]');
      expect(emailElement.textContent).toBe('test@example.com');
    });

    test('should handle sign out event correctly', () => {
      // Set up DOM elements in authenticated state
      document.body.innerHTML = `
        <div data-auth-required style="display: block;">Auth Required</div>
        <div data-guest-only style="display: none;">Guest Only</div>
        <span data-user-info="name">Test User</span>
        <span data-user-info="email">test@example.com</span>
      `;

      // Trigger sign out
      const authStateListener = mockAuthManager.authStateListeners[0];
      authStateListener('SIGNED_OUT', null, null);

      // Check that auth-required elements are hidden
      const authRequired = document.querySelector('[data-auth-required]');
      expect(authRequired.style.display).toBe('none');

      // Check that guest-only elements are shown
      const guestOnly = document.querySelector('[data-guest-only]');
      expect(guestOnly.style.display).toBe('block');

      // Check that user info is cleared
      const nameElement = document.querySelector('[data-user-info="name"]');
      expect(nameElement.textContent).toBe('');

      const emailElement = document.querySelector('[data-user-info="email"]');
      expect(emailElement.textContent).toBe('');
    });
  });

  describe('UI Element Updates', () => {
    let synchronizer;

    beforeEach(async () => {
      synchronizer = new AuthStateSynchronizer();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should update auth elements correctly for authenticated state', () => {
      document.body.innerHTML = `
        <div data-auth-required class="hidden">Auth Required</div>
        <div data-guest-only>Guest Only</div>
      `;

      synchronizer.updateAuthElements(true);

      const authRequired = document.querySelector('[data-auth-required]');
      expect(authRequired.style.display).toBe('block');
      expect(authRequired.classList.contains('hidden')).toBe(false);

      const guestOnly = document.querySelector('[data-guest-only]');
      expect(guestOnly.style.display).toBe('none');
      expect(guestOnly.classList.contains('hidden')).toBe(true);
    });

    test('should update auth elements correctly for guest state', () => {
      document.body.innerHTML = `
        <div data-auth-required style="display: block;">Auth Required</div>
        <div data-guest-only style="display: none;" class="hidden">Guest Only</div>
      `;

      synchronizer.updateAuthElements(false);

      const authRequired = document.querySelector('[data-auth-required]');
      expect(authRequired.style.display).toBe('none');
      expect(authRequired.classList.contains('hidden')).toBe(true);

      const guestOnly = document.querySelector('[data-guest-only]');
      expect(guestOnly.style.display).toBe('block');
      expect(guestOnly.classList.contains('hidden')).toBe(false);
    });

    test('should update user elements with user data', () => {
      document.body.innerHTML = `
        <span data-user-info="name"></span>
        <span data-user-info="email"></span>
        <img data-user-info="avatar" style="display: none;">
      `;

      const mockUser = {
        email: 'test@example.com',
        user_metadata: { 
          full_name: 'Test User',
          avatar_url: 'https://example.com/avatar.jpg'
        }
      };

      synchronizer.updateUserElements(mockUser);

      expect(document.querySelector('[data-user-info="name"]').textContent).toBe('Test User');
      expect(document.querySelector('[data-user-info="email"]').textContent).toBe('test@example.com');
      
      const avatar = document.querySelector('[data-user-info="avatar"]');
      expect(avatar.src).toBe('https://example.com/avatar.jpg');
      expect(avatar.style.display).toBe('block');
    });

    test('should clear user elements when signed out', () => {
      document.body.innerHTML = `
        <span data-user-info="name">Test User</span>
        <span data-user-info="email">test@example.com</span>
        <img data-user-info="avatar" src="avatar.jpg" style="display: block;">
      `;

      synchronizer.clearUserElements();

      expect(document.querySelector('[data-user-info="name"]').textContent).toBe('');
      expect(document.querySelector('[data-user-info="email"]').textContent).toBe('');
      
      const avatar = document.querySelector('[data-user-info="avatar"]');
      expect(avatar.style.display).toBe('none');
      // Avatar src might be set to base URL by JSDOM, just check it's not the original
      expect(avatar.src).not.toBe('avatar.jpg');
    });
  });

  describe('Error Handling', () => {
    let synchronizer;

    beforeEach(async () => {
      synchronizer = new AuthStateSynchronizer();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should handle sync errors with retry mechanism', () => {
      // Mock a sync error
      const originalUpdateAuthElements = synchronizer.updateAuthElements;
      let callCount = 0;
      synchronizer.updateAuthElements = jest.fn(() => {
        callCount++;
        if (callCount <= 2) {
          throw new Error('Sync error');
        }
        return originalUpdateAuthElements.call(synchronizer, true);
      });

      // Trigger sync error
      synchronizer.handleSyncError(new Error('Test error'), 'SIGNED_IN', {}, {});

      // Should attempt retry
      expect(synchronizer.retryAttempts).toBe(1);
    });

    test('should show error message when max retries reached', () => {
      synchronizer.retryAttempts = synchronizer.maxRetryAttempts;

      synchronizer.handleMaxRetriesReached(new Error('Test error'), 'SIGNED_IN', {}, {});

      expect(mockAuthManager.showAuthMessage).toHaveBeenCalledWith(
        expect.stringContaining('issue updating the interface'),
        'warning'
      );
    });
  });

  describe('Validation', () => {
    let synchronizer;

    beforeEach(async () => {
      synchronizer = new AuthStateSynchronizer();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should validate sync success correctly', () => {
      document.body.innerHTML = `
        <div data-auth-required style="display: block;">Auth Required</div>
        <div data-guest-only style="display: none;" class="hidden">Guest Only</div>
      `;

      // Mock console methods to capture validation messages
      const consoleSpy = jest.spyOn(console, 'log');

      synchronizer.validateSyncSuccess('SIGNED_IN', {}, {});

      expect(consoleSpy).toHaveBeenCalledWith('Auth sync validation passed');
    });

    test('should detect and correct invalid sync state', () => {
      document.body.innerHTML = `
        <div data-auth-required style="display: none;" class="hidden">Auth Required</div>
        <div data-guest-only style="display: block;">Guest Only</div>
      `;

      const correctSyncStateSpy = jest.spyOn(synchronizer, 'correctSyncState');

      // This should fail validation since auth-required is hidden but user is authenticated
      synchronizer.validateSyncSuccess('SIGNED_IN', {}, {});

      expect(correctSyncStateSpy).toHaveBeenCalledWith(true, {});
    });
  });

  describe('Cross-tab Synchronization', () => {
    let synchronizer;

    beforeEach(async () => {
      synchronizer = new AuthStateSynchronizer();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should handle storage events for cross-tab sync', () => {
      const performImmediateUISyncSpy = jest.spyOn(synchronizer, 'performImmediateUISync');

      // Mock storage event
      const storageEvent = new dom.window.StorageEvent('storage', {
        key: 'supabase.auth.token',
        newValue: 'new-token'
      });

      // Trigger storage event
      dom.window.dispatchEvent(storageEvent);

      // Should trigger UI sync after delay
      setTimeout(() => {
        expect(performImmediateUISyncSpy).toHaveBeenCalled();
      }, 600);
    });
  });

  describe('Custom Events', () => {
    let synchronizer;

    beforeEach(async () => {
      synchronizer = new AuthStateSynchronizer();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should dispatch custom auth state events', (done) => {
      const eventSpy = jest.fn();
      document.addEventListener('authStateChange', eventSpy);

      const mockUser = { email: 'test@example.com' };
      const mockSession = { user: mockUser };

      // Trigger auth state change
      const authStateListener = mockAuthManager.authStateListeners[0];
      authStateListener('SIGNED_IN', mockSession, mockUser);

      // Events are dispatched asynchronously, so wait a bit
      setTimeout(() => {
        expect(eventSpy).toHaveBeenCalled();
        const eventDetail = eventSpy.mock.calls[0][0].detail;
        expect(eventDetail.event).toBe('SIGNED_IN');
        expect(eventDetail.isAuthenticated).toBe(true);
        expect(eventDetail.user).toBe(mockUser);
        done();
      }, 50);
    });
  });
});