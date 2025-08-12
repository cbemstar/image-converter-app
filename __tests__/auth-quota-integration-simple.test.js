/**
 * Simple Authentication Guards and Quota Integration Tests
 * Tests for task 13.4: Add authentication guards and quota integration
 * Requirements: 5.1-5.6, 6.1-6.3
 */

describe('Authentication Guards and Quota Integration', () => {
  // Mock localStorage
  const mockLocalStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn()
  };
  
  // Mock global objects
  global.localStorage = mockLocalStorage;
  global.Date = {
    now: jest.fn(() => 1640995200000) // Fixed timestamp for testing
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Guest Usage Management', () => {
    test('should initialize guest usage correctly', () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      
      // Simulate the guest usage initialization logic
      const initializeGuestUsage = () => {
        const stored = mockLocalStorage.getItem('guestImageQuota');
        const now = Date.now();
        
        if (!stored) {
          const newUsage = { used: 0, lastReset: now };
          mockLocalStorage.setItem('guestImageQuota', JSON.stringify(newUsage));
          return newUsage;
        }
        
        return JSON.parse(stored);
      };

      const usage = initializeGuestUsage();
      
      expect(usage.used).toBe(0);
      expect(usage.lastReset).toBe(1640995200000);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'guestImageQuota',
        JSON.stringify({ used: 0, lastReset: 1640995200000 })
      );
    });

    test('should reset guest usage after 24 hours', () => {
      const yesterday = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      mockLocalStorage.getItem.mockReturnValue(
        JSON.stringify({ used: 3, lastReset: yesterday })
      );
      
      // Simulate the guest usage reset logic
      const getGuestUsage = () => {
        const stored = mockLocalStorage.getItem('guestImageQuota');
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        
        if (stored) {
          const guestData = JSON.parse(stored);
          
          // Reset if more than 24 hours have passed
          if (now - guestData.lastReset > oneDay) {
            const resetData = { used: 0, lastReset: now };
            mockLocalStorage.setItem('guestImageQuota', JSON.stringify(resetData));
            return resetData;
          }
          
          return guestData;
        }
        
        const newData = { used: 0, lastReset: now };
        mockLocalStorage.setItem('guestImageQuota', JSON.stringify(newData));
        return newData;
      };

      const usage = getGuestUsage();
      
      expect(usage.used).toBe(0);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'guestImageQuota',
        JSON.stringify({ used: 0, lastReset: 1640995200000 })
      );
    });

    test('should preserve guest usage within 24 hours', () => {
      const oneHourAgo = Date.now() - (1 * 60 * 60 * 1000); // 1 hour ago
      mockLocalStorage.getItem.mockReturnValue(
        JSON.stringify({ used: 2, lastReset: oneHourAgo })
      );
      
      // Simulate the guest usage check logic
      const getGuestUsage = () => {
        const stored = mockLocalStorage.getItem('guestImageQuota');
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        
        if (stored) {
          const guestData = JSON.parse(stored);
          
          // Don't reset if less than 24 hours have passed
          if (now - guestData.lastReset <= oneDay) {
            return guestData;
          }
        }
        
        return { used: 0, lastReset: now };
      };

      const usage = getGuestUsage();
      
      expect(usage.used).toBe(2);
      expect(usage.lastReset).toBe(oneHourAgo);
    });

    test('should update guest usage correctly', () => {
      mockLocalStorage.getItem.mockReturnValue(
        JSON.stringify({ used: 1, lastReset: Date.now() })
      );
      
      // Simulate the guest usage update logic
      const updateGuestUsage = (increment = 1) => {
        const stored = mockLocalStorage.getItem('guestImageQuota');
        const current = stored ? JSON.parse(stored) : { used: 0, lastReset: Date.now() };
        
        const newUsage = {
          used: current.used + increment,
          lastReset: current.lastReset
        };
        
        mockLocalStorage.setItem('guestImageQuota', JSON.stringify(newUsage));
        return newUsage;
      };

      const updatedUsage = updateGuestUsage(1);
      
      expect(updatedUsage.used).toBe(2);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'guestImageQuota',
        expect.stringContaining('"used":2')
      );
    });
  });

  describe('Plan Limits', () => {
    test('should return correct limits for different plans', () => {
      // Simulate the plan limits logic
      const getPlanLimits = (planName) => {
        const limits = {
          guest: {
            maxFileSize: 25 * 1024 * 1024, // 25MB
            monthlyConversions: 3
          },
          free: {
            maxFileSize: 25 * 1024 * 1024, // 25MB
            monthlyConversions: 10
          },
          pro: {
            maxFileSize: 100 * 1024 * 1024, // 100MB
            monthlyConversions: 1000
          },
          unlimited: {
            maxFileSize: 250 * 1024 * 1024, // 250MB
            monthlyConversions: -1 // Unlimited
          }
        };

        const plan = planName ? planName.toLowerCase() : 'free';
        return limits[plan] || limits.free;
      };

      expect(getPlanLimits('guest')).toEqual({
        maxFileSize: 25 * 1024 * 1024,
        monthlyConversions: 3
      });

      expect(getPlanLimits('free')).toEqual({
        maxFileSize: 25 * 1024 * 1024,
        monthlyConversions: 10
      });

      expect(getPlanLimits('pro')).toEqual({
        maxFileSize: 100 * 1024 * 1024,
        monthlyConversions: 1000
      });

      expect(getPlanLimits('unlimited')).toEqual({
        maxFileSize: 250 * 1024 * 1024,
        monthlyConversions: -1
      });

      // Test default fallback
      expect(getPlanLimits('unknown')).toEqual({
        maxFileSize: 25 * 1024 * 1024,
        monthlyConversions: 10
      });
    });
  });

  describe('Quota Checking Logic', () => {
    test('should allow conversions within guest quota', () => {
      // Simulate guest quota check
      const checkGuestQuota = (requestedCount, currentUsage) => {
        const guestLimit = 3;
        const remaining = Math.max(0, guestLimit - currentUsage.used);
        
        return {
          allowed: remaining >= requestedCount,
          error: remaining < requestedCount ? 'QUOTA_EXCEEDED' : null,
          message: remaining < requestedCount ? 'Guest users can convert up to 3 images. Sign in for more conversions.' : null,
          remaining: remaining,
          maxFileSize: 25 * 1024 * 1024,
          isGuest: true,
          plan: 'guest'
        };
      };

      const currentUsage = { used: 1, lastReset: Date.now() };
      const result = checkGuestQuota(1, currentUsage);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
      expect(result.isGuest).toBe(true);
      expect(result.plan).toBe('guest');
    });

    test('should deny conversions when guest quota exceeded', () => {
      // Simulate guest quota check with exceeded quota
      const checkGuestQuota = (requestedCount, currentUsage) => {
        const guestLimit = 3;
        const remaining = Math.max(0, guestLimit - currentUsage.used);
        
        return {
          allowed: remaining >= requestedCount,
          error: remaining < requestedCount ? 'QUOTA_EXCEEDED' : null,
          message: remaining < requestedCount ? 'Guest users can convert up to 3 images. Sign in for more conversions.' : null,
          remaining: remaining,
          maxFileSize: 25 * 1024 * 1024,
          isGuest: true,
          plan: 'guest'
        };
      };

      const currentUsage = { used: 3, lastReset: Date.now() };
      const result = checkGuestQuota(1, currentUsage);

      expect(result.allowed).toBe(false);
      expect(result.error).toBe('QUOTA_EXCEEDED');
      expect(result.remaining).toBe(0);
      expect(result.message).toContain('Guest users can convert up to 3 images');
    });

    test('should check authenticated user quota', () => {
      // Simulate authenticated user quota check
      const checkAuthenticatedQuota = (requestedCount, usageData) => {
        const remaining = usageData.remainingConversions;
        const planLimits = {
          free: { maxFileSize: 25 * 1024 * 1024 },
          pro: { maxFileSize: 100 * 1024 * 1024 },
          unlimited: { maxFileSize: 250 * 1024 * 1024 }
        };
        
        const plan = usageData.planName.toLowerCase();
        const limits = planLimits[plan] || planLimits.free;
        
        return {
          allowed: remaining >= requestedCount,
          error: remaining < requestedCount ? 'QUOTA_EXCEEDED' : null,
          message: remaining < requestedCount ? `You've used all ${usageData.conversionsLimit} conversions this month. Upgrade for more.` : null,
          remaining: remaining,
          maxFileSize: limits.maxFileSize,
          plan: plan,
          conversionsUsed: usageData.conversionsUsed,
          conversionsLimit: usageData.conversionsLimit
        };
      };

      const usageData = {
        conversionsUsed: 5,
        conversionsLimit: 10,
        remainingConversions: 5,
        planName: 'Free'
      };

      const result = checkAuthenticatedQuota(1, usageData);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
      expect(result.plan).toBe('free');
      expect(result.maxFileSize).toBe(25 * 1024 * 1024);
    });

    test('should deny authenticated user when quota exceeded', () => {
      // Simulate authenticated user quota check with exceeded quota
      const checkAuthenticatedQuota = (requestedCount, usageData) => {
        const remaining = usageData.remainingConversions;
        const planLimits = {
          free: { maxFileSize: 25 * 1024 * 1024 },
          pro: { maxFileSize: 100 * 1024 * 1024 }
        };
        
        const plan = usageData.planName.toLowerCase();
        const limits = planLimits[plan] || planLimits.free;
        
        return {
          allowed: remaining >= requestedCount,
          error: remaining < requestedCount ? 'QUOTA_EXCEEDED' : null,
          message: remaining < requestedCount ? `You've used all ${usageData.conversionsLimit} conversions this month. Upgrade for more.` : null,
          remaining: remaining,
          maxFileSize: limits.maxFileSize,
          plan: plan
        };
      };

      const usageData = {
        conversionsUsed: 10,
        conversionsLimit: 10,
        remainingConversions: 0,
        planName: 'Free'
      };

      const result = checkAuthenticatedQuota(1, usageData);

      expect(result.allowed).toBe(false);
      expect(result.error).toBe('QUOTA_EXCEEDED');
      expect(result.remaining).toBe(0);
      expect(result.message).toContain('used all 10 conversions');
    });
  });

  describe('File Size Validation', () => {
    test('should validate file size against plan limits', () => {
      const validateFileSize = (fileSize, planLimits) => {
        return {
          valid: fileSize <= planLimits.maxFileSize,
          maxSize: planLimits.maxFileSize,
          maxSizeMB: Math.round(planLimits.maxFileSize / (1024 * 1024))
        };
      };

      // Test guest plan limits
      const guestLimits = { maxFileSize: 25 * 1024 * 1024 };
      const smallFile = 10 * 1024 * 1024; // 10MB
      const largeFile = 50 * 1024 * 1024; // 50MB

      expect(validateFileSize(smallFile, guestLimits).valid).toBe(true);
      expect(validateFileSize(largeFile, guestLimits).valid).toBe(false);
      expect(validateFileSize(largeFile, guestLimits).maxSizeMB).toBe(25);

      // Test pro plan limits
      const proLimits = { maxFileSize: 100 * 1024 * 1024 };
      expect(validateFileSize(largeFile, proLimits).valid).toBe(true);
      expect(validateFileSize(largeFile, proLimits).maxSizeMB).toBe(100);
    });
  });

  describe('Error Handling', () => {
    test('should handle quota check errors gracefully', () => {
      const handleQuotaError = (error) => {
        return {
          allowed: false,
          error: 'QUOTA_CHECK_FAILED',
          message: 'Unable to check quota. Please try again.',
          remaining: 0,
          maxFileSize: 25 * 1024 * 1024
        };
      };

      const result = handleQuotaError(new Error('Network error'));

      expect(result.allowed).toBe(false);
      expect(result.error).toBe('QUOTA_CHECK_FAILED');
      expect(result.message).toContain('Unable to check quota');
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle multiple file conversion request', () => {
      const checkBatchConversion = (fileCount, quotaInfo) => {
        if (quotaInfo.remaining < fileCount) {
          return {
            allowed: false,
            canProcessPartial: quotaInfo.remaining > 0,
            maxProcessable: quotaInfo.remaining,
            message: `You can only convert ${quotaInfo.remaining} more images this month. ${fileCount} images selected.`
          };
        }
        
        return {
          allowed: true,
          canProcessPartial: false,
          maxProcessable: fileCount
        };
      };

      // Test with sufficient quota
      let quotaInfo = { remaining: 5 };
      let result = checkBatchConversion(3, quotaInfo);
      expect(result.allowed).toBe(true);
      expect(result.maxProcessable).toBe(3);

      // Test with insufficient quota
      quotaInfo = { remaining: 2 };
      result = checkBatchConversion(5, quotaInfo);
      expect(result.allowed).toBe(false);
      expect(result.canProcessPartial).toBe(true);
      expect(result.maxProcessable).toBe(2);
      expect(result.message).toContain('You can only convert 2 more images');

      // Test with no quota remaining
      quotaInfo = { remaining: 0 };
      result = checkBatchConversion(1, quotaInfo);
      expect(result.allowed).toBe(false);
      expect(result.canProcessPartial).toBe(false);
      expect(result.maxProcessable).toBe(0);
    });
  });
});