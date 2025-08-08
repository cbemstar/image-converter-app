/**
 * CacheManager - Intelligent caching system for frequently accessed data
 * Implements multiple caching strategies with TTL and memory management
 */

class CacheManager {
  constructor(options = {}) {
    this.maxMemorySize = options.maxMemorySize || 50 * 1024 * 1024; // 50MB default
    this.defaultTTL = options.defaultTTL || 5 * 60 * 1000; // 5 minutes default
    this.cleanupInterval = options.cleanupInterval || 60 * 1000; // 1 minute cleanup
    
    // Memory cache for frequently accessed data
    this.memoryCache = new Map();
    this.cacheMetadata = new Map();
    this.currentMemoryUsage = 0;
    
    // Cache hit/miss statistics
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      cleanups: 0
    };
    
    // Start cleanup interval
    this.startCleanupInterval();
    
    console.log('CacheManager initialized with max memory:', this.formatBytes(this.maxMemorySize));
  }

  /**
   * Set cache entry with TTL and size tracking
   */
  set(key, value, ttl = null) {
    try {
      const serializedValue = JSON.stringify(value);
      const size = new Blob([serializedValue]).size;
      const expiresAt = Date.now() + (ttl || this.defaultTTL);
      
      // Check if we need to evict entries to make space
      this.ensureSpace(size);
      
      // Remove existing entry if present
      if (this.memoryCache.has(key)) {
        this.remove(key);
      }
      
      // Add new entry
      this.memoryCache.set(key, serializedValue);
      this.cacheMetadata.set(key, {
        size,
        expiresAt,
        accessCount: 0,
        lastAccessed: Date.now(),
        created: Date.now()
      });
      
      this.currentMemoryUsage += size;
      
      // Also cache in localStorage for persistence (with size limits)
      this.setLocalStorageCache(key, value, expiresAt);
      
      return true;
      
    } catch (error) {
      console.warn('Cache set error:', error);
      return false;
    }
  }

  /**
   * Get cache entry with hit tracking
   */
  get(key) {
    try {
      // Check memory cache first
      if (this.memoryCache.has(key)) {
        const metadata = this.cacheMetadata.get(key);
        
        // Check if expired
        if (metadata.expiresAt < Date.now()) {
          this.remove(key);
          this.stats.misses++;
          return null;
        }
        
        // Update access metadata
        metadata.accessCount++;
        metadata.lastAccessed = Date.now();
        
        this.stats.hits++;
        return JSON.parse(this.memoryCache.get(key));
      }
      
      // Check localStorage cache
      const localValue = this.getLocalStorageCache(key);
      if (localValue) {
        // Promote to memory cache
        this.set(key, localValue, this.defaultTTL);
        this.stats.hits++;
        return localValue;
      }
      
      this.stats.misses++;
      return null;
      
    } catch (error) {
      console.warn('Cache get error:', error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Remove cache entry
   */
  remove(key) {
    if (this.memoryCache.has(key)) {
      const metadata = this.cacheMetadata.get(key);
      this.currentMemoryUsage -= metadata.size;
      
      this.memoryCache.delete(key);
      this.cacheMetadata.delete(key);
    }
    
    // Also remove from localStorage
    this.removeLocalStorageCache(key);
  }

  /**
   * Check if key exists and is not expired
   */
  has(key) {
    if (this.memoryCache.has(key)) {
      const metadata = this.cacheMetadata.get(key);
      if (metadata.expiresAt >= Date.now()) {
        return true;
      } else {
        this.remove(key);
      }
    }
    
    return this.hasLocalStorageCache(key);
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.memoryCache.clear();
    this.cacheMetadata.clear();
    this.currentMemoryUsage = 0;
    
    // Clear localStorage cache
    this.clearLocalStorageCache();
    
    console.log('Cache cleared');
  }

  /**
   * Ensure enough space for new entry
   */
  ensureSpace(requiredSize) {
    if (this.currentMemoryUsage + requiredSize <= this.maxMemorySize) {
      return;
    }
    
    // Get entries sorted by priority (LRU + access frequency)
    const entries = Array.from(this.cacheMetadata.entries())
      .map(([key, metadata]) => ({
        key,
        ...metadata,
        priority: this.calculatePriority(metadata)
      }))
      .sort((a, b) => a.priority - b.priority);
    
    // Evict entries until we have enough space
    let freedSpace = 0;
    for (const entry of entries) {
      if (this.currentMemoryUsage - freedSpace + requiredSize <= this.maxMemorySize) {
        break;
      }
      
      this.remove(entry.key);
      freedSpace += entry.size;
      this.stats.evictions++;
    }
  }

  /**
   * Calculate cache entry priority (lower = more likely to be evicted)
   */
  calculatePriority(metadata) {
    const now = Date.now();
    const age = now - metadata.created;
    const timeSinceAccess = now - metadata.lastAccessed;
    const accessFrequency = metadata.accessCount / (age / 1000 / 60); // accesses per minute
    
    // Higher access frequency and recent access = higher priority
    return timeSinceAccess / (accessFrequency + 1);
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, metadata] of this.cacheMetadata.entries()) {
      if (metadata.expiresAt < now) {
        this.remove(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      this.stats.cleanups++;
      console.log(`Cache cleanup: removed ${cleanedCount} expired entries`);
    }
  }

  /**
   * Start cleanup interval
   */
  startCleanupInterval() {
    this.cleanupIntervalId = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * Stop cleanup interval
   */
  stopCleanupInterval() {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
  }

  /**
   * LocalStorage cache methods
   */
  setLocalStorageCache(key, value, expiresAt) {
    try {
      const cacheKey = `cache_${key}`;
      const cacheData = {
        value,
        expiresAt,
        size: JSON.stringify(value).length
      };
      
      // Check localStorage space (approximate)
      const serialized = JSON.stringify(cacheData);
      if (serialized.length > 100000) { // Skip large items for localStorage
        return;
      }
      
      localStorage.setItem(cacheKey, serialized);
    } catch (error) {
      // localStorage full or unavailable
      console.warn('LocalStorage cache set failed:', error.message);
    }
  }

  getLocalStorageCache(key) {
    try {
      const cacheKey = `cache_${key}`;
      const cached = localStorage.getItem(cacheKey);
      
      if (!cached) return null;
      
      const cacheData = JSON.parse(cached);
      
      // Check expiration
      if (cacheData.expiresAt < Date.now()) {
        localStorage.removeItem(cacheKey);
        return null;
      }
      
      return cacheData.value;
    } catch (error) {
      console.warn('LocalStorage cache get failed:', error.message);
      return null;
    }
  }

  hasLocalStorageCache(key) {
    try {
      const cacheKey = `cache_${key}`;
      const cached = localStorage.getItem(cacheKey);
      
      if (!cached) return false;
      
      const cacheData = JSON.parse(cached);
      return cacheData.expiresAt >= Date.now();
    } catch (error) {
      return false;
    }
  }

  removeLocalStorageCache(key) {
    try {
      const cacheKey = `cache_${key}`;
      localStorage.removeItem(cacheKey);
    } catch (error) {
      console.warn('LocalStorage cache remove failed:', error.message);
    }
  }

  clearLocalStorageCache() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('cache_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('LocalStorage cache clear failed:', error.message);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;
    
    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      memoryUsage: this.formatBytes(this.currentMemoryUsage),
      memoryUsagePercent: `${(this.currentMemoryUsage / this.maxMemorySize * 100).toFixed(2)}%`,
      entryCount: this.memoryCache.size
    };
  }

  /**
   * Format bytes for display
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Destroy cache manager
   */
  destroy() {
    this.stopCleanupInterval();
    this.clear();
  }
}

/**
 * Specialized cache for user data
 */
class UserDataCache extends CacheManager {
  constructor() {
    super({
      maxMemorySize: 10 * 1024 * 1024, // 10MB for user data
      defaultTTL: 10 * 60 * 1000, // 10 minutes for user data
      cleanupInterval: 2 * 60 * 1000 // 2 minutes cleanup
    });
  }

  /**
   * Cache user profile with user-specific key
   */
  setUserProfile(userId, profile) {
    return this.set(`user_profile_${userId}`, profile, 15 * 60 * 1000); // 15 minutes
  }

  getUserProfile(userId) {
    return this.get(`user_profile_${userId}`);
  }

  /**
   * Cache user usage data
   */
  setUserUsage(userId, usage) {
    return this.set(`user_usage_${userId}`, usage, 5 * 60 * 1000); // 5 minutes
  }

  getUserUsage(userId) {
    return this.get(`user_usage_${userId}`);
  }

  /**
   * Cache user files list
   */
  setUserFiles(userId, files) {
    return this.set(`user_files_${userId}`, files, 10 * 60 * 1000); // 10 minutes
  }

  getUserFiles(userId) {
    return this.get(`user_files_${userId}`);
  }

  /**
   * Invalidate all user data
   */
  invalidateUser(userId) {
    const keysToRemove = [];
    for (const key of this.memoryCache.keys()) {
      if (key.includes(userId)) {
        keysToRemove.push(key.replace('cache_', ''));
      }
    }
    
    keysToRemove.forEach(key => this.remove(key));
  }
}

/**
 * Specialized cache for API responses
 */
class APICache extends CacheManager {
  constructor() {
    super({
      maxMemorySize: 20 * 1024 * 1024, // 20MB for API responses
      defaultTTL: 2 * 60 * 1000, // 2 minutes for API responses
      cleanupInterval: 30 * 1000 // 30 seconds cleanup
    });
  }

  /**
   * Cache API response with method and URL
   */
  setAPIResponse(method, url, params, response) {
    const key = this.generateAPIKey(method, url, params);
    return this.set(key, response, 5 * 60 * 1000); // 5 minutes for API responses
  }

  getAPIResponse(method, url, params) {
    const key = this.generateAPIKey(method, url, params);
    return this.get(key);
  }

  /**
   * Generate cache key for API request
   */
  generateAPIKey(method, url, params) {
    const paramString = params ? JSON.stringify(params) : '';
    return `api_${method}_${url}_${btoa(paramString).slice(0, 20)}`;
  }

  /**
   * Invalidate API cache by pattern
   */
  invalidateByPattern(pattern) {
    const keysToRemove = [];
    for (const key of this.memoryCache.keys()) {
      if (key.includes(pattern)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => this.remove(key));
  }
}

// Create global cache instances
if (typeof window !== 'undefined') {
  window.cacheManager = new CacheManager();
  window.userDataCache = new UserDataCache();
  window.apiCache = new APICache();
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    window.cacheManager?.destroy();
    window.userDataCache?.destroy();
    window.apiCache?.destroy();
  });
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CacheManager, UserDataCache, APICache };
}