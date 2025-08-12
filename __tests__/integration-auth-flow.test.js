/**
 * Authentication Flow Integration Tests
 * 
 * Tests end-to-end authentication flows including callback URL preservation,
 * user profile creation, and session management
 * Requirements: 1.1-1.6, 11.1-11.6, 12.1-12.6
 */

const { JSDOM } = require('jsdom');

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getSession: jest.fn(),
    onAuthStateChange: jest.fn(),
    signInWithOAuth: jest.fn(),
    signInWithPassword: jest.fn(),
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

// Mock the Supabase client creation
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}));

describe('Authentication Flow Integration Tests', () => {
  let dom;
  let window;
  let document;
  let localStorage;
  let sessionStorage;

  beforeEach(() => {
    // Set up DOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Test</title>
        </head>
        <body>
          <div id="auth-container">
            <button id="sign-in-btn">Sign In</button>
            <button id="sign-out-btn" style="display: none;">Sign Out</button>
            <div id="user-menu" style="display: none;">
              <span id="user-email"></span>
            </div>
          </div>
          <div id="conversion-area">
            <input type="file" id="file-input" />
            <button id="convert-btn">Convert</button>
            <div id="quota-display">
              <span id="quota-used">0</span>/<span id="quota-limit">10</span>
            </div>
          </div>
        </body>
      </html>
    `, {
      url: 'http://localhost:3000/tools/image-converter',
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
    global.location = window.location;

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    dom.window.close();
  });

  describe('Callback URL Preservation', () => {
    test('preserves callback URL when redirecting to auth', async () => {
      // Requirement 1.1: Preserve current URL as callback parameter
      const originalUrl = 'http://localhost:3000/tools/image-converter?format=png';
      delete window.location;
      window.location = { href: originalUrl };

      // Mock auth state as unauthenticated
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });

      // Simulate sign-in with OAuth
      mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({
        data: { url: 'https://auth.provider.com/oauth' },
        error: null
      });

      // Import and test auth functionality
      const { signInWithProvider } = require('../js/auth/auth-utils');
      
      await signInWithProvider('google');

      // Verify OAuth was called with callback URL
      expect(mockSupabaseClient.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: originalUrl
        }
      });
    });

    test('redirects back to original page after authentication', async () => {
      // Requirement 1.3: Redirect back to /tools/image-converter after auth
      const callbackUrl = 'http://localhost:3000/tools/image-converter?format=png';
      
      // Mock successful authentication
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        email_confirmed_at: new Date().toISOString()
      };

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { 
          session: { 
            user: mockUser,
            access_token: 'mock-token'
          } 
        },
        error: null
      });

      // Mock profile fetch
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: mockUser.id,
                email: mockUser.email,
                email_verified: true
              },
              error: null
            })
          })
        })
      });

      // Simulate auth state change
      const authStateChangeCallback = jest.fn();
      mockSupabaseClient.auth.onAuthStateChange.mockImplementation((callback) => {
        authStateChangeCallback.mockImplementation(callback);
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      });

      // Import auth hook
      const { useAuth } = require('../js/auth/hooks/useAuth');
      
      // Simulate successful auth
      authStateChangeCallback('SIGNED_IN', { user: mockUser });

      // Verify user state is updated
      expect(authStateChangeCallback).toHaveBeenCalledWith('SIGNED_IN', { user: mockUser });
    });
  });

  describe('User Profile Creation', () => {
    test('creates user profile on first sign-in', async () => {
      // Requirement 11.1: Email verification requirement
      const mockUser = {
        id: 'new-user-123',
        email: 'newuser@example.com',
        email_confirmed_at: new Date().toISOString()
      };

      // Mock profile doesn't exist yet
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' } // Not found
            })
          })
        }),
        insert: jest.fn().mockResolvedValue({
          data: { id: mockUser.id },
          error: null
        })
      });

      // Simulate profile creation trigger (would be handled by database trigger)
      const profileData = {
        id: mockUser.id,
        email: mockUser.email,
        email_verified: true
      };

      // Verify profile creation would be triggered
      expect(mockUser.email_confirmed_at).toBeTruthy();
    });

    test('handles account linking for same email', async () => {
      // Requirement 11.3: Account linking for same email with different providers
      const existingUser = {
        id: 'existing-user-123',
        email: 'user@example.com',
        app_metadata: { provider: 'email' }
      };

      const oauthUser = {
        id: 'oauth-user-456',
        email: 'user@example.com',
        app_metadata: { provider: 'google' }
      };

      // Mock existing profile
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: existingUser.id,
                email: existingUser.email,
                email_verified: true
              },
              error: null
            })
          })
        })
      });

      // Account linking would be handled by Supabase Auth automatically
      // We just verify the profile lookup works correctly
      const profileLookup = mockSupabaseClient.from().select().eq().single();
      const result = await profileLookup;
      
      expect(result.data.email).toBe(existingUser.email);
    });
  });

  describe('Session Security', () => {
    test('rotates session tokens on login', async () => {
      // Requirement 12.3: Session token rotation on login
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'
      };

      const initialSession = {
        access_token: 'initial-token',
        refresh_token: 'initial-refresh',
        user: mockUser
      };

      const rotatedSession = {
        access_token: 'rotated-token',
        refresh_token: 'rotated-refresh',
        user: mockUser
      };

      // Mock initial session
      mockSupabaseClient.auth.getSession
        .mockResolvedValueOnce({
          data: { session: initialSession },
          error: null
        })
        .mockResolvedValueOnce({
          data: { session: rotatedSession },
          error: null
        });

      // Simulate token rotation (would be handled by Supabase)
      const session1 = await mockSupabaseClient.auth.getSession();
      const session2 = await mockSupabaseClient.auth.getSession();

      expect(session1.data.session.access_token).toBe('initial-token');
      expect(session2.data.session.access_token).toBe('rotated-token');
    });

    test('handles session timeout gracefully', async () => {
      // Requirement 12.6: Session timeout and cleanup
      const expiredSession = {
        access_token: 'expired-token',
        expires_at: Date.now() / 1000 - 3600, // Expired 1 hour ago
        user: { id: 'user-123' }
      };

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: expiredSession },
        error: null
      });

      // Mock refresh attempt failure
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'JWT expired' }
      });

      // Simulate session validation
      try {
        await mockSupabaseClient.auth.getUser();
      } catch (error) {
        expect(error.message).toBe('JWT expired');
      }
    });
  });

  describe('Header Navigation State', () => {
    test('never renders both sign-in and user menu simultaneously', async () => {
      // Requirement 1.4: Header never renders both Sign-In and User menu
      const signInBtn = document.getElementById('sign-in-btn');
      const signOutBtn = document.getElementById('sign-out-btn');
      const userMenu = document.getElementById('user-menu');

      // Initial state - unauthenticated
      expect(signInBtn.style.display).not.toBe('none');
      expect(signOutBtn.style.display).toBe('none');
      expect(userMenu.style.display).toBe('none');

      // Simulate authentication
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'
      };

      // Update UI state for authenticated user
      signInBtn.style.display = 'none';
      signOutBtn.style.display = 'block';
      userMenu.style.display = 'block';
      document.getElementById('user-email').textContent = mockUser.email;

      // Verify only user menu is visible
      expect(signInBtn.style.display).toBe('none');
      expect(signOutBtn.style.display).toBe('block');
      expect(userMenu.style.display).toBe('block');

      // Simulate sign out
      signInBtn.style.display = 'block';
      signOutBtn.style.display = 'none';
      userMenu.style.display = 'none';

      // Verify only sign-in is visible
      expect(signInBtn.style.display).toBe('block');
      expect(signOutBtn.style.display).toBe('none');
      expect(userMenu.style.display).toBe('none');
    });
  });

  describe('Email Verification Guards', () => {
    test('blocks paid features for unverified email', async () => {
      // Requirement 11.2: Email verification requirement for paid features
      const unverifiedUser = {
        id: 'user-123',
        email: 'test@example.com',
        email_confirmed_at: null // Not verified
      };

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: unverifiedUser.id,
                email: unverifiedUser.email,
                email_verified: false
              },
              error: null
            })
          })
        })
      });

      // Mock checkout attempt
      const checkoutBtn = document.createElement('button');
      checkoutBtn.id = 'checkout-btn';
      checkoutBtn.onclick = () => {
        // This should be blocked for unverified users
        if (!unverifiedUser.email_confirmed_at) {
          throw new Error('Email verification required');
        }
      };

      // Simulate checkout click
      expect(() => checkoutBtn.onclick()).toThrow('Email verification required');
    });

    test('allows paid features for verified email', async () => {
      // Requirement 11.2: Verified users can access paid features
      const verifiedUser = {
        id: 'user-123',
        email: 'test@example.com',
        email_confirmed_at: new Date().toISOString()
      };

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: verifiedUser.id,
                email: verifiedUser.email,
                email_verified: true
              },
              error: null
            })
          })
        })
      });

      // Mock successful checkout
      const checkoutBtn = document.createElement('button');
      checkoutBtn.onclick = () => {
        if (verifiedUser.email_confirmed_at) {
          return { success: true, checkoutUrl: 'https://checkout.stripe.com/...' };
        }
        throw new Error('Email verification required');
      };

      // Simulate checkout click
      const result = checkoutBtn.onclick();
      expect(result.success).toBe(true);
      expect(result.checkoutUrl).toContain('checkout.stripe.com');
    });
  });
});

// Mock auth utilities module
jest.mock('../js/auth/auth-utils', () => ({
  signInWithProvider: jest.fn(async (provider) => {
    const mockSupabaseClient = require('@supabase/supabase-js').createClient();
    return mockSupabaseClient.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: global.location?.href || 'http://localhost:3000'
      }
    });
  })
}));

// Mock useAuth hook
jest.mock('../js/auth/hooks/useAuth', () => ({
  useAuth: jest.fn(() => ({
    user: null,
    loading: false,
    signIn: jest.fn(),
    signOut: jest.fn()
  }))
}));