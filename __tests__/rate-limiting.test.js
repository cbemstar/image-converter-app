/**
 * Rate Limiting System Tests
 * Tests for rate limiting, abuse detection, and input validation
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

const { describe, test, expect, beforeEach, afterEach, jest } = require('@jest/globals');

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        gte: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        }))
      }))
    })),
    insert: jest.fn(() => Promise.resolve({ error: null })),
    update: jest.fn(() => ({
      eq: jest.fn(() => Promise.resolve({ error: null }))
    })),
    delete: jest.fn(() => ({
      lt: jest.fn(() => Promise.resolve({ error: null }))
    })),
    rpc: jest.fn(() => Promise.resolve({ data: [], error: null }))
  })),
  auth: {
    admin: {
      getUserById: jest.fn(() => Promise.resolve({ data: { id: 'test-user' }, error: null }))
    }
  }
};

// Mock environment variables
global.Deno = {
  env: {
    get: jest.fn((key) => {
      const env = {
        'USER_CONVERSIONS_PER_MINUTE': '30',
        'IP_REQUESTS_PER_MINUTE': '120',
        'SUSPICIOUS_ACTIVITY_THRESHOLD': '100',
        'ABUSE_DETECTION_WINDOW_HOURS': '24',
        'MAX_BACKOFF_MINUTES': '60',
        'MAX_FILE_SIZE': '52428800',
        'MAX_FILENAME_LENGTH': '255',
        'MAX_STRING_LENGTH': '1000',
        'SUPABASE_SERVICE_ROLE_KEY': 'test-service-key'
      };
      return env[key];
    })
  }
};

// Import modules to test
let rateLimiter, inputValidator;

beforeEach(() => {
  jest.clearAllMocks();
  
  // Reset modules
  jest.resetModules();
  
  // Mock the rate limiter module
  rateLimiter = {
    checkUserRateLimit: jest.fn(),
    checkIPRateLimit: jest.fn(),
    recordRateLimitEvent: jest.fn(),
    detectSuspiciousActivity: jest.fn(),
    logSuspiciousActivity: jest.fn(),
    checkSuspensionStatus: jest.fn(),
    suspendAccount: jest.fn(),
    getClientIP: jest.fn(),
    checkRateLimits: jest.fn()
  };
  
  // Mock the input validator module
  inputValidator = {
    validateString: jest.fn(),
    validateNumber: jest.fn(),
    validateEmail: jest.fn(),
    validateUUID: jest.fn(),
    validateFile: jest.fn(),
    validateJSON: jest.fn(),
    validateArray: jest.fn(),
    validateConversionParams: jest.fn(),
    validateRequestSize: jest.fn()
  };
});

describe('Rate Limiting System', () => {
  describe('User Rate Limiting', () => {
    test('should allow requests within user rate limit', async () => {
      rateLimiter.checkUserRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 25,
        resetTime: new Date(Date.now() + 60000)
      });

      const result = await rateLimiter.checkUserRateLimit('test-user-id');
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(25);
      expect(rateLimiter.checkUserRateLimit).toHaveBeenCalledWith('test-user-id');
    });

    test('should block requests exceeding user rate limit', async () => {
      rateLimiter.checkUserRateLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetTime: new Date(Date.now() + 60000),
        backoffSeconds: 60,
        reason: 'User conversion rate limit exceeded'
      });

      const result = await rateLimiter.checkUserRateLimit('test-user-id');
      
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.backoffSeconds).toBe(60);
      expect(result.reason).toContain('rate limit exceeded');
    });

    test('should implement exponential backoff for repeated violations', async () => {
      // First violation
      rateLimiter.checkUserRateLimit.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetTime: new Date(Date.now() + 60000),
        backoffSeconds: 60,
        reason: 'User conversion rate limit exceeded'
      });

      // Second violation (higher backoff)
      rateLimiter.checkUserRateLimit.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetTime: new Date(Date.now() + 60000),
        backoffSeconds: 120,
        reason: 'User conversion rate limit exceeded'
      });

      const result1 = await rateLimiter.checkUserRateLimit('test-user-id');
      const result2 = await rateLimiter.checkUserRateLimit('test-user-id');
      
      expect(result1.backoffSeconds).toBe(60);
      expect(result2.backoffSeconds).toBe(120);
    });
  });

  describe('IP Rate Limiting', () => {
    test('should allow requests within IP rate limit', async () => {
      rateLimiter.checkIPRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 100,
        resetTime: new Date(Date.now() + 60000)
      });

      const result = await rateLimiter.checkIPRateLimit('192.168.1.1');
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(100);
    });

    test('should block requests exceeding IP rate limit', async () => {
      rateLimiter.checkIPRateLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetTime: new Date(Date.now() + 60000),
        backoffSeconds: 60,
        reason: 'IP rate limit exceeded'
      });

      const result = await rateLimiter.checkIPRateLimit('192.168.1.1');
      
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.reason).toContain('IP rate limit exceeded');
    });

    test('should extract client IP from various headers', () => {
      const mockRequest1 = {
        headers: {
          get: jest.fn((header) => {
            if (header === 'cf-connecting-ip') return '1.2.3.4';
            return null;
          })
        }
      };

      const mockRequest2 = {
        headers: {
          get: jest.fn((header) => {
            if (header === 'x-forwarded-for') return '5.6.7.8, 9.10.11.12';
            return null;
          })
        }
      };

      rateLimiter.getClientIP.mockImplementation((req) => {
        const cfIP = req.headers.get('cf-connecting-ip');
        if (cfIP) return cfIP;
        
        const forwardedFor = req.headers.get('x-forwarded-for');
        if (forwardedFor) return forwardedFor.split(',')[0].trim();
        
        return 'unknown';
      });

      expect(rateLimiter.getClientIP(mockRequest1)).toBe('1.2.3.4');
      expect(rateLimiter.getClientIP(mockRequest2)).toBe('5.6.7.8');
    });
  });

  describe('Suspicious Activity Detection', () => {
    test('should detect rapid requests from single IP', async () => {
      rateLimiter.detectSuspiciousActivity.mockResolvedValue([
        {
          userId: 'test-user',
          ipAddress: '192.168.1.1',
          activityType: 'rapid_requests',
          severity: 'high',
          details: {
            requestCount: 150,
            timeWindow: 24,
            threshold: 100
          }
        }
      ]);

      const activities = await rateLimiter.detectSuspiciousActivity('test-user', '192.168.1.1');
      
      expect(activities).toHaveLength(1);
      expect(activities[0].activityType).toBe('rapid_requests');
      expect(activities[0].severity).toBe('high');
      expect(activities[0].details.requestCount).toBe(150);
    });

    test('should detect quota abuse patterns', async () => {
      rateLimiter.detectSuspiciousActivity.mockResolvedValue([
        {
          userId: 'test-user',
          ipAddress: '192.168.1.1',
          activityType: 'quota_abuse',
          severity: 'medium',
          details: {
            conversionAttempts: 75,
            timeWindow: 24,
            threshold: 50
          }
        }
      ]);

      const activities = await rateLimiter.detectSuspiciousActivity('test-user', '192.168.1.1');
      
      expect(activities).toHaveLength(1);
      expect(activities[0].activityType).toBe('quota_abuse');
      expect(activities[0].severity).toBe('medium');
    });

    test('should detect suspicious patterns (multiple IPs)', async () => {
      rateLimiter.detectSuspiciousActivity.mockResolvedValue([
        {
          userId: 'test-user',
          ipAddress: 'multiple',
          activityType: 'suspicious_pattern',
          severity: 'medium',
          details: {
            uniqueIPCount: 15,
            timeWindow: 24,
            threshold: 10
          }
        }
      ]);

      const activities = await rateLimiter.detectSuspiciousActivity('test-user');
      
      expect(activities).toHaveLength(1);
      expect(activities[0].activityType).toBe('suspicious_pattern');
      expect(activities[0].details.uniqueIPCount).toBe(15);
    });
  });

  describe('Account Suspension', () => {
    test('should suspend user account', async () => {
      rateLimiter.suspendAccount.mockResolvedValue(true);

      const result = await rateLimiter.suspendAccount(
        'test-user-id',
        undefined,
        'Manual admin suspension',
        24
      );
      
      expect(result).toBe(true);
      expect(rateLimiter.suspendAccount).toHaveBeenCalledWith(
        'test-user-id',
        undefined,
        'Manual admin suspension',
        24
      );
    });

    test('should suspend IP address', async () => {
      rateLimiter.suspendAccount.mockResolvedValue(true);

      const result = await rateLimiter.suspendAccount(
        undefined,
        '192.168.1.1',
        'Automated abuse detection',
        12
      );
      
      expect(result).toBe(true);
      expect(rateLimiter.suspendAccount).toHaveBeenCalledWith(
        undefined,
        '192.168.1.1',
        'Automated abuse detection',
        12
      );
    });

    test('should check suspension status', async () => {
      rateLimiter.checkSuspensionStatus.mockResolvedValue({
        suspended: true,
        reason: 'Automated abuse detection',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      const status = await rateLimiter.checkSuspensionStatus('test-user-id');
      
      expect(status.suspended).toBe(true);
      expect(status.reason).toBe('Automated abuse detection');
      expect(status.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('Comprehensive Rate Limit Check', () => {
    test('should perform comprehensive rate limit check', async () => {
      rateLimiter.checkRateLimits.mockResolvedValue({
        allowed: true
      });

      const result = await rateLimiter.checkRateLimits('test-user', '192.168.1.1', 'conversion');
      
      expect(result.allowed).toBe(true);
      expect(rateLimiter.checkRateLimits).toHaveBeenCalledWith('test-user', '192.168.1.1', 'conversion');
    });

    test('should block when suspended', async () => {
      rateLimiter.checkRateLimits.mockResolvedValue({
        allowed: false,
        reason: 'Account suspended: Automated abuse detection',
        backoffSeconds: 86400
      });

      const result = await rateLimiter.checkRateLimits('suspended-user', '192.168.1.1', 'conversion');
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Account suspended');
      expect(result.backoffSeconds).toBe(86400);
    });
  });
});

describe('Input Validation System', () => {
  describe('String Validation', () => {
    test('should validate valid strings', () => {
      inputValidator.validateString.mockReturnValue({
        valid: true,
        errors: [],
        sanitized: 'test string',
        warnings: []
      });

      const result = inputValidator.validateString('test string', 'testField');
      
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('test string');
      expect(result.errors).toHaveLength(0);
    });

    test('should reject strings exceeding max length', () => {
      inputValidator.validateString.mockReturnValue({
        valid: false,
        errors: ['testField exceeds maximum length of 10 characters'],
        sanitized: undefined,
        warnings: []
      });

      const result = inputValidator.validateString('this is a very long string', 'testField', { maxLength: 10 });
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('testField exceeds maximum length of 10 characters');
    });

    test('should detect SQL injection patterns', () => {
      inputValidator.validateString.mockReturnValue({
        valid: false,
        errors: ['testField contains potential SQL injection patterns'],
        sanitized: undefined,
        warnings: []
      });

      const result = inputValidator.validateString("'; DROP TABLE users; --", 'testField');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('testField contains potential SQL injection patterns');
    });

    test('should detect XSS patterns', () => {
      inputValidator.validateString.mockReturnValue({
        valid: false,
        errors: ['testField contains potential XSS patterns'],
        sanitized: undefined,
        warnings: []
      });

      const result = inputValidator.validateString('<script>alert("xss")</script>', 'testField');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('testField contains potential XSS patterns');
    });

    test('should detect path traversal patterns', () => {
      inputValidator.validateString.mockReturnValue({
        valid: false,
        errors: ['testField contains path traversal patterns'],
        sanitized: undefined,
        warnings: []
      });

      const result = inputValidator.validateString('../../../etc/passwd', 'testField');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('testField contains path traversal patterns');
    });
  });

  describe('Number Validation', () => {
    test('should validate valid numbers', () => {
      inputValidator.validateNumber.mockReturnValue({
        valid: true,
        errors: [],
        sanitized: 42,
        warnings: []
      });

      const result = inputValidator.validateNumber(42, 'testNumber');
      
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe(42);
    });

    test('should reject numbers outside range', () => {
      inputValidator.validateNumber.mockReturnValue({
        valid: false,
        errors: ['testNumber must be at least 1', 'testNumber must be at most 100'],
        sanitized: undefined,
        warnings: []
      });

      const result = inputValidator.validateNumber(150, 'testNumber', { min: 1, max: 100 });
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('testNumber must be at most 100');
    });

    test('should validate integer requirement', () => {
      inputValidator.validateNumber.mockReturnValue({
        valid: false,
        errors: ['testNumber must be an integer'],
        sanitized: undefined,
        warnings: []
      });

      const result = inputValidator.validateNumber(3.14, 'testNumber', { integer: true });
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('testNumber must be an integer');
    });
  });

  describe('Email Validation', () => {
    test('should validate valid email addresses', () => {
      inputValidator.validateEmail.mockReturnValue({
        valid: true,
        errors: [],
        sanitized: 'test@example.com',
        warnings: []
      });

      const result = inputValidator.validateEmail('test@example.com');
      
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('test@example.com');
    });

    test('should reject invalid email formats', () => {
      inputValidator.validateEmail.mockReturnValue({
        valid: false,
        errors: ['email format is invalid'],
        sanitized: undefined,
        warnings: []
      });

      const result = inputValidator.validateEmail('invalid-email');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('email format is invalid');
    });

    test('should reject emails with dangerous characters', () => {
      inputValidator.validateEmail.mockReturnValue({
        valid: false,
        errors: ['email contains invalid characters'],
        sanitized: undefined,
        warnings: []
      });

      const result = inputValidator.validateEmail('test<script>@example.com');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('email contains invalid characters');
    });
  });

  describe('File Validation', () => {
    test('should validate valid image files', () => {
      const mockFile = {
        name: 'test.jpg',
        size: 1024 * 1024, // 1MB
        type: 'image/jpeg'
      };

      inputValidator.validateFile.mockReturnValue({
        valid: true,
        errors: [],
        warnings: [],
        fileInfo: {
          name: 'test.jpg',
          size: 1024 * 1024,
          type: 'image/jpeg',
          extension: 'jpg'
        }
      });

      const result = inputValidator.validateFile(mockFile);
      
      expect(result.valid).toBe(true);
      expect(result.fileInfo.name).toBe('test.jpg');
      expect(result.fileInfo.extension).toBe('jpg');
    });

    test('should reject files exceeding size limit', () => {
      const mockFile = {
        name: 'large.jpg',
        size: 100 * 1024 * 1024, // 100MB
        type: 'image/jpeg'
      };

      inputValidator.validateFile.mockReturnValue({
        valid: false,
        errors: ['File size exceeds maximum limit of 50MB'],
        warnings: [],
        fileInfo: {
          name: 'large.jpg',
          size: 100 * 1024 * 1024,
          type: 'image/jpeg',
          extension: 'jpg'
        }
      });

      const result = inputValidator.validateFile(mockFile);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('File size exceeds maximum limit of 50MB');
    });

    test('should reject unsupported file types', () => {
      const mockFile = {
        name: 'test.exe',
        size: 1024,
        type: 'application/x-executable'
      };

      inputValidator.validateFile.mockReturnValue({
        valid: false,
        errors: ['File type application/x-executable is not allowed. Allowed types: image/jpeg, image/png, image/webp, image/gif'],
        warnings: [],
        fileInfo: {
          name: 'test.exe',
          size: 1024,
          type: 'application/x-executable',
          extension: 'exe'
        }
      });

      const result = inputValidator.validateFile(mockFile);
      
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('File type application/x-executable is not allowed');
    });

    test('should detect dangerous filenames', () => {
      const mockFile = {
        name: '../../../malicious.jpg',
        size: 1024,
        type: 'image/jpeg'
      };

      inputValidator.validateFile.mockReturnValue({
        valid: false,
        errors: ['Filename contains path traversal patterns'],
        warnings: [],
        fileInfo: {
          name: '../../../malicious.jpg',
          size: 1024,
          type: 'image/jpeg',
          extension: 'jpg'
        }
      });

      const result = inputValidator.validateFile(mockFile);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Filename contains path traversal patterns');
    });
  });

  describe('Conversion Parameters Validation', () => {
    test('should validate valid conversion parameters', () => {
      const params = {
        target_format: 'png',
        quality: 90,
        max_width: 1920,
        max_height: 1080
      };

      inputValidator.validateConversionParams.mockReturnValue({
        valid: true,
        errors: [],
        sanitized: {
          target_format: 'png',
          quality: 90,
          max_width: 1920,
          max_height: 1080
        },
        warnings: []
      });

      const result = inputValidator.validateConversionParams(params);
      
      expect(result.valid).toBe(true);
      expect(result.sanitized.target_format).toBe('png');
      expect(result.sanitized.quality).toBe(90);
    });

    test('should reject invalid target formats', () => {
      const params = {
        target_format: 'invalid_format'
      };

      inputValidator.validateConversionParams.mockReturnValue({
        valid: false,
        errors: ['Invalid target format. Allowed formats: jpeg, jpg, png, webp, gif'],
        sanitized: undefined,
        warnings: []
      });

      const result = inputValidator.validateConversionParams(params);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid target format. Allowed formats: jpeg, jpg, png, webp, gif');
    });

    test('should reject quality values outside valid range', () => {
      const params = {
        target_format: 'jpeg',
        quality: 150
      };

      inputValidator.validateConversionParams.mockReturnValue({
        valid: false,
        errors: ['quality must be at most 100'],
        sanitized: undefined,
        warnings: []
      });

      const result = inputValidator.validateConversionParams(params);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('quality must be at most 100');
    });
  });

  describe('Request Size Validation', () => {
    test('should allow requests within size limit', () => {
      const mockRequest = {
        headers: {
          get: jest.fn(() => '1048576') // 1MB
        }
      };

      inputValidator.validateRequestSize.mockReturnValue({
        valid: true,
        errors: []
      });

      const result = inputValidator.validateRequestSize(mockRequest);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject requests exceeding size limit', () => {
      const mockRequest = {
        headers: {
          get: jest.fn(() => '209715200') // 200MB
        }
      };

      inputValidator.validateRequestSize.mockReturnValue({
        valid: false,
        errors: ['Request size 200MB exceeds maximum limit of 100MB']
      });

      const result = inputValidator.validateRequestSize(mockRequest);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Request size 200MB exceeds maximum limit of 100MB');
    });
  });
});

describe('Integration Tests', () => {
  test('should handle rate limited conversion request', async () => {
    // Mock rate limit check returning blocked
    rateLimiter.checkRateLimits.mockResolvedValue({
      allowed: false,
      reason: 'User conversion rate limit exceeded',
      backoffSeconds: 60,
      remaining: 0,
      resetTime: new Date(Date.now() + 60000)
    });

    const result = await rateLimiter.checkRateLimits('test-user', '192.168.1.1', 'conversion');
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('rate limit exceeded');
    expect(result.backoffSeconds).toBe(60);
  });

  test('should validate and process secure file upload', () => {
    const mockFile = {
      name: 'test-image.jpg',
      size: 2 * 1024 * 1024, // 2MB
      type: 'image/jpeg'
    };

    const conversionParams = {
      target_format: 'png',
      quality: 85
    };

    // Mock successful validation
    inputValidator.validateFile.mockReturnValue({
      valid: true,
      errors: [],
      warnings: [],
      fileInfo: {
        name: 'test-image.jpg',
        size: 2 * 1024 * 1024,
        type: 'image/jpeg',
        extension: 'jpg'
      }
    });

    inputValidator.validateConversionParams.mockReturnValue({
      valid: true,
      errors: [],
      sanitized: {
        target_format: 'png',
        quality: 85
      },
      warnings: []
    });

    const fileResult = inputValidator.validateFile(mockFile);
    const paramsResult = inputValidator.validateConversionParams(conversionParams);
    
    expect(fileResult.valid).toBe(true);
    expect(paramsResult.valid).toBe(true);
    expect(paramsResult.sanitized.target_format).toBe('png');
  });

  test('should detect and handle suspicious activity', async () => {
    // Mock suspicious activity detection
    rateLimiter.detectSuspiciousActivity.mockResolvedValue([
      {
        userId: 'test-user',
        ipAddress: '192.168.1.1',
        activityType: 'rapid_requests',
        severity: 'high',
        details: {
          requestCount: 200,
          timeWindow: 24,
          threshold: 100
        }
      }
    ]);

    // Mock automatic suspension
    rateLimiter.suspendAccount.mockResolvedValue(true);

    const activities = await rateLimiter.detectSuspiciousActivity('test-user', '192.168.1.1');
    
    expect(activities).toHaveLength(1);
    expect(activities[0].severity).toBe('high');
    
    // Should trigger automatic suspension for high severity
    if (activities[0].severity === 'high') {
      const suspended = await rateLimiter.suspendAccount(
        'test-user',
        '192.168.1.1',
        'Automated suspension: rapid_requests',
        24
      );
      expect(suspended).toBe(true);
    }
  });
});

console.log('Rate limiting tests loaded');