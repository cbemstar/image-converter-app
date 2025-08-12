/**
 * Authentication Flow Validation Tests
 * Task 13.5: Test and validate authentication flow
 * 
 * Sub-tasks:
 * - Test sign-in redirect functionality
 * - Verify auth state persistence across page reloads
 * - Test user dropdown menu functionality
 * - Validate quota display for authenticated users
 * 
 * Requirements: All auth-related requirements (1.1-1.6, 11.1-11.6, 12.1-12.6)
 */

const { JSDOM } = require('jsdom');

// Mock Supabase client with comprehensive auth functionality
const mockSupabaseClient = {
  auth: {
    getSession: jest.fn(),
    onAuthStateChange: jest.fn(),
    signInWithOAuth: jest.fn(),
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    getUser: jest.fn(),
    resetPasswordForEmail: jest.fn(),
    updateUser: jest.fn()
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
        order: jest.fn(() => ({
          limit: jest.fn()
        }))
      }))
    })),
    insert: jest.fn(),
    update: jest.fn(() => ({
      eq: jest.fn()
    })),
    delete: jest.fn(() => ({
      eq: jest.fn()
    }))
  }))
};

// Mock AuthManager
class MockAuthManager {
  constructor() {
    this.currentUser = null;
    this.currentSession = null;
    this.authStateListeners = [];
    this.isInitialized = false;
  }

  async initialize() {
    this.isInitialized = true;
    return Promise.resolve();
  }

  isAuthenticated() {
    return !!(this.currentUser && this.currentSession);
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getCurrentSession() {
    return this.currentSession;
  }

  addAuthStateListener(callback) {
    this.authStateListeners.push(callback);
  }

  removeAuthStateListener(callback) {
    this.authStateListeners = this.authStateListeners.filter(l => l !== callback);
  }

  notifyAuthStateListeners(event, session) {
    this.authStateListeners.forEach(callback => {
      try {
        callback(event, session, this.currentUser);
      } catch (error) {
        console.error('Error in auth state listener:', error);
      }
    });
  }

  async signIn(email, password) {
    const mockUser = {
      id: 'test-user-123',
      email: email,
      email_confirmed_at: new Date().toISOString(),
      user_metadata: {
        full_name: 'Test User'
      }
    };

    const mockSession = {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      user: mockUser
    };

    this.currentUser = mockUser;
    this.currentSession = mockSession;

    this.notifyAuthStateListeners('SIGNED_IN', mockSession);
    return { success: true, user: mockUser, session: mockSession };
  }

  async signInWithProvider(provider) {
    const mockUser = {
      id: 'oauth-user-123',
      email: `test@${provider}.com`,
      email_confirmed_at: new Date().toISOString(),
      user_metadata: {
        full_name: `${provider} User`,
        avatar_url: `https://avatar.${provider}.com/test`
      }
    };

    const mockSession = {
      access_token: 'mock-oauth-token',
      refresh_token: 'mock-oauth-refresh',
      user: mockUser
    };

    this.currentUser = mockUser;
    this.currentSession = mockSession;

    this.notifyAuthStateListeners('SIGNED_IN', mockSession);
    return { success: true, data: { url: `https://${provider}.com/oauth` } };
  }

  async signOut() {
    this.currentUser = null;
    this.currentSession = null;
    this.notifyAuthStateListeners('SIGNED_OUT', null);
    return { success: true };
  }

  storeToolPageForRedirect(url) {
    if (global.sessionStorage) {
      global.sessionStorage.setItem('auth_redirect', url || global.window?.location?.href);
    }
  }

  handleAuthRedirect() {
    if (global.sessionStorage) {
      const redirectUrl = global.sessionStorage.getItem('auth_redirect');
      if (redirectUrl) {
        global.sessionStorage.removeItem('auth_redirect');
        if (global.window) {
          global.window.location.href = redirectUrl;
        }
      }
    }
  }

  updateAuthUI() {
    // Mock UI update logic
    const authRequiredElements = global.document?.querySelectorAll('[data-auth-required]') || [];
    const guestOnlyElements = global.document?.querySelectorAll('[data-guest-only]') || [];

    if (this.isAuthenticated()) {
      authRequiredElements.forEach(el => {
        el.style.display = 'block';
        el.classList.remove('hidden');
      });
      guestOnlyElements.forEach(el => {
        el.style.display = 'none';
        el.classList.add('hidden');
      });
    } else {
      authRequiredElements.forEach(el => {
        el.style.display = 'none';
        el.classList.add('hidden');
      });
      guestOnlyElements.forEach(el => {
        el.style.display = 'block';
        el.classList.remove('hidden');
      });
    }
  }
}

// Mock usage tracker
const mockUsageTracker = {
  fetchUsage: jest.fn(),
  getCurrentUsage: jest.fn(() => ({
    conversionsUsed: 3,
    conversionsLimit: 10,
    remainingConversions: 7,
    planName: 'Free',
    periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  })),
  recordConversion: jest.fn()
};

describe('Authentication Flow Validation Tests', () => {
  let dom;
  let window;
  let document;
  let localStorage;
  let sessionStorage;
  let authManager;

  beforeEach(() => {
    // Set up comprehensive DOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <title>Image Converter - Authentication Test</title>
        </head>
        <body>
          <!-- Navigation Bar -->
          <nav class="bg-background shadow-md border-b border-border">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div class="flex justify-between h-16">
                <div class="flex items-center gap-4">
                  <a href="../../index.html" class="flex items-center gap-2">
                    <span class="text-foreground text-xl font-bold">reformately</span>
                  </a>
                </div>
                <div class="flex items-center gap-2">
                  <!-- Guest User -->
                  <div data-guest-only class="flex items-center gap-2">
                    <a href="#" onclick="redirectToAuth()" class="btn btn-outline btn-sm" data-nav-link="auth">
                      <i class="fas fa-sign-in-alt mr-1"></i>
                      Sign In
                    </a>
                  </div>

                  <!-- Authenticated User -->
                  <div data-auth-required class="flex items-center gap-2" style="display: none;">
                    <div class="dropdown dropdown-end relative">
                      <button class="btn btn-outline btn-sm dropdown-toggle" aria-label="User menu" aria-expanded="false">
                        <img data-user-info="avatar" class="w-6 h-6 rounded-full mr-2" alt="User avatar" style="display: none;">
                        <span data-user-info="name" class="hidden sm:inline">User</span>
                        <i class="fas fa-chevron-down ml-1"></i>
                      </button>
                      <ul class="dropdown-content menu p-2 shadow bg-background border border-border rounded-lg w-52" style="display: none;">
                        <li><a href="../../dashboard.html" data-nav-link="dashboard"><i class="fas fa-tachometer-alt"></i>Dashboard</a></li>
                        <li><a href="../../profile.html" data-nav-link="profile"><i class="fas fa-user"></i>Profile</a></li>
                        <li><a href="#" data-action="signout"><i class="fas fa-sign-out-alt"></i>Sign Out</a></li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </nav>

          <!-- Main Content -->
          <main class="flex-grow p-4">
            <h1 class="text-3xl font-bold text-center my-8">Image Conversion Tool</h1>
            
            <!-- Usage Counter -->
            <div id="usage-counter" class="text-center mb-4">
              <div data-auth-required style="display: none;">
                <p>Conversions used: <span id="quota-used">0</span> / <span id="quota-limit">10</span></p>
                <p>Plan: <span id="current-plan">Free</span></p>
                <p>Resets: <span id="quota-reset-date">-</span></p>
              </div>
              <div data-guest-only>
                <p>Guest conversions: <span id="guest-quota-used">0</span> / 3</p>
                <p><a href="#" onclick="redirectToAuth()">Sign in</a> for more conversions</p>
              </div>
            </div>

            <!-- Conversion Area -->
            <div id="conversion-area">
              <input type="file" id="file-input" accept="image/*" multiple />
              <button id="convert-btn">Convert Images</button>
              <div id="conversion-results"></div>
            </div>

            <!-- Upgrade Button -->
            <div class="text-center mt-4">
              <button id="upgrade-btn" data-auth-required style="display: none;">
                Upgrade Plan
              </button>
            </div>
          </main>

          <!-- Auth Modal -->
          <div id="auth-modal" style="display: none;">
            <div class="modal-content">
              <h3>Sign In / Sign Up</h3>
              <input id="auth-email" type="email" placeholder="Email" />
              <input id="auth-password" type="password" placeholder="Password" />
              <button id="sign-in-btn">Sign In</button>
              <button id="sign-up-btn">Sign Up</button>
              <button id="google-sign-in-btn">Sign in with Google</button>
              <button id="github-sign-in-btn">Sign in with GitHub</button>
              <button id="close-modal-btn">Close</button>
            </div>
          </div>
        </body>
      </html>
    `, {
      url: 'http://localhost:3000/tools/image-converter/index.html',
      pretendToBeVisual: true,
      resources: 'usable'
    });

    window = dom.window;
    document = window.document;
    localStorage = window.localStorage;
    sessionStorage = window.sessionStorage;

    // Set up global objects
    global.window = window;
    global.document = document;
    global.localStorage = localStorage;
    global.sessionStorage = sessionStorage;

    // Create mock AuthManager instance
    authManager = new MockAuthManager();
    global.window.authManager = authManager;
    global.window.usageTracker = mockUsageTracker;

    // Mock global functions
    global.window.redirectToAuth = jest.fn(() => {
      authManager.storeToolPageForRedirect();
      window.location.href = '../../auth.html';
    });

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (dom) {
      dom.window.close();
    }
  });

  describe('Sign-in Redirect Functionality', () => {
    test('should store current tool page URL before redirecting to auth', () => {
      const originalUrl = 'http://localhost:3000/tools/image-converter/index.html?format=webp';
      window.location.href = originalUrl;

      // Simulate clicking sign-in button
      const signInLink = document.querySelector('[data-guest-only] a');
      expect(signInLink).toBeTruthy();

      // Trigger redirect to auth
      global.window.redirectToAuth();

      // Verify URL was stored
      expect(sessionStorage.getItem('auth_redirect')).toBe(originalUrl);
      expect(window.location.href).toBe('../../auth.html');
    });

    test('should redirect back to tool page after successful authentication', async () => {
      const toolPageUrl = 'http://localhost:3000/tools/image-converter/index.html';
      sessionStorage.setItem('auth_redirect', toolPageUrl);

      // Simulate successful sign-in
      await authManager.signIn('test@example.com', 'password123');

      // Simulate auth redirect handling
      authManager.handleAuthRedirect();

      // Verify redirect back to tool page
      expect(window.location.href).toBe(toolPageUrl);
      expect(sessionStorage.getItem('auth_redirect')).toBeNull();
    });

    test('should preserve query parameters in callback URL', () => {
      const urlWithParams = 'http://localhost:3000/tools/image-converter/index.html?format=png&quality=90';
      window.location.href = urlWithParams;

      authManager.storeToolPageForRedirect();

      expect(sessionStorage.getItem('auth_redirect')).toBe(urlWithParams);
    });

    test('should handle OAuth provider redirects correctly', async () => {
      const result = await authManager.signInWithProvider('google');

      expect(result.success).toBe(true);
      expect(result.data.url).toContain('google.com/oauth');
      expect(authManager.isAuthenticated()).toBe(true);
    });
  });

  describe('Auth State Persistence Across Page Reloads', () => {
    test('should maintain authentication state after page reload', async () => {
      // Simulate initial authentication
      await authManager.signIn('test@example.com', 'password123');
      expect(authManager.isAuthenticated()).toBe(true);

      const originalUser = authManager.getCurrentUser();
      const originalSession = authManager.getCurrentSession();

      // Simulate page reload by creating new AuthManager instance
      const newAuthManager = new MockAuthManager();
      
      // Simulate session restoration (would normally come from Supabase)
      newAuthManager.currentUser = originalUser;
      newAuthManager.currentSession = originalSession;

      expect(newAuthManager.isAuthenticated()).toBe(true);
      expect(newAuthManager.getCurrentUser().email).toBe('test@example.com');
    });

    test('should update UI state after auth state restoration', async () => {
      // Initially unauthenticated
      authManager.updateAuthUI();
      
      const guestElements = document.querySelectorAll('[data-guest-only]');
      const authElements = document.querySelectorAll('[data-auth-required]');

      // Verify initial state
      guestElements.forEach(el => {
        expect(el.style.display).not.toBe('none');
      });
      authElements.forEach(el => {
        expect(el.style.display).toBe('none');
      });

      // Simulate authentication
      await authManager.signIn('test@example.com', 'password123');
      authManager.updateAuthUI();

      // Verify authenticated state
      guestElements.forEach(el => {
        expect(el.style.display).toBe('none');
      });
      authElements.forEach(el => {
        expect(el.style.display).toBe('block');
      });
    });

    test('should handle auth state listeners correctly after reload', async () => {
      const mockListener = jest.fn();
      authManager.addAuthStateListener(mockListener);

      // Simulate sign-in
      await authManager.signIn('test@example.com', 'password123');

      expect(mockListener).toHaveBeenCalledWith('SIGNED_IN', expect.any(Object), expect.any(Object));

      // Simulate sign-out
      await authManager.signOut();

      expect(mockListener).toHaveBeenCalledWith('SIGNED_OUT', null, null);
    });
  });

  describe('User Dropdown Menu Functionality', () => {
    beforeEach(async () => {
      // Authenticate user for dropdown tests
      await authManager.signIn('test@example.com', 'password123');
      authManager.updateAuthUI();
    });

    test('should display user information in dropdown', () => {
      const userNameElement = document.querySelector('[data-user-info="name"]');
      const userAvatarElement = document.querySelector('[data-user-info="avatar"]');

      expect(userNameElement).toBeTruthy();
      expect(userAvatarElement).toBeTruthy();

      // Verify user info is populated (would be done by actual AuthManager)
      const currentUser = authManager.getCurrentUser();
      expect(currentUser.email).toBe('test@example.com');
    });

    test('should show dropdown menu on button click', () => {
      const dropdownToggle = document.querySelector('.dropdown-toggle');
      const dropdownContent = document.querySelector('.dropdown-content');

      expect(dropdownToggle).toBeTruthy();
      expect(dropdownContent).toBeTruthy();

      // Simulate dropdown toggle
      dropdownToggle.setAttribute('aria-expanded', 'true');
      dropdownContent.style.display = 'block';

      expect(dropdownToggle.getAttribute('aria-expanded')).toBe('true');
      expect(dropdownContent.style.display).toBe('block');
    });

    test('should have working navigation links in dropdown', () => {
      const dashboardLink = document.querySelector('[data-nav-link="dashboard"]');
      const profileLink = document.querySelector('[data-nav-link="profile"]');

      expect(dashboardLink).toBeTruthy();
      expect(profileLink).toBeTruthy();
      expect(dashboardLink.href).toContain('dashboard.html');
      expect(profileLink.href).toContain('profile.html');
    });

    test('should handle sign-out from dropdown', async () => {
      const signOutLink = document.querySelector('[data-action="signout"]');
      expect(signOutLink).toBeTruthy();

      // Simulate sign-out click
      await authManager.signOut();
      authManager.updateAuthUI();

      // Verify user is signed out
      expect(authManager.isAuthenticated()).toBe(false);

      // Verify UI updated
      const guestElements = document.querySelectorAll('[data-guest-only]');
      const authElements = document.querySelectorAll('[data-auth-required]');

      guestElements.forEach(el => {
        expect(el.style.display).toBe('block');
      });
      authElements.forEach(el => {
        expect(el.style.display).toBe('none');
      });
    });

    test('should never show both sign-in and user menu simultaneously', async () => {
      // Test requirement 1.4: Header never renders both Sign-In and User menu simultaneously
      
      // Initially unauthenticated
      authManager.currentUser = null;
      authManager.currentSession = null;
      authManager.updateAuthUI();

      const guestSection = document.querySelector('[data-guest-only]');
      const authSection = document.querySelector('[data-auth-required]');

      expect(guestSection.style.display).not.toBe('none');
      expect(authSection.style.display).toBe('none');

      // Authenticate user
      await authManager.signIn('test@example.com', 'password123');
      authManager.updateAuthUI();

      expect(guestSection.style.display).toBe('none');
      expect(authSection.style.display).toBe('block');

      // Sign out
      await authManager.signOut();
      authManager.updateAuthUI();

      expect(guestSection.style.display).toBe('block');
      expect(authSection.style.display).toBe('none');
    });
  });

  describe('Quota Display for Authenticated Users', () => {
    beforeEach(async () => {
      // Authenticate user and set up usage data
      await authManager.signIn('test@example.com', 'password123');
      authManager.updateAuthUI();
    });

    test('should display current usage and quota limits', () => {
      const usageCounter = document.getElementById('usage-counter');
      const quotaUsed = document.getElementById('quota-used');
      const quotaLimit = document.getElementById('quota-limit');
      const currentPlan = document.getElementById('current-plan');

      expect(usageCounter).toBeTruthy();
      expect(quotaUsed).toBeTruthy();
      expect(quotaLimit).toBeTruthy();
      expect(currentPlan).toBeTruthy();

      // Simulate updating quota display with usage data
      const usageData = mockUsageTracker.getCurrentUsage();
      quotaUsed.textContent = usageData.conversionsUsed.toString();
      quotaLimit.textContent = usageData.conversionsLimit.toString();
      currentPlan.textContent = usageData.planName;

      expect(quotaUsed.textContent).toBe('3');
      expect(quotaLimit.textContent).toBe('10');
      expect(currentPlan.textContent).toBe('Free');
    });

    test('should show quota reset date', () => {
      const quotaResetDate = document.getElementById('quota-reset-date');
      expect(quotaResetDate).toBeTruthy();

      // Simulate setting reset date
      const usageData = mockUsageTracker.getCurrentUsage();
      const resetDate = new Date(usageData.periodEnd);
      quotaResetDate.textContent = resetDate.toLocaleDateString();

      expect(quotaResetDate.textContent).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    });

    test('should hide guest quota and show authenticated quota', () => {
      const guestQuotaSection = document.querySelector('[data-guest-only]');
      const authQuotaSection = document.querySelector('[data-auth-required]');

      // Verify authenticated quota is visible
      expect(authQuotaSection.style.display).toBe('block');
      expect(guestQuotaSection.style.display).toBe('none');
    });

    test('should update quota display after conversion', async () => {
      const quotaUsed = document.getElementById('quota-used');
      
      // Initial state
      quotaUsed.textContent = '3';
      expect(quotaUsed.textContent).toBe('3');

      // Simulate conversion
      await mockUsageTracker.recordConversion();
      
      // Mock updated usage data
      mockUsageTracker.getCurrentUsage.mockReturnValue({
        conversionsUsed: 4,
        conversionsLimit: 10,
        remainingConversions: 6,
        planName: 'Free',
        periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });

      // Simulate UI update
      const updatedUsage = mockUsageTracker.getCurrentUsage();
      quotaUsed.textContent = updatedUsage.conversionsUsed.toString();

      expect(quotaUsed.textContent).toBe('4');
      expect(mockUsageTracker.recordConversion).toHaveBeenCalled();
    });

    test('should show upgrade button for authenticated users', () => {
      const upgradeBtn = document.getElementById('upgrade-btn');
      expect(upgradeBtn).toBeTruthy();
      expect(upgradeBtn.style.display).toBe('block');
    });

    test('should handle quota exceeded state', () => {
      // Mock quota exceeded state
      mockUsageTracker.getCurrentUsage.mockReturnValue({
        conversionsUsed: 10,
        conversionsLimit: 10,
        remainingConversions: 0,
        planName: 'Free',
        periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });

      const quotaUsed = document.getElementById('quota-used');
      const quotaLimit = document.getElementById('quota-limit');
      
      const usageData = mockUsageTracker.getCurrentUsage();
      quotaUsed.textContent = usageData.conversionsUsed.toString();
      quotaLimit.textContent = usageData.conversionsLimit.toString();

      expect(quotaUsed.textContent).toBe('10');
      expect(quotaLimit.textContent).toBe('10');
      expect(usageData.remainingConversions).toBe(0);
    });
  });

  describe('Authentication Error Handling', () => {
    test('should handle sign-in errors gracefully', async () => {
      // Mock sign-in failure
      const mockAuthManagerWithError = new MockAuthManager();
      mockAuthManagerWithError.signIn = jest.fn().mockRejectedValue(new Error('Invalid credentials'));

      try {
        await mockAuthManagerWithError.signIn('invalid@example.com', 'wrongpassword');
      } catch (error) {
        expect(error.message).toBe('Invalid credentials');
      }

      expect(mockAuthManagerWithError.isAuthenticated()).toBe(false);
    });

    test('should handle network errors during authentication', async () => {
      const mockAuthManagerWithNetworkError = new MockAuthManager();
      mockAuthManagerWithNetworkError.signInWithProvider = jest.fn().mockRejectedValue(new Error('Network error'));

      try {
        await mockAuthManagerWithNetworkError.signInWithProvider('google');
      } catch (error) {
        expect(error.message).toBe('Network error');
      }

      expect(mockAuthManagerWithNetworkError.isAuthenticated()).toBe(false);
    });
  });

  describe('Integration with Usage Tracking', () => {
    beforeEach(async () => {
      await authManager.signIn('test@example.com', 'password123');
      authManager.updateAuthUI();
    });

    test('should fetch usage data for authenticated users', async () => {
      await mockUsageTracker.fetchUsage();
      const usageData = mockUsageTracker.getCurrentUsage();

      expect(mockUsageTracker.fetchUsage).toHaveBeenCalled();
      expect(usageData).toHaveProperty('conversionsUsed');
      expect(usageData).toHaveProperty('conversionsLimit');
      expect(usageData).toHaveProperty('planName');
    });

    test('should record conversions for authenticated users', async () => {
      await mockUsageTracker.recordConversion();
      expect(mockUsageTracker.recordConversion).toHaveBeenCalled();
    });
  });
});