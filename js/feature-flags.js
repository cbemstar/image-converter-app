/**
 * Feature Flags System
 * Provides client-side utilities for checking feature flags
 */

class FeatureFlagManager {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
    this.cache = new Map();
    this.cacheExpiry = new Map();
    this.cacheDuration = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Check if a feature flag is enabled for the current user
   * @param {string} flagName - Name of the feature flag
   * @param {boolean} useCache - Whether to use cached result
   * @returns {Promise<boolean>}
   */
  async isEnabled(flagName, useCache = true) {
    try {
      // Check cache first
      if (useCache && this.isCacheValid(flagName)) {
        return this.cache.get(flagName);
      }

      // Call the database function
      const { data, error } = await this.supabase
        .rpc('check_feature_flag', { flag_name: flagName });

      if (error) {
        console.error('Feature flag check error:', error);
        return false;
      }

      const isEnabled = data || false;

      // Cache the result
      this.cache.set(flagName, isEnabled);
      this.cacheExpiry.set(flagName, Date.now() + this.cacheDuration);

      return isEnabled;
    } catch (error) {
      console.error('Feature flag check failed:', error);
      return false;
    }
  }

  /**
   * Check multiple feature flags at once
   * @param {string[]} flagNames - Array of flag names
   * @returns {Promise<Object>} Object with flag names as keys and boolean values
   */
  async checkMultiple(flagNames) {
    const results = {};
    
    await Promise.all(
      flagNames.map(async (flagName) => {
        results[flagName] = await this.isEnabled(flagName);
      })
    );

    return results;
  }

  /**
   * Clear cache for a specific flag or all flags
   * @param {string} flagName - Optional flag name to clear, clears all if not provided
   */
  clearCache(flagName = null) {
    if (flagName) {
      this.cache.delete(flagName);
      this.cacheExpiry.delete(flagName);
    } else {
      this.cache.clear();
      this.cacheExpiry.clear();
    }
  }

  /**
   * Check if cached value is still valid
   * @param {string} flagName - Name of the feature flag
   * @returns {boolean}
   */
  isCacheValid(flagName) {
    if (!this.cache.has(flagName) || !this.cacheExpiry.has(flagName)) {
      return false;
    }
    return Date.now() < this.cacheExpiry.get(flagName);
  }

  /**
   * Preload commonly used feature flags
   * @param {string[]} flagNames - Array of flag names to preload
   */
  async preload(flagNames) {
    await this.checkMultiple(flagNames);
  }

  /**
   * Get all cached flags (for debugging)
   * @returns {Object}
   */
  getCachedFlags() {
    const result = {};
    for (const [key, value] of this.cache.entries()) {
      result[key] = {
        value,
        expires: new Date(this.cacheExpiry.get(key)),
        valid: this.isCacheValid(key)
      };
    }
    return result;
  }
}

/**
 * Feature flag constants for easy reference
 */
const FEATURE_FLAGS = {
  AUTH_ENABLED: 'auth_enabled',
  BILLING_ENABLED: 'billing_enabled',
  CONVERSION_METERING: 'conversion_metering',
  STRIPE_INTEGRATION: 'stripe_integration'
};

/**
 * Global feature flag manager instance
 * Initialize this with your Supabase client
 */
let globalFeatureFlags = null;

/**
 * Initialize the global feature flag manager
 * @param {Object} supabaseClient - Supabase client instance
 */
function initializeFeatureFlags(supabaseClient) {
  globalFeatureFlags = new FeatureFlagManager(supabaseClient);
  return globalFeatureFlags;
}

/**
 * Get the global feature flag manager
 * @returns {FeatureFlagManager}
 */
function getFeatureFlags() {
  if (!globalFeatureFlags) {
    throw new Error('Feature flags not initialized. Call initializeFeatureFlags() first.');
  }
  return globalFeatureFlags;
}

/**
 * Convenience function to check a feature flag
 * @param {string} flagName - Name of the feature flag
 * @returns {Promise<boolean>}
 */
async function isFeatureEnabled(flagName) {
  return getFeatureFlags().isEnabled(flagName);
}

/**
 * Higher-order function to conditionally render content based on feature flags
 * @param {string} flagName - Name of the feature flag
 * @param {Function} enabledCallback - Function to call if flag is enabled
 * @param {Function} disabledCallback - Function to call if flag is disabled
 */
async function withFeatureFlag(flagName, enabledCallback, disabledCallback = null) {
  const isEnabled = await isFeatureEnabled(flagName);
  
  if (isEnabled && enabledCallback) {
    return enabledCallback();
  } else if (!isEnabled && disabledCallback) {
    return disabledCallback();
  }
}

/**
 * Environment variable fallback for feature flags
 * Useful for development and testing
 */
function getFeatureFlagFromEnv(flagName, defaultValue = false) {
  const envKey = `FEATURE_${flagName.toUpperCase()}`;
  const envValue = window.ENV?.[envKey] || process.env?.[envKey];
  
  if (envValue === undefined) {
    return defaultValue;
  }
  
  return envValue === 'true' || envValue === '1';
}

/**
 * Feature flag with environment fallback
 * @param {string} flagName - Name of the feature flag
 * @param {boolean} defaultValue - Default value if flag is not found
 * @returns {Promise<boolean>}
 */
async function isFeatureEnabledWithFallback(flagName, defaultValue = false) {
  try {
    // Try database first
    const dbResult = await isFeatureEnabled(flagName);
    return dbResult;
  } catch (error) {
    console.warn(`Feature flag ${flagName} check failed, using environment fallback:`, error);
    return getFeatureFlagFromEnv(flagName, defaultValue);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FeatureFlagManager,
    FEATURE_FLAGS,
    initializeFeatureFlags,
    getFeatureFlags,
    isFeatureEnabled,
    withFeatureFlag,
    getFeatureFlagFromEnv,
    isFeatureEnabledWithFallback
  };
} else if (typeof window !== 'undefined') {
  // Browser environment
  window.FeatureFlags = {
    FeatureFlagManager,
    FEATURE_FLAGS,
    initializeFeatureFlags,
    getFeatureFlags,
    isFeatureEnabled,
    withFeatureFlag,
    getFeatureFlagFromEnv,
    isFeatureEnabledWithFallback
  };
}