/**
 * Secure Cookie Configuration
 * Provides utilities for secure cookie handling with proper security settings
 */

class CookieConfig {
  constructor() {
    this.isSecure = window.location.protocol === 'https:';
    this.domain = this.getDomain();
    
    // Default cookie options
    this.defaultOptions = {
      httpOnly: false, // Browser client needs access to auth cookies
      secure: this.isSecure,
      sameSite: 'lax', // Balance between security and functionality
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 days default
    };

    // Secure cookie options for sensitive data
    this.secureOptions = {
      httpOnly: true, // Server-only access
      secure: true, // Always require HTTPS for secure cookies
      sameSite: 'strict', // Strict same-site policy
      path: '/',
      maxAge: 60 * 60 * 24 // 1 day for sensitive data
    };
  }

  /**
   * Get the appropriate domain for cookies
   */
  getDomain() {
    const hostname = window.location.hostname;
    
    // Don't set domain for localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return null;
    }
    
    // For production, use the current domain
    return hostname;
  }

  /**
   * Get cookie options for authentication cookies
   */
  getAuthCookieOptions(overrides = {}) {
    return {
      ...this.defaultOptions,
      domain: this.domain,
      ...overrides
    };
  }

  /**
   * Get cookie options for secure/sensitive cookies
   */
  getSecureCookieOptions(overrides = {}) {
    return {
      ...this.secureOptions,
      domain: this.domain,
      ...overrides
    };
  }

  /**
   * Get cookie options for session cookies
   */
  getSessionCookieOptions(overrides = {}) {
    return {
      ...this.defaultOptions,
      domain: this.domain,
      maxAge: null, // Session cookie (expires when browser closes)
      ...overrides
    };
  }

  /**
   * Set a cookie with secure configuration
   */
  setCookie(name, value, options = {}) {
    const cookieOptions = {
      ...this.defaultOptions,
      domain: this.domain,
      ...options
    };

    let cookieString = `${name}=${encodeURIComponent(value)}`;

    if (cookieOptions.maxAge !== null && cookieOptions.maxAge !== undefined) {
      cookieString += `; Max-Age=${cookieOptions.maxAge}`;
    }

    if (cookieOptions.expires) {
      cookieString += `; Expires=${cookieOptions.expires.toUTCString()}`;
    }

    if (cookieOptions.path) {
      cookieString += `; Path=${cookieOptions.path}`;
    }

    if (cookieOptions.domain) {
      cookieString += `; Domain=${cookieOptions.domain}`;
    }

    if (cookieOptions.secure) {
      cookieString += '; Secure';
    }

    if (cookieOptions.httpOnly) {
      cookieString += '; HttpOnly';
    }

    if (cookieOptions.sameSite) {
      cookieString += `; SameSite=${cookieOptions.sameSite}`;
    }

    document.cookie = cookieString;
    
    console.log(`Cookie set: ${name} with options:`, cookieOptions);
  }

  /**
   * Get a cookie value
   */
  getCookie(name) {
    if (typeof document === 'undefined') return null;

    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    
    if (parts.length === 2) {
      const cookieValue = parts.pop().split(';').shift();
      return decodeURIComponent(cookieValue);
    }
    
    return null;
  }

  /**
   * Remove a cookie
   */
  removeCookie(name, options = {}) {
    this.setCookie(name, '', {
      ...options,
      maxAge: 0,
      expires: new Date(0)
    });
    
    console.log(`Cookie removed: ${name}`);
  }

  /**
   * Set authentication-related cookie
   */
  setAuthCookie(name, value, options = {}) {
    const authOptions = this.getAuthCookieOptions(options);
    this.setCookie(name, value, authOptions);
  }

  /**
   * Set secure cookie for sensitive data
   */
  setSecureCookie(name, value, options = {}) {
    const secureOptions = this.getSecureCookieOptions(options);
    this.setCookie(name, value, secureOptions);
  }

  /**
   * Set session cookie
   */
  setSessionCookie(name, value, options = {}) {
    const sessionOptions = this.getSessionCookieOptions(options);
    this.setCookie(name, value, sessionOptions);
  }

  /**
   * Clear all authentication cookies
   */
  clearAuthCookies() {
    const authCookieNames = [
      'sb-access-token',
      'sb-refresh-token',
      'supabase-auth-token',
      'supabase.auth.token'
    ];

    authCookieNames.forEach(name => {
      this.removeCookie(name);
      // Also try removing with different path/domain combinations
      this.removeCookie(name, { path: '/' });
      this.removeCookie(name, { path: '/', domain: this.domain });
    });

    console.log('Authentication cookies cleared');
  }

  /**
   * Clear all secure cookies
   */
  clearSecureCookies() {
    const secureCookieNames = [
      'csrf-token',
      'session-fingerprint',
      'security-token'
    ];

    secureCookieNames.forEach(name => {
      this.removeCookie(name, this.getSecureCookieOptions());
    });

    console.log('Secure cookies cleared');
  }

  /**
   * Validate cookie security settings
   */
  validateCookieSecurity() {
    const issues = [];

    // Check if we're using HTTPS in production
    if (window.location.hostname !== 'localhost' && !this.isSecure) {
      issues.push('Cookies should be served over HTTPS in production');
    }

    // Check for mixed content
    if (this.isSecure && window.location.protocol !== 'https:') {
      issues.push('Mixed content detected - secure cookies on non-HTTPS page');
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations: this.getSecurityRecommendations()
    };
  }

  /**
   * Get security recommendations
   */
  getSecurityRecommendations() {
    const recommendations = [];

    if (!this.isSecure) {
      recommendations.push('Use HTTPS to enable secure cookie flags');
    }

    recommendations.push('Regularly rotate session tokens');
    recommendations.push('Implement proper cookie cleanup on logout');
    recommendations.push('Monitor for suspicious cookie activity');

    return recommendations;
  }

  /**
   * Get cookie configuration summary
   */
  getConfigSummary() {
    return {
      isSecure: this.isSecure,
      domain: this.domain,
      defaultOptions: this.defaultOptions,
      secureOptions: this.secureOptions,
      environment: window.location.hostname === 'localhost' ? 'development' : 'production'
    };
  }

  /**
   * Test cookie functionality
   */
  testCookies() {
    const testCookieName = 'cookie-test';
    const testValue = 'test-value-' + Date.now();

    try {
      // Test setting and getting a cookie
      this.setCookie(testCookieName, testValue, { maxAge: 60 });
      const retrievedValue = this.getCookie(testCookieName);
      
      if (retrievedValue === testValue) {
        this.removeCookie(testCookieName);
        return {
          success: true,
          message: 'Cookie functionality is working correctly'
        };
      } else {
        return {
          success: false,
          message: 'Cookie retrieval failed'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Cookie test failed: ${error.message}`
      };
    }
  }
}

// Create global instance
let cookieConfig = null;

export const getCookieConfig = () => {
  if (!cookieConfig) {
    cookieConfig = new CookieConfig();
  }
  return cookieConfig;
};

// Export for direct usage
export default CookieConfig;