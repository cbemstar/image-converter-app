/**
 * Performance Integration - Orchestrates all performance optimizations
 * Coordinates caching, lazy loading, CDN, and monitoring systems
 */

class PerformanceIntegration {
  constructor() {
    this.isInitialized = false;
    this.optimizations = {
      caching: false,
      lazyLoading: false,
      cdn: false,
      serviceWorker: false,
      monitoring: false
    };
    
    this.initialize();
  }

  /**
   * Initialize all performance optimizations
   */
  async initialize() {
    if (this.isInitialized) return;

    console.log('Initializing performance optimizations...');

    try {
      // Initialize in order of priority
      await this.initializeCaching();
      await this.initializeCDN();
      await this.initializeServiceWorker();
      await this.initializeLazyLoading();
      await this.initializeMonitoring();

      this.isInitialized = true;
      this.reportInitializationStatus();

    } catch (error) {
      console.error('Performance integration initialization failed:', error);
    }
  }

  /**
   * Initialize caching systems
   */
  async initializeCaching() {
    try {
      // Cache managers should already be initialized globally
      if (window.cacheManager && window.userDataCache && window.apiCache) {
        this.optimizations.caching = true;
        console.log('✓ Caching systems initialized');

        // Set up cache warming for critical data
        this.warmCriticalCaches();
      } else {
        console.warn('Cache managers not available');
      }
    } catch (error) {
      console.error('Caching initialization failed:', error);
    }
  }

  /**
   * Initialize CDN management
   */
  async initializeCDN() {
    try {
      if (window.cdnManager) {
        // Test CDN connectivity
        await window.cdnManager.testCDNConnectivity();
        
        // Optimize for current connection
        await window.cdnManager.optimizeForConnection();
        
        // Preload critical assets
        await window.cdnManager.preloadCriticalAssets();
        
        this.optimizations.cdn = true;
        console.log('✓ CDN management initialized');
      } else {
        console.warn('CDN manager not available');
      }
    } catch (error) {
      console.error('CDN initialization failed:', error);
    }
  }

  /**
   * Initialize service worker
   */
  async initializeServiceWorker() {
    try {
      if (window.swManager) {
        // Service worker should already be registering
        this.optimizations.serviceWorker = true;
        console.log('✓ Service worker initialized');
      } else {
        console.warn('Service worker manager not available');
      }
    } catch (error) {
      console.error('Service worker initialization failed:', error);
    }
  }

  /**
   * Initialize lazy loading
   */
  async initializeLazyLoading() {
    try {
      if (window.lazyLoader) {
        // Preload high priority components
        window.lazyLoader.preloadHighPriority();
        
        this.optimizations.lazyLoading = true;
        console.log('✓ Lazy loading initialized');
      } else {
        console.warn('Lazy loader not available');
      }
    } catch (error) {
      console.error('Lazy loading initialization failed:', error);
    }
  }

  /**
   * Initialize performance monitoring
   */
  async initializeMonitoring() {
    try {
      if (window.performanceMonitor) {
        // Performance monitor should already be running
        this.optimizations.monitoring = true;
        console.log('✓ Performance monitoring initialized');

        // Set up custom metrics for our optimizations
        this.setupCustomMetrics();
      } else {
        console.warn('Performance monitor not available');
      }
    } catch (error) {
      console.error('Performance monitoring initialization failed:', error);
    }
  }

  /**
   * Warm critical caches with frequently accessed data
   */
  async warmCriticalCaches() {
    try {
      // Warm user data cache if user is authenticated
      if (window.authManager?.isAuthenticated()) {
        const user = window.authManager.getCurrentUser();
        
        // Pre-cache user profile
        if (window.profileManager && window.userDataCache) {
          const profile = await window.profileManager.loadUserProfile();
          if (profile) {
            window.userDataCache.setUserProfile(user.id, profile);
          }
        }

        // Pre-cache usage data
        if (window.quotaManager && window.userDataCache) {
          const usage = window.quotaManager.getCurrentUsage();
          if (usage) {
            window.userDataCache.setUserUsage(user.id, usage);
          }
        }
      }

      console.log('Critical caches warmed');
    } catch (error) {
      console.error('Cache warming failed:', error);
    }
  }

  /**
   * Set up custom performance metrics
   */
  setupCustomMetrics() {
    if (!window.performanceMonitor) return;

    // Track cache hit rates
    if (window.cacheManager) {
      const cacheStats = window.cacheManager.getStats();
      window.performanceMonitor.recordCustomMetric('cache_hit_rate', cacheStats.hitRate);
    }

    // Track lazy loading performance
    if (window.lazyLoader) {
      const lazyStats = window.lazyLoader.getStats();
      window.performanceMonitor.recordCustomMetric('lazy_load_success_rate', lazyStats.successRate);
    }

    // Track CDN performance
    if (window.cdnManager) {
      const cdnStats = window.cdnManager.getStats();
      window.performanceMonitor.recordCustomMetric('cdn_success_rate', cdnStats.successRate);
    }
  }

  /**
   * Report initialization status
   */
  reportInitializationStatus() {
    const enabledCount = Object.values(this.optimizations).filter(Boolean).length;
    const totalCount = Object.keys(this.optimizations).length;
    
    console.log(`Performance optimizations: ${enabledCount}/${totalCount} enabled`);
    console.table(this.optimizations);

    // Record initialization metric
    if (window.performanceMonitor) {
      window.performanceMonitor.recordCustomMetric('performance_optimizations_enabled', enabledCount);
    }
  }

  /**
   * Get optimization status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      optimizations: { ...this.optimizations },
      stats: this.getPerformanceStats()
    };
  }

  /**
   * Get performance statistics from all systems
   */
  getPerformanceStats() {
    const stats = {};

    if (window.cacheManager) {
      stats.cache = window.cacheManager.getStats();
    }

    if (window.userDataCache) {
      stats.userCache = window.userDataCache.getStats();
    }

    if (window.apiCache) {
      stats.apiCache = window.apiCache.getStats();
    }

    if (window.lazyLoader) {
      stats.lazyLoading = window.lazyLoader.getStats();
    }

    if (window.cdnManager) {
      stats.cdn = window.cdnManager.getStats();
    }

    if (window.performanceMonitor) {
      stats.monitoring = window.performanceMonitor.getSummary();
    }

    return stats;
  }

  /**
   * Optimize for current page type
   */
  optimizeForPage(pageType) {
    switch (pageType) {
      case 'dashboard':
        this.optimizeForDashboard();
        break;
      case 'tool':
        this.optimizeForTool();
        break;
      case 'auth':
        this.optimizeForAuth();
        break;
      default:
        this.optimizeForGeneral();
    }
  }

  /**
   * Dashboard-specific optimizations
   */
  optimizeForDashboard() {
    // Preload dashboard-specific assets
    if (window.cdnManager) {
      window.cdnManager.loadAssets(['chart.js'], { priority: 'high' });
    }

    // Warm dashboard caches
    if (window.userDataCache && window.authManager?.isAuthenticated()) {
      const user = window.authManager.getCurrentUser();
      
      // Pre-cache file list
      if (window.fileManager) {
        window.fileManager.listUserFiles().then(files => {
          window.userDataCache.setUserFiles(user.id, files);
        });
      }
    }

    // Enable aggressive lazy loading for dashboard components
    if (window.lazyLoader) {
      window.lazyLoader.preloadHighPriority();
    }
  }

  /**
   * Tool-specific optimizations
   */
  optimizeForTool() {
    // Load tool-specific CDN assets based on current tool
    const toolName = this.getCurrentToolName();
    
    if (window.cdnManager) {
      switch (toolName) {
        case 'pdf-merger':
        case 'pdf-ocr':
          window.cdnManager.loadAsset('pdf.js');
          break;
        case 'qr-generator':
          window.cdnManager.loadAsset('qrcode');
          break;
        case 'background-remover':
          window.cdnManager.loadAsset('tesseract');
          break;
      }
    }

    // Optimize caching for tool operations
    if (window.apiCache) {
      // Increase cache TTL for tool operations
      window.apiCache.defaultTTL = 10 * 60 * 1000; // 10 minutes
    }
  }

  /**
   * Auth page optimizations
   */
  optimizeForAuth() {
    // Minimal optimizations for auth pages
    // Focus on fast loading and security
    
    if (window.cacheManager) {
      // Reduce cache size for auth pages
      window.cacheManager.maxMemorySize = 10 * 1024 * 1024; // 10MB
    }
  }

  /**
   * General page optimizations
   */
  optimizeForGeneral() {
    // Standard optimizations for all pages
    
    // Enable all caching systems
    if (window.cacheManager) {
      window.cacheManager.cleanup();
    }

    // Load common assets
    if (window.cdnManager) {
      window.cdnManager.loadAsset('fontawesome');
    }
  }

  /**
   * Get current tool name from URL
   */
  getCurrentToolName() {
    const path = window.location.pathname;
    const match = path.match(/\/tools\/([^\/]+)/);
    return match ? match[1] : null;
  }

  /**
   * Handle performance degradation
   */
  handlePerformanceDegradation() {
    console.warn('Performance degradation detected, applying mitigations...');

    // Reduce cache sizes
    if (window.cacheManager) {
      window.cacheManager.maxMemorySize = Math.floor(window.cacheManager.maxMemorySize * 0.7);
      window.cacheManager.cleanup();
    }

    // Disable non-critical lazy loading
    if (window.lazyLoader) {
      // Only load high priority components
      const highPriorityElements = document.querySelectorAll('[data-lazy-priority="high"]');
      highPriorityElements.forEach(el => {
        if (window.lazyLoader.observer) {
          window.lazyLoader.observer.unobserve(el);
        }
      });
    }

    // Switch to local assets if CDN is slow
    if (window.cdnManager) {
      window.cdnManager.clearFailedAssets();
    }

    // Record degradation event
    if (window.performanceMonitor) {
      window.performanceMonitor.recordCustomMetric('performance_degradation', 1, {
        timestamp: Date.now(),
        url: window.location.href
      });
    }
  }

  /**
   * Monitor and auto-optimize performance
   */
  startAutoOptimization() {
    // Monitor performance metrics and auto-adjust
    setInterval(() => {
      this.checkAndOptimize();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Check performance and apply optimizations
   */
  checkAndOptimize() {
    if (!window.performanceMonitor) return;

    const summary = window.performanceMonitor.getSummary();
    
    // Check memory usage
    if (summary.memoryUsage) {
      const memoryPercent = (summary.memoryUsage.usedJSHeapSize / summary.memoryUsage.jsHeapSizeLimit) * 100;
      
      if (memoryPercent > 80) {
        this.handlePerformanceDegradation();
      }
    }

    // Check Core Web Vitals
    const cwv = summary.coreWebVitals;
    if (cwv.lcp && cwv.lcp.rating === 'poor') {
      // Optimize for LCP
      if (window.lazyLoader) {
        window.lazyLoader.loadAllVisible();
      }
    }

    if (cwv.cls && cwv.cls.rating === 'poor') {
      // Optimize for CLS
      console.warn('High CLS detected, check for layout shifts');
    }
  }
}

// Initialize performance integration when DOM is ready
if (typeof window !== 'undefined') {
  let performanceIntegration;

  const initializePerformance = () => {
    if (!performanceIntegration) {
      performanceIntegration = new PerformanceIntegration();
      window.performanceIntegration = performanceIntegration;

      // Optimize for current page
      const pageType = window.location.pathname.includes('/dashboard') ? 'dashboard' :
                      window.location.pathname.includes('/tools/') ? 'tool' :
                      window.location.pathname.includes('/auth') ? 'auth' : 'general';
      
      performanceIntegration.optimizeForPage(pageType);

      // Start auto-optimization
      performanceIntegration.startAutoOptimization();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePerformance);
  } else {
    initializePerformance();
  }

  // Handle page visibility changes for performance optimization
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Page is hidden, reduce resource usage
      if (window.cacheManager) {
        window.cacheManager.cleanup();
      }
    } else {
      // Page is visible, resume optimizations
      if (performanceIntegration) {
        performanceIntegration.warmCriticalCaches();
      }
    }
  });
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PerformanceIntegration;
}