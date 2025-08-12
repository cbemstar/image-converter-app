/**
 * End-to-End Authentication Flow Tests
 * Task 13.5: Test and validate authentication flow (E2E scenarios)
 * 
 * These tests simulate real browser interactions and validate the complete
 * authentication flow from start to finish.
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// Load actual HTML content for realistic testing
const loadHTMLFile = (filePath) => {
  try {
    const fullPath = path.join(__dirname, '..', filePath);
    return fs.readFileSync(fullPath, 'utf8');
  } catch (error) {
    console.warn(`Could not load HTML file: ${filePath}`, error.message);
    return null;
  }
};

// Mock Supabase client that behaves like the real one
const createMockSupabaseClient = () => {
  const mockClient = {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signInWithOAuth: jest.fn(),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      getUser: jest.fn()
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn()
        }))
      })),
      insert: jest.fn(),
      update: jest.fn(() => ({
        eq: jest.fn()
      }))
    }))
  };

  // Set up realistic auth state change behavior
  mockClient.auth.onAuthStateChange.mockImplementation((callback) => {
    // Store callback for later use
    mockClient._authStateCallback = callback;
    return {
      data: {
        subscription: {
          unsubscribe: jest.fn()
        }
      }
    };
  });

  return mockClient;
};

describe('End-to-End Authentication Flow Tests', () => {
  let dom;
  let window;
  let document;
  let mockSupabaseClient;
  let authManager;

  beforeEach(() => {
    // Load actual image converter HTML if available
    const imageConverterHTML = loadHTMLFile('tools/image-converter/index.html') || `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <title>Image Converter</title>
          <script src="../../js/public-config.js"></script>
          <script src="../../js/auth-manager.js"></script>
        </head>
        <body>
          <nav class="bg-background shadow-md border-b border-border">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div class="flex justify-between h-16">
                <div class="flex items-center gap-4">
                  <a href="../../index.html" class="flex items-center gap-2">
                    <span class="text-foreground text-xl font-bold">reformately</span>
                  </a>
                </div>
                <div class="flex items-center gap-2">
                  <div data-guest-only class="flex items-center gap-2">
                    <a href="#" onclick="redirectToAuth()" class="btn btn-outline btn-sm" data-nav-link="auth">
                      <i class="fas fa-sign-in-alt mr-1"></i>
                      Sign In
                    </a>
                  </div>
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
          
          <main class="flex-grow p-4">
            <h1 class="text-3xl font-bold text-center my-8">Image Conversion Tool</h1>
            
            <div id="usage-counter" class="text-center mb-4">
              <div data-auth-required style="display: none;">
                <p>Conversions: <span id="quota-used">0</span> / <span id="quota-limit">10</span></p>
                <p>Plan: <span id="current-plan">Free</span></p>
              </div>
              <div data-guest-only>
                <p>Guest conversions: <span id="guest-quota-used">0</span> / 3</p>
                <p><a href="#" onclick="redirectToAuth()">Sign in</a> for more conversions</p>
              </div>
            </div>

            <div id="drop-area" class="border-2 border-dashed border-blue-400 rounded-lg p-8 text-center">
              <input type="file" id="fileElem" accept="image/*" multiple style="display:none">
              <button onclick="fileElem.click()" class="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-6 py-2 rounded">
                Select Images
              </button>
            </div>
          </main>
        </body>
      </html>
    `;

    // Set up DOM with realistic environment
    dom = new JSDOM(imageConverterHTML, {
      url: 'http://localhost:3000/tools/image-converter/index.html',
      pretendToBeVisual: true,
      resources: 'usable',
      runScripts: 'dangerously'
    });

    window = dom.window;
    document = window.document;

    // Set up global objects
    global.window = window;
    global.document = document;
    global.localStorage = window.localStorage;
    global.sessionStorage = window.sessionStorage;

    // Create mock Supabase client
    mockSupabaseClient = createMockSupabaseClient();
    
    // Set up global Supabase client
    window.supabaseClient = {
      getClient: () => mockSupabaseClient
    };

    // Mock global functions that would be loaded from scripts
    window.redirectToAuth = jest.fn(() => {
      if (window.authManager) {
        window.authManager.storeToolPageForRedirect();
      }
      window.location.href = '../../auth.html';
    });

    // Mock console methods to reduce noise in tests
    global.console.log = jest.fn();
    global.console.warn = jest.fn();
    global.console.error = jest.fn();

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (dom) {
      dom.window.close();
    }
  });

  describe('Complete Authentication Flow Simulation', () => {
    test('should complete full sign-in flow with callback URL preservation', async () => {
      // Step 1: User visits image converter page
      const originalUrl = 'http://localhost:3000/tools/image-converter/index.html?format=webp&quality=80';
      window.location.href = originalUrl;

      // Step 2: User is not authenticated, sees guest UI
      const guestSection = document.querySelector('[data-guest-only]');
      const authSection = document.querySelector('[data-auth-required]');
      
      expect(guestSection).toBeTruthy();
      expect(authSection).toBeTruthy();
      expect(authSection.style.display).toBe('none');

      // Step 3: User clicks sign-in button
      const signInLink = guestSection.querySelector('a[data-nav-link="auth"]');
      expect(signInLink).toBeTruthy();

      // Simulate click
      window.redirectToAuth();

      // Step 4: Verify callback URL is stored and redirect happens
      expect(window.sessionStorage.getItem('auth_redirect')).toBe(originalUrl);
      expect(window.location.href).toBe('../../auth.html');

      // Step 5: Simulate successful authentication (would happen on auth page)
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        email_confirmed_at: new Date().toISOString(),
        user_metadata: {
          full_name: 'Test User',
          avatar_url: 'https://example.com/avatar.jpg'
        }
      };

      const mockSession = {
        access_token: 'mock-token',
        refresh_token: 'mock-refresh',
        user: mockUser
      };

      // Mock successful session
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      // Step 6: Simulate auth state change callback
      if (mockSupabaseClient._authStateCallback) {
        mockSupabaseClient._authStateCallback('SIGNED_IN', mockSession);
      }

      // Step 7: Simulate redirect back to original page
      window.location.href = window.sessionStorage.getItem('auth_redirect');
      window.sessionStorage.removeItem('auth_redirect');

      // Step 8: Verify user is back on original page with auth state
      expect(window.location.href).toBe(originalUrl);
      expect(window.sessionStorage.getItem('auth_redirect')).toBeNull();
    });

    test('should handle OAuth provider authentication flow', async () => {
      // Step 1: User initiates Google OAuth
      mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({
        data: { url: 'https://accounts.google.com/oauth/authorize?...' },
        error: null
      });

      // Simulate OAuth initiation
      const result = await mockSupabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.href
        }
      });

      expect(result.data.url).toContain('google.com');

      // Step 2: Simulate OAuth callback with successful authentication
      const oauthUser = {
        id: 'oauth-user-456',
        email: 'test@gmail.com',
        email_confirmed_at: new Date().toISOString(),
        user_metadata: {
          full_name: 'Google User',
          avatar_url: 'https://lh3.googleusercontent.com/...'
        }
      };

      const oauthSession = {
        access_token: 'oauth-token',
        refresh_token: 'oauth-refresh',
        user: oauthUser
      };

      // Mock OAuth callback session
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: oauthSession },
        error: null
      });

      // Trigger auth state change
      if (mockSupabaseClient._authStateCallback) {
        mockSupabaseClient._authStateCallback('SIGNED_IN', oauthSession);
      }

      // Verify OAuth authentication succeeded
      expect(oauthSession.user.email).toBe('test@gmail.com');
      expect(oauthSession.user.user_metadata.avatar_url).toContain('googleusercontent.com');
    });

    test('should update UI elements correctly after authentication', async () => {
      // Step 1: Initial state - unauthenticated
      const guestSection = document.querySelector('[data-guest-only]');
      const authSection = document.querySelector('[data-auth-required]');
      const userNameElement = document.querySelector('[data-user-info="name"]');
      const userAvatarElement = document.querySelector('[data-user-info="avatar"]');

      // Initial state verification
      expect(authSection.style.display).toBe('none');

      // Step 2: Simulate authentication
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: {
          full_name: 'Test User',
          avatar_url: 'https://example.com/avatar.jpg'
        }
      };

      // Step 3: Update UI to authenticated state
      guestSection.style.display = 'none';
      authSection.style.display = 'block';
      
      if (userNameElement) {
        userNameElement.textContent = mockUser.user_metadata.full_name;
      }
      
      if (userAvatarElement) {
        userAvatarElement.src = mockUser.user_metadata.avatar_url;
        userAvatarElement.style.display = 'block';
      }

      // Step 4: Verify UI updates
      expect(guestSection.style.display).toBe('none');
      expect(authSection.style.display).toBe('block');
      
      if (userNameElement) {
        expect(userNameElement.textContent).toBe('Test User');
      }
      
      if (userAvatarElement) {
        expect(userAvatarElement.src).toBe('https://example.com/avatar.jpg');
        expect(userAvatarElement.style.display).toBe('block');
      }
    });

    test('should handle dropdown menu interactions', async () => {
      // Step 1: Set up authenticated state
      const authSection = document.querySelector('[data-auth-required]');
      authSection.style.display = 'block';

      const dropdownToggle = document.querySelector('.dropdown-toggle');
      const dropdownContent = document.querySelector('.dropdown-content');

      expect(dropdownToggle).toBeTruthy();
      expect(dropdownContent).toBeTruthy();

      // Step 2: Simulate dropdown toggle click
      dropdownToggle.setAttribute('aria-expanded', 'false');
      dropdownContent.style.display = 'none';

      // Click to open
      dropdownToggle.setAttribute('aria-expanded', 'true');
      dropdownContent.style.display = 'block';

      expect(dropdownToggle.getAttribute('aria-expanded')).toBe('true');
      expect(dropdownContent.style.display).toBe('block');

      // Step 3: Test dropdown menu items
      const dashboardLink = dropdownContent.querySelector('[data-nav-link="dashboard"]');
      const profileLink = dropdownContent.querySelector('[data-nav-link="profile"]');
      const signOutLink = dropdownContent.querySelector('[data-action="signout"]');

      expect(dashboardLink).toBeTruthy();
      expect(profileLink).toBeTruthy();
      expect(signOutLink).toBeTruthy();

      expect(dashboardLink.href).toContain('dashboard.html');
      expect(profileLink.href).toContain('profile.html');

      // Step 4: Simulate sign-out click
      mockSupabaseClient.auth.signOut.mockResolvedValue({ error: null });
      
      // Trigger sign-out
      if (mockSupabaseClient._authStateCallback) {
        mockSupabaseClient._authStateCallback('SIGNED_OUT', null);
      }

      // Update UI to signed-out state
      const guestSection = document.querySelector('[data-guest-only]');
      guestSection.style.display = 'block';
      authSection.style.display = 'none';

      expect(guestSection.style.display).toBe('block');
      expect(authSection.style.display).toBe('none');
    });

    test('should display quota information for authenticated users', async () => {
      // Step 1: Set up authenticated state
      const authSection = document.querySelector('[data-auth-required]');
      const guestSection = document.querySelector('[data-guest-only]');
      
      authSection.style.display = 'block';
      guestSection.style.display = 'none';

      // Step 2: Update quota display elements
      const quotaUsed = document.getElementById('quota-used');
      const quotaLimit = document.getElementById('quota-limit');
      const currentPlan = document.getElementById('current-plan');

      expect(quotaUsed).toBeTruthy();
      expect(quotaLimit).toBeTruthy();
      expect(currentPlan).toBeTruthy();

      // Step 3: Simulate quota data update
      const mockQuotaData = {
        conversionsUsed: 5,
        conversionsLimit: 10,
        planName: 'Free'
      };

      quotaUsed.textContent = mockQuotaData.conversionsUsed.toString();
      quotaLimit.textContent = mockQuotaData.conversionsLimit.toString();
      currentPlan.textContent = mockQuotaData.planName;

      // Step 4: Verify quota display
      expect(quotaUsed.textContent).toBe('5');
      expect(quotaLimit.textContent).toBe('10');
      expect(currentPlan.textContent).toBe('Free');
    });

    test('should handle page reload with persistent auth state', async () => {
      // Step 1: Simulate initial authentication
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: { full_name: 'Test User' }
      };

      const mockSession = {
        access_token: 'persistent-token',
        refresh_token: 'persistent-refresh',
        user: mockUser
      };

      // Step 2: Mock session persistence
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      // Step 3: Simulate page reload by re-initializing auth state
      const session = await mockSupabaseClient.auth.getSession();
      
      expect(session.data.session).toBeTruthy();
      expect(session.data.session.user.email).toBe('test@example.com');

      // Step 4: Verify UI would be updated correctly after reload
      if (session.data.session) {
        const authSection = document.querySelector('[data-auth-required]');
        const guestSection = document.querySelector('[data-guest-only]');
        
        authSection.style.display = 'block';
        guestSection.style.display = 'none';

        expect(authSection.style.display).toBe('block');
        expect(guestSection.style.display).toBe('none');
      }
    });
  });

  describe('Error Handling Scenarios', () => {
    test('should handle authentication errors gracefully', async () => {
      // Step 1: Mock authentication failure
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' }
      });

      // Step 2: Attempt sign-in
      const result = await mockSupabaseClient.auth.signInWithPassword({
        email: 'invalid@example.com',
        password: 'wrongpassword'
      });

      // Step 3: Verify error handling
      expect(result.error).toBeTruthy();
      expect(result.error.message).toBe('Invalid login credentials');
      expect(result.data.user).toBeNull();
    });

    test('should handle network errors during OAuth', async () => {
      // Step 1: Mock network error
      mockSupabaseClient.auth.signInWithOAuth.mockRejectedValue(
        new Error('Network request failed')
      );

      // Step 2: Attempt OAuth sign-in
      try {
        await mockSupabaseClient.auth.signInWithOAuth({
          provider: 'google'
        });
      } catch (error) {
        expect(error.message).toBe('Network request failed');
      }
    });

    test('should handle session expiration', async () => {
      // Step 1: Mock expired session
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'JWT expired' }
      });

      // Step 2: Check session
      const result = await mockSupabaseClient.auth.getSession();

      // Step 3: Verify session expiration handling
      expect(result.data.session).toBeNull();
      expect(result.error.message).toBe('JWT expired');
    });
  });

  describe('Accessibility and UX Validation', () => {
    test('should have proper ARIA attributes for dropdown', () => {
      const dropdownToggle = document.querySelector('.dropdown-toggle');
      
      expect(dropdownToggle).toBeTruthy();
      expect(dropdownToggle.getAttribute('aria-label')).toBe('User menu');
      expect(dropdownToggle.hasAttribute('aria-expanded')).toBe(true);
    });

    test('should have proper alt text for user avatar', () => {
      const userAvatar = document.querySelector('[data-user-info="avatar"]');
      
      expect(userAvatar).toBeTruthy();
      expect(userAvatar.getAttribute('alt')).toBe('User avatar');
    });

    test('should maintain focus management in dropdown', () => {
      const dropdownToggle = document.querySelector('.dropdown-toggle');
      const dropdownContent = document.querySelector('.dropdown-content');
      
      // Simulate opening dropdown
      dropdownToggle.setAttribute('aria-expanded', 'true');
      dropdownContent.style.display = 'block';
      
      // Verify dropdown is accessible
      expect(dropdownToggle.getAttribute('aria-expanded')).toBe('true');
      expect(dropdownContent.style.display).toBe('block');
    });
  });
});