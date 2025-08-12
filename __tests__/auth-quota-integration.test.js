/**
 * Authentication Guards and Quota Integration Tests
 * Tests for task 13.4: Add authentication guards and quota integration
 * Requirements: 5.1-5.6, 6.1-6.3
 */

// Mock Supabase client
const mockSupabase = {
  auth: {
    getUser: jest.fn(),
    onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } }))
  },
  functions: {
    invoke: jest.fn()
  }
};

// Mock usage tracker
const mockUsageTracker = {
  fetchUsage: jest.fn(),
  getCurrentUsage: jest.fn(),
  recordConversion: jest.fn()
};

// Mock quota manager
const mockQuotaManager = {
  checkConversionQuota: jest.fn(),
  getCurrentPlanLimits: jest.fn()
};

// Mock Stripe manager
const mockStripeManager = {
  purchasePlan: jest.fn(),
  redirectToCustomerPortal: jest.fn()
};

// Set up global mocks
global.window = {
  supabaseClient: { getClient: () => mockSupabase },
  usageTracker: mockUsageTracker,
  quotaManager: mockQuotaManager,
  stripeManager: mockStripeManager,
  location: { href: 'http://localhost/tools/image-converter/index.html' },
  localStorage: {
    getItem: jest.fn(),
    setItem: jest.fn()
  }
};

global.document = {
  getElementById: jest.fn(),
  createElement: jest.fn(),
  body: { appendChild: jest.fn() },
  addEventListener: jest.fn()
};

// Mock the Supabase client creation
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}));

describe('Authentication Guards and Quota Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset localStorage mock
    global.window.localStorage.getItem.mockReturnValue(null);
    global.window.localStorage.setItem.mockImplementation(() => {});
  });

  describe('checkConversionQuota', () => {
    test('should allow guest users with available quota', async () => {
      // Mock guest user (no authentication)
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      
      // Mock guest usage - 1 used out of 3
      global.window.localStorage.getItem.mockReturnValue(
        JSON.stringify({ used: 1, lastReset: Date.now() })
      );

      // Import and test the function
      const { checkConversionQuota } = require('../tools/image-converter/core.js');
      const result = await checkConversionQuota(1);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
      expect(result.isGuest).toBe(true);
      expect(result.plan).toBe('guest');
      expect(result.maxFileSize).toBe(25 * 1024 * 1024); // 25MB
    });

    test('should deny guest users when quota exceeded', async () => {
      // Mock guest user (no authentication)
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      
      // Mock guest usage - 3 used out of 3
      global.window.localStorage.getItem.mockReturnValue(
        JSON.stringify({ used: 3, lastReset: Date.now() })
      );

      const { checkConversionQuota } = require('../tools/image-converter/core.js');
      const result = await checkConversionQuota(1);

      expect(result.allowed).toBe(false);
      expect(result.error).toBe('QUOTA_EXCEEDED');
      expect(result.remaining).toBe(0);
      expect(result.message).toContain('Guest users can convert up to 3 images');
    });

    test('should check authenticated user quota via usage tracker', async () => {
      // Mock authenticated user
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } });
      
      // Mock usage tracker response
      const mockUsage = {
        conversionsUsed: 5,
        conversionsLimit: 10,
        remainingConversions: 5,
        planName: 'Free'
      };
      mockUsageTracker.fetchUsage.mockResolvedValue();
      mockUsageTracker.getCurrentUsage.mockReturnValue(mockUsage);

      const { checkConversionQuota } = require('../tools/image-converter/core.js');
      const result = await checkConversionQuota(1);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
      expect(result.plan).toBe('free');
      expect(mockUsageTracker.fetchUsage).toHaveBeenCalled();
    });

    test('should deny authenticated user when quota exceeded', async () => {
      // Mock authenticated user
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } });
      
      // Mock usage tracker response - quota exceeded
      const mockUsage = {
        conversionsUsed: 10,
        conversionsLimit: 10,
        remainingConversions: 0,
        planName: 'Free'
      };
      mockUsageTracker.fetchUsage.mockResolvedValue();
      mockUsageTracker.getCurrentUsage.mockReturnValue(mockUsage);

      const { checkConversionQuota } = require('../tools/image-converter/core.js');
      const result = await checkConversionQuota(1);

      expect(result.allowed).toBe(false);
      expect(result.error).toBe('QUOTA_EXCEEDED');
      expect(result.remaining).toBe(0);
      expect(result.message).toContain('used all 10 conversions');
    });

    test('should handle quota check errors gracefully', async () => {
      // Mock authentication error
      mockSupabase.auth.getUser.mockRejectedValue(new Error('Auth error'));

      const { checkConversionQuota } = require('../tools/image-converter/core.js');
      const result = await checkConversionQuota(1);

      expect(result.allowed).toBe(false);
      expect(result.error).toBe('QUOTA_CHECK_FAILED');
      expect(result.message).toContain('Unable to check quota');
    });
  });

  describe('recordConversion', () => {
    test('should update guest usage in localStorage', async () => {
      // Mock guest user
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      
      // Mock current guest usage
      global.window.localStorage.getItem.mockReturnValue(
        JSON.stringify({ used: 1, lastReset: Date.now() })
      );

      const { recordConversion } = require('../tools/image-converter/core.js');
      await recordConversion();

      expect(global.window.localStorage.setItem).toHaveBeenCalledWith(
        'guestImageQuota',
        expect.stringContaining('"used":2')
      );
    });

    test('should use usage tracker for authenticated users', async () => {
      // Mock authenticated user
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } });

      const { recordConversion } = require('../tools/image-converter/core.js');
      await recordConversion();

      expect(mockUsageTracker.recordConversion).toHaveBeenCalled();
    });
  });

  describe('getPlanLimits', () => {
    test('should return correct limits for guest plan', () => {
      const { getPlanLimits } = require('../tools/image-converter/core.js');
      const limits = getPlanLimits('guest');

      expect(limits.maxFileSize).toBe(25 * 1024 * 1024); // 25MB
      expect(limits.monthlyConversions).toBe(3);
    });

    test('should return correct limits for free plan', () => {
      const { getPlanLimits } = require('../tools/image-converter/core.js');
      const limits = getPlanLimits('free');

      expect(limits.maxFileSize).toBe(25 * 1024 * 1024); // 25MB
      expect(limits.monthlyConversions).toBe(10);
    });

    test('should return correct limits for pro plan', () => {
      const { getPlanLimits } = require('../tools/image-converter/core.js');
      const limits = getPlanLimits('pro');

      expect(limits.maxFileSize).toBe(100 * 1024 * 1024); // 100MB
      expect(limits.monthlyConversions).toBe(1000);
    });

    test('should return correct limits for unlimited plan', () => {
      const { getPlanLimits } = require('../tools/image-converter/core.js');
      const limits = getPlanLimits('unlimited');

      expect(limits.maxFileSize).toBe(250 * 1024 * 1024); // 250MB
      expect(limits.monthlyConversions).toBe(-1); // Unlimited
    });

    test('should default to free plan for unknown plans', () => {
      const { getPlanLimits } = require('../tools/image-converter/core.js');
      const limits = getPlanLimits('unknown');

      expect(limits.maxFileSize).toBe(25 * 1024 * 1024); // 25MB
      expect(limits.monthlyConversions).toBe(10);
    });
  });

  describe('showUpgradePrompt', () => {
    beforeEach(() => {
      // Mock DOM elements
      global.document.createElement.mockReturnValue({
        className: '',
        style: { cssText: '' },
        innerHTML: '',
        querySelector: jest.fn(() => ({
          addEventListener: jest.fn(),
          remove: jest.fn()
        })),
        addEventListener: jest.fn(),
        remove: jest.fn()
      });
    });

    test('should show guest upgrade prompt for guest users', () => {
      const { showUpgradePrompt } = require('../tools/image-converter/core.js');
      const quotaInfo = { isGuest: true, plan: 'guest' };

      showUpgradePrompt(quotaInfo);

      expect(global.document.createElement).toHaveBeenCalledWith('div');
      expect(global.document.body.appendChild).toHaveBeenCalled();
    });

    test('should show authenticated upgrade prompt for authenticated users', () => {
      const { showUpgradePrompt } = require('../tools/image-converter/core.js');
      const quotaInfo = { isGuest: false, plan: 'free' };

      showUpgradePrompt(quotaInfo);

      expect(global.document.createElement).toHaveBeenCalledWith('div');
      expect(global.document.body.appendChild).toHaveBeenCalled();
    });
  });

  describe('initiateUpgrade', () => {
    test('should call Stripe manager to purchase plan', async () => {
      mockStripeManager.purchasePlan.mockResolvedValue({ success: true });

      const { initiateUpgrade } = require('../tools/image-converter/core.js');
      await initiateUpgrade('pro');

      expect(mockStripeManager.purchasePlan).toHaveBeenCalledWith('pro', {
        successUrl: expect.stringContaining('upgrade=success'),
        cancelUrl: expect.stringContaining('upgrade=canceled')
      });
    });

    test('should handle upgrade errors gracefully', async () => {
      mockStripeManager.purchasePlan.mockRejectedValue(new Error('Stripe error'));
      
      // Mock showNotification
      const mockShowNotification = jest.fn();
      global.window.showNotification = mockShowNotification;

      const { initiateUpgrade } = require('../tools/image-converter/core.js');
      await initiateUpgrade('pro');

      expect(mockShowNotification).toHaveBeenCalledWith(
        'Failed to start upgrade process. Please try again.',
        'error'
      );
    });
  });

  describe('openCustomerPortal', () => {
    test('should call Stripe manager to open portal', async () => {
      mockStripeManager.redirectToCustomerPortal.mockResolvedValue({ success: true });

      const { openCustomerPortal } = require('../tools/image-converter/core.js');
      await openCustomerPortal();

      expect(mockStripeManager.redirectToCustomerPortal).toHaveBeenCalledWith({
        returnUrl: global.window.location.href
      });
    });

    test('should handle portal errors gracefully', async () => {
      mockStripeManager.redirectToCustomerPortal.mockRejectedValue(new Error('Portal error'));
      
      // Mock showNotification
      const mockShowNotification = jest.fn();
      global.window.showNotification = mockShowNotification;

      const { openCustomerPortal } = require('../tools/image-converter/core.js');
      await openCustomerPortal();

      expect(mockShowNotification).toHaveBeenCalledWith(
        'Failed to open billing portal. Please try again.',
        'error'
      );
    });
  });

  describe('Guest Usage Management', () => {
    test('should reset guest usage after 24 hours', () => {
      const yesterday = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      global.window.localStorage.getItem.mockReturnValue(
        JSON.stringify({ used: 3, lastReset: yesterday })
      );

      const { getGuestUsageFromStorage } = require('../tools/image-converter/core.js');
      const usage = getGuestUsageFromStorage();

      expect(usage.used).toBe(0);
      expect(global.window.localStorage.setItem).toHaveBeenCalledWith(
        'guestImageQuota',
        expect.stringContaining('"used":0')
      );
    });

    test('should preserve guest usage within 24 hours', () => {
      const oneHourAgo = Date.now() - (1 * 60 * 60 * 1000); // 1 hour ago
      global.window.localStorage.getItem.mockReturnValue(
        JSON.stringify({ used: 2, lastReset: oneHourAgo })
      );

      const { getGuestUsageFromStorage } = require('../tools/image-converter/core.js');
      const usage = getGuestUsageFromStorage();

      expect(usage.used).toBe(2);
    });
  });

  describe('Integration with File Processing', () => {
    test('should check quota before processing files', async () => {
      // Mock authenticated user with limited quota
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } });
      
      const mockUsage = {
        conversionsUsed: 9,
        conversionsLimit: 10,
        remainingConversions: 1,
        planName: 'Free'
      };
      mockUsageTracker.fetchUsage.mockResolvedValue();
      mockUsageTracker.getCurrentUsage.mockReturnValue(mockUsage);

      const { checkConversionQuota } = require('../tools/image-converter/core.js');
      
      // Try to process 2 files when only 1 remaining
      const result = await checkConversionQuota(2);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(1);
    });

    test('should enforce file size limits based on plan', async () => {
      // Mock free plan user
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } });
      
      const mockUsage = {
        conversionsUsed: 1,
        conversionsLimit: 10,
        remainingConversions: 9,
        planName: 'Free'
      };
      mockUsageTracker.fetchUsage.mockResolvedValue();
      mockUsageTracker.getCurrentUsage.mockReturnValue(mockUsage);

      const { checkConversionQuota } = require('../tools/image-converter/core.js');
      const result = await checkConversionQuota(1);

      expect(result.maxFileSize).toBe(25 * 1024 * 1024); // 25MB for free plan
    });
  });
});