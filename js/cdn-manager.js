/**
 * CDNManager - Intelligent CDN integration for static assets
 * Implements fallback strategies and performance optimization
 */

class CDNManager {
  constructor(options = {}) {
    this.cdnConfig = {
      primary: options.primaryCDN || 'https://cdn.jsdelivr.net',
      fallback: options.fallbackCDN || 'https://unpkg.com',
      local: options.localPath || '/assets',
      timeout: options.timeout || 5000,
      retryAttempts: options.retryAttempts || 2
    };
    
    // Asset registry with CDN URLs and fallbacks
    this.assetRegistry = new Map();
    this.loadedAssets = new Set();
    this.failedAssets = new Set();
    
    // Performance tracking
    this.loadTimes = new Map();
    this.stats = {
      cdnHits: 0,
      fallbackHits: 0,
      localHits: 0,
      failures: 0,
      totalLoadTime: 0
    };
    
    // Initialize common assets
    this.initializeCommonAssets();
    
    console.log('CDNManager initialized with primary CDN:', this.cdnConfig.primary);
  }

  /**
   * Initialize common CDN assets
   */
  initializeCommonAssets() {
    // Chart.js
    this.registerAsset('chart.js', {
      primary: `${this.cdnConfig.primary}/npm/chart.js@3.9.1/dist/chart.min.js`,
      fallback: `${this.cdnConfig.fallback}/chart.js@3.9.1/dist/chart.min.js`,
      local: `${this.cdnConfig.local}/js/chart.min.js`,
      integrity: 'sha384-ElbeLCLf3RdHbigniEjpSjSQZn9IEgVb8YyFQihs+ccvl5mjkwblBulsX2J3QP0B'
    });

    // Font Awesome
    this.registerAsset('fontawesome', {
      primary: `${this.cdnConfig.primary}/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css`,
      fallback: `${this.cdnConfig.fallback}/@fortawesome/fontawesome-free@6.4.0/css/all.min.css`,
      local: `${this.cdnConfig.local}/css/fontawesome.min.css`,
      integrity: 'sha384-iw3OoTErCYJJB9mCa8LNS2hbsQ7M3C0EJPGf+HU7Pqk7KJK8cJK8cJK8cJK8cJK8'
    });

    // PDF.js
    this.registerAsset('pdf.js', {
      primary: `${this.cdnConfig.primary}/npm/pdfjs-dist@3.11.174/build/pdf.min.js`,
      fallback: `${this.cdnConfig.fallback}/pdfjs-dist@3.11.174/build/pdf.min.js`,
      local: `${this.cdnConfig.local}/js/pdf.min.js`
    });

    // PDF.js Worker
    this.registerAsset('pdf.worker.js', {
      primary: `${this.cdnConfig.primary}/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js`,
      fallback: `${this.cdnConfig.fallback}/pdfjs-dist@3.11.174/build/pdf.worker.min.js`,
      local: `${this.cdnConfig.local}/js/pdf.worker.min.js`
    });

    // JSZip for file compression
    this.registerAsset('jszip', {
      primary: `${this.cdnConfig.primary}/npm/jszip@3.10.1/dist/jszip.min.js`,
      fallback: `${this.cdnConfig.fallback}/jszip@3.10.1/dist/jszip.min.js`,
      local: `${this.cdnConfig.local}/js/jszip.min.js`
    });

    // QR Code generator
    this.registerAsset('qrcode', {
      primary: `${this.cdnConfig.primary}/npm/qrcode@1.5.3/build/qrcode.min.js`,
      fallback: `${this.cdnConfig.fallback}/qrcode@1.5.3/build/qrcode.min.js`,
      local: `${this.cdnConfig.local}/js/qrcode.min.js`
    });

    // Tesseract.js for OCR
    this.registerAsset('tesseract', {
      primary: `${this.cdnConfig.primary}/npm/tesseract.js@4.1.1/dist/tesseract.min.js`,
      fallback: `${this.cdnConfig.fallback}/tesseract.js@4.1.1/dist/tesseract.min.js`,
      local: `${this.cdnConfig.local}/js/tesseract.min.js`
    });
  }

  /**
   * Register an asset with CDN URLs and fallbacks
   */
  registerAsset(name, config) {
    this.assetRegistry.set(name, {
      primary: config.primary,
      fallback: config.fallback,
      local: config.local,
      integrity: config.integrity,
      type: config.type || this.detectAssetType(config.primary),
      retryCount: 0,
      lastAttempt: null
    });

    return this;
  }

  /**
   * Detect asset type from URL
   */
  detectAssetType(url) {
    if (url.endsWith('.css')) return 'css';
    if (url.endsWith('.js')) return 'js';
    if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) return 'image';
    if (url.match(/\.(woff|woff2|ttf|eot)$/i)) return 'font';
    return 'unknown';
  }

  /**
   * Load asset with CDN fallback strategy
   */
  async loadAsset(name, options = {}) {
    const config = this.assetRegistry.get(name);
    if (!config) {
      throw new Error(`Asset '${name}' not registered`);
    }

    // Check if already loaded
    if (this.loadedAssets.has(name)) {
      console.log(`Asset '${name}' already loaded`);
      return true;
    }

    // Check if previously failed and within retry limit
    if (this.failedAssets.has(name) && config.retryCount >= this.cdnConfig.retryAttempts) {
      throw new Error(`Asset '${name}' failed to load after ${this.cdnConfig.retryAttempts} attempts`);
    }

    const startTime = performance.now();
    
    try {
      // Try primary CDN first
      await this.loadFromURL(config.primary, config, options);
      this.stats.cdnHits++;
      console.log(`Loaded '${name}' from primary CDN`);
      
    } catch (primaryError) {
      console.warn(`Primary CDN failed for '${name}':`, primaryError.message);
      
      try {
        // Try fallback CDN
        await this.loadFromURL(config.fallback, config, options);
        this.stats.fallbackHits++;
        console.log(`Loaded '${name}' from fallback CDN`);
        
      } catch (fallbackError) {
        console.warn(`Fallback CDN failed for '${name}':`, fallbackError.message);
        
        try {
          // Try local fallback
          await this.loadFromURL(config.local, config, options);
          this.stats.localHits++;
          console.log(`Loaded '${name}' from local fallback`);
          
        } catch (localError) {
          console.error(`All sources failed for '${name}':`, localError.message);
          config.retryCount++;
          this.failedAssets.add(name);
          this.stats.failures++;
          throw new Error(`Failed to load asset '${name}' from all sources`);
        }
      }
    }

    // Mark as loaded and track performance
    this.loadedAssets.add(name);
    this.failedAssets.delete(name);
    
    const loadTime = performance.now() - startTime;
    this.loadTimes.set(name, loadTime);
    this.stats.totalLoadTime += loadTime;
    
    return true;
  }

  /**
   * Load asset from specific URL
   */
  loadFromURL(url, config, options) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Load timeout for ${url}`));
      }, options.timeout || this.cdnConfig.timeout);

      if (config.type === 'css') {
        this.loadCSS(url, config, resolve, reject, timeout);
      } else if (config.type === 'js') {
        this.loadJS(url, config, resolve, reject, timeout);
      } else if (config.type === 'image') {
        this.loadImage(url, config, resolve, reject, timeout);
      } else {
        // Generic fetch for other types
        this.loadGeneric(url, config, resolve, reject, timeout);
      }
    });
  }

  /**
   * Load CSS file
   */
  loadCSS(url, config, resolve, reject, timeout) {
    // Check if already loaded
    if (document.querySelector(`link[href="${url}"]`)) {
      clearTimeout(timeout);
      resolve();
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    
    if (config.integrity) {
      link.integrity = config.integrity;
      link.crossOrigin = 'anonymous';
    }

    link.onload = () => {
      clearTimeout(timeout);
      resolve();
    };

    link.onerror = () => {
      clearTimeout(timeout);
      document.head.removeChild(link);
      reject(new Error(`Failed to load CSS: ${url}`));
    };

    document.head.appendChild(link);
  }

  /**
   * Load JavaScript file
   */
  loadJS(url, config, resolve, reject, timeout) {
    // Check if already loaded
    if (document.querySelector(`script[src="${url}"]`)) {
      clearTimeout(timeout);
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    
    if (config.integrity) {
      script.integrity = config.integrity;
      script.crossOrigin = 'anonymous';
    }

    script.onload = () => {
      clearTimeout(timeout);
      resolve();
    };

    script.onerror = () => {
      clearTimeout(timeout);
      document.head.removeChild(script);
      reject(new Error(`Failed to load JS: ${url}`));
    };

    document.head.appendChild(script);
  }

  /**
   * Load image
   */
  loadImage(url, config, resolve, reject, timeout) {
    const img = new Image();
    
    img.onload = () => {
      clearTimeout(timeout);
      resolve();
    };

    img.onerror = () => {
      clearTimeout(timeout);
      reject(new Error(`Failed to load image: ${url}`));
    };

    img.src = url;
  }

  /**
   * Load generic resource
   */
  loadGeneric(url, config, resolve, reject, timeout) {
    fetch(url, {
      method: 'GET',
      cache: 'default'
    })
    .then(response => {
      clearTimeout(timeout);
      if (response.ok) {
        resolve();
      } else {
        reject(new Error(`HTTP ${response.status}: ${response.statusText}`));
      }
    })
    .catch(error => {
      clearTimeout(timeout);
      reject(error);
    });
  }

  /**
   * Load multiple assets in parallel
   */
  async loadAssets(assetNames, options = {}) {
    const loadPromises = assetNames.map(name => 
      this.loadAsset(name, options).catch(error => {
        console.error(`Failed to load asset '${name}':`, error);
        return { name, error };
      })
    );

    const results = await Promise.allSettled(loadPromises);
    
    const successful = results.filter(result => result.status === 'fulfilled' && !result.value.error);
    const failed = results.filter(result => result.status === 'rejected' || result.value?.error);

    return {
      successful: successful.length,
      failed: failed.length,
      total: assetNames.length,
      errors: failed.map(f => f.reason || f.value?.error)
    };
  }

  /**
   * Preload critical assets
   */
  async preloadCriticalAssets() {
    const criticalAssets = ['fontawesome']; // Add more as needed
    
    try {
      const results = await this.loadAssets(criticalAssets, { timeout: 3000 });
      console.log(`Preloaded ${results.successful}/${results.total} critical assets`);
      return results;
    } catch (error) {
      console.error('Critical asset preload failed:', error);
      throw error;
    }
  }

  /**
   * Get asset URL with fallback logic
   */
  getAssetURL(name, preferLocal = false) {
    const config = this.assetRegistry.get(name);
    if (!config) {
      console.warn(`Asset '${name}' not registered`);
      return null;
    }

    // If asset failed to load from CDN, use local
    if (this.failedAssets.has(name) || preferLocal) {
      return config.local;
    }

    // Use primary CDN by default
    return config.primary;
  }

  /**
   * Check if asset is loaded
   */
  isAssetLoaded(name) {
    return this.loadedAssets.has(name);
  }

  /**
   * Get loading statistics
   */
  getStats() {
    const totalAttempts = this.stats.cdnHits + this.stats.fallbackHits + this.stats.localHits + this.stats.failures;
    const successRate = totalAttempts > 0 ? ((totalAttempts - this.stats.failures) / totalAttempts * 100).toFixed(2) : 0;
    const avgLoadTime = this.loadedAssets.size > 0 ? (this.stats.totalLoadTime / this.loadedAssets.size).toFixed(2) : 0;

    return {
      ...this.stats,
      totalAttempts,
      successRate: `${successRate}%`,
      averageLoadTime: `${avgLoadTime}ms`,
      loadedAssets: this.loadedAssets.size,
      failedAssets: this.failedAssets.size,
      registeredAssets: this.assetRegistry.size
    };
  }

  /**
   * Clear failed assets to allow retry
   */
  clearFailedAssets() {
    this.failedAssets.clear();
    
    // Reset retry counts
    for (const [name, config] of this.assetRegistry.entries()) {
      config.retryCount = 0;
    }
    
    console.log('Cleared failed assets, retry attempts reset');
  }

  /**
   * Test CDN connectivity
   */
  async testCDNConnectivity() {
    const testResults = {
      primary: false,
      fallback: false,
      local: false
    };

    // Test primary CDN
    try {
      const response = await fetch(`${this.cdnConfig.primary}/npm/lodash@4.17.21/package.json`, {
        method: 'HEAD',
        cache: 'no-cache'
      });
      testResults.primary = response.ok;
    } catch (error) {
      console.warn('Primary CDN test failed:', error.message);
    }

    // Test fallback CDN
    try {
      const response = await fetch(`${this.cdnConfig.fallback}/lodash@4.17.21/package.json`, {
        method: 'HEAD',
        cache: 'no-cache'
      });
      testResults.fallback = response.ok;
    } catch (error) {
      console.warn('Fallback CDN test failed:', error.message);
    }

    // Test local assets (check if local server is running)
    try {
      const response = await fetch(`${this.cdnConfig.local}/test`, {
        method: 'HEAD',
        cache: 'no-cache'
      });
      testResults.local = response.status !== 404; // 404 is expected, but server should respond
    } catch (error) {
      // Local server might not be running, which is normal
      testResults.local = false;
    }

    console.log('CDN connectivity test results:', testResults);
    return testResults;
  }

  /**
   * Optimize asset loading based on connection
   */
  async optimizeForConnection() {
    if ('connection' in navigator) {
      const connection = navigator.connection;
      const effectiveType = connection.effectiveType;
      
      console.log('Connection type:', effectiveType);
      
      // Adjust timeout based on connection speed
      if (effectiveType === 'slow-2g' || effectiveType === '2g') {
        this.cdnConfig.timeout = 15000; // 15 seconds for slow connections
      } else if (effectiveType === '3g') {
        this.cdnConfig.timeout = 10000; // 10 seconds for 3G
      } else {
        this.cdnConfig.timeout = 5000; // 5 seconds for fast connections
      }
      
      // Prefer local assets on slow connections
      if (effectiveType === 'slow-2g' || effectiveType === '2g') {
        console.log('Slow connection detected, preferring local assets');
        return true; // Prefer local
      }
    }
    
    return false; // Use CDN
  }

  /**
   * Create asset preload links
   */
  createPreloadLinks(assetNames) {
    assetNames.forEach(name => {
      const config = this.assetRegistry.get(name);
      if (!config) return;

      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = config.primary;
      
      if (config.type === 'css') {
        link.as = 'style';
      } else if (config.type === 'js') {
        link.as = 'script';
      } else if (config.type === 'font') {
        link.as = 'font';
        link.crossOrigin = 'anonymous';
      }
      
      if (config.integrity) {
        link.integrity = config.integrity;
        link.crossOrigin = 'anonymous';
      }

      document.head.appendChild(link);
    });
  }
}

// Create global CDN manager instance
if (typeof window !== 'undefined') {
  window.cdnManager = new CDNManager();
  
  // Test connectivity and optimize on load
  window.addEventListener('load', async () => {
    try {
      const preferLocal = await window.cdnManager.optimizeForConnection();
      await window.cdnManager.testCDNConnectivity();
      
      // Preload critical assets
      await window.cdnManager.preloadCriticalAssets();
      
    } catch (error) {
      console.warn('CDN optimization failed:', error);
    }
  });
  
  // Handle online/offline events
  window.addEventListener('online', () => {
    window.cdnManager.clearFailedAssets();
    console.log('Connection restored, cleared failed assets');
  });
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CDNManager;
}