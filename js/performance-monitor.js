/**
 * PerformanceMonitor - Real-time performance monitoring and optimization
 * Tracks Core Web Vitals, resource loading, and user interactions
 */

class PerformanceMonitor {
  constructor(options = {}) {
    this.config = {
      enableCoreWebVitals: options.enableCoreWebVitals !== false,
      enableResourceTiming: options.enableResourceTiming !== false,
      enableUserTiming: options.enableUserTiming !== false,
      enableMemoryMonitoring: options.enableMemoryMonitoring !== false,
      reportingEndpoint: options.reportingEndpoint || null,
      reportingInterval: options.reportingInterval || 30000, // 30 seconds
      thresholds: {
        lcp: 2500,    // Largest Contentful Paint
        fid: 100,     // First Input Delay
        cls: 0.1,     // Cumulative Layout Shift
        fcp: 1800,    // First Contentful Paint
        ttfb: 800     // Time to First Byte
      },
      ...options
    };

    this.metrics = {
      coreWebVitals: {},
      resourceTiming: [],
      userTiming: [],
      memoryUsage: [],
      customMetrics: new Map()
    };

    this.observers = [];
    this.isInitialized = false;

    this.initialize();
  }

  /**
   * Initialize performance monitoring
   */
  initialize() {
    if (this.isInitialized) return;

    try {
      // Initialize Core Web Vitals monitoring
      if (this.config.enableCoreWebVitals) {
        this.initializeCoreWebVitals();
      }

      // Initialize resource timing monitoring
      if (this.config.enableResourceTiming) {
        this.initializeResourceTiming();
      }

      // Initialize user timing monitoring
      if (this.config.enableUserTiming) {
        this.initializeUserTiming();
      }

      // Initialize memory monitoring
      if (this.config.enableMemoryMonitoring) {
        this.initializeMemoryMonitoring();
      }

      // Start periodic reporting
      if (this.config.reportingEndpoint) {
        this.startPeriodicReporting();
      }

      // Monitor page visibility changes
      this.initializeVisibilityMonitoring();

      this.isInitialized = true;
      console.log('PerformanceMonitor initialized');

    } catch (error) {
      console.error('PerformanceMonitor initialization failed:', error);
    }
  }

  /**
   * Initialize Core Web Vitals monitoring
   */
  initializeCoreWebVitals() {
    // Largest Contentful Paint (LCP)
    this.observeLCP();

    // First Input Delay (FID)
    this.observeFID();

    // Cumulative Layout Shift (CLS)
    this.observeCLS();

    // First Contentful Paint (FCP)
    this.observeFCP();

    // Time to First Byte (TTFB)
    this.observeTTFB();
  }

  /**
   * Observe Largest Contentful Paint
   */
  observeLCP() {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        
        this.metrics.coreWebVitals.lcp = {
          value: lastEntry.startTime,
          rating: this.getRating(lastEntry.startTime, this.config.thresholds.lcp),
          timestamp: Date.now()
        };

        this.reportMetric('lcp', this.metrics.coreWebVitals.lcp);
      });

      observer.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(observer);

    } catch (error) {
      console.warn('LCP observation failed:', error);
    }
  }

  /**
   * Observe First Input Delay
   */
  observeFID() {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          this.metrics.coreWebVitals.fid = {
            value: entry.processingStart - entry.startTime,
            rating: this.getRating(entry.processingStart - entry.startTime, this.config.thresholds.fid),
            timestamp: Date.now()
          };

          this.reportMetric('fid', this.metrics.coreWebVitals.fid);
        });
      });

      observer.observe({ entryTypes: ['first-input'] });
      this.observers.push(observer);

    } catch (error) {
      console.warn('FID observation failed:', error);
    }
  }

  /**
   * Observe Cumulative Layout Shift
   */
  observeCLS() {
    if (!('PerformanceObserver' in window)) return;

    try {
      let clsValue = 0;
      let sessionValue = 0;
      let sessionEntries = [];

      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        
        entries.forEach((entry) => {
          if (!entry.hadRecentInput) {
            const firstSessionEntry = sessionEntries[0];
            const lastSessionEntry = sessionEntries[sessionEntries.length - 1];

            if (sessionValue && 
                entry.startTime - lastSessionEntry.startTime < 1000 &&
                entry.startTime - firstSessionEntry.startTime < 5000) {
              sessionValue += entry.value;
              sessionEntries.push(entry);
            } else {
              sessionValue = entry.value;
              sessionEntries = [entry];
            }

            if (sessionValue > clsValue) {
              clsValue = sessionValue;
              
              this.metrics.coreWebVitals.cls = {
                value: clsValue,
                rating: this.getRating(clsValue, this.config.thresholds.cls),
                timestamp: Date.now()
              };

              this.reportMetric('cls', this.metrics.coreWebVitals.cls);
            }
          }
        });
      });

      observer.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(observer);

    } catch (error) {
      console.warn('CLS observation failed:', error);
    }
  }

  /**
   * Observe First Contentful Paint
   */
  observeFCP() {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.name === 'first-contentful-paint') {
            this.metrics.coreWebVitals.fcp = {
              value: entry.startTime,
              rating: this.getRating(entry.startTime, this.config.thresholds.fcp),
              timestamp: Date.now()
            };

            this.reportMetric('fcp', this.metrics.coreWebVitals.fcp);
          }
        });
      });

      observer.observe({ entryTypes: ['paint'] });
      this.observers.push(observer);

    } catch (error) {
      console.warn('FCP observation failed:', error);
    }
  }

  /**
   * Observe Time to First Byte
   */
  observeTTFB() {
    try {
      const navigationEntry = performance.getEntriesByType('navigation')[0];
      if (navigationEntry) {
        const ttfb = navigationEntry.responseStart - navigationEntry.requestStart;
        
        this.metrics.coreWebVitals.ttfb = {
          value: ttfb,
          rating: this.getRating(ttfb, this.config.thresholds.ttfb),
          timestamp: Date.now()
        };

        this.reportMetric('ttfb', this.metrics.coreWebVitals.ttfb);
      }
    } catch (error) {
      console.warn('TTFB observation failed:', error);
    }
  }

  /**
   * Initialize resource timing monitoring
   */
  initializeResourceTiming() {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const resourceData = {
            name: entry.name,
            type: this.getResourceType(entry),
            duration: entry.duration,
            size: entry.transferSize || 0,
            cached: entry.transferSize === 0 && entry.decodedBodySize > 0,
            timestamp: Date.now()
          };

          this.metrics.resourceTiming.push(resourceData);
          
          // Keep only last 100 entries to prevent memory issues
          if (this.metrics.resourceTiming.length > 100) {
            this.metrics.resourceTiming.shift();
          }
        });
      });

      observer.observe({ entryTypes: ['resource'] });
      this.observers.push(observer);

    } catch (error) {
      console.warn('Resource timing observation failed:', error);
    }
  }

  /**
   * Initialize user timing monitoring
   */
  initializeUserTiming() {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const timingData = {
            name: entry.name,
            type: entry.entryType,
            duration: entry.duration || 0,
            startTime: entry.startTime,
            timestamp: Date.now()
          };

          this.metrics.userTiming.push(timingData);
          
          // Keep only last 50 entries
          if (this.metrics.userTiming.length > 50) {
            this.metrics.userTiming.shift();
          }
        });
      });

      observer.observe({ entryTypes: ['measure', 'mark'] });
      this.observers.push(observer);

    } catch (error) {
      console.warn('User timing observation failed:', error);
    }
  }

  /**
   * Initialize memory monitoring
   */
  initializeMemoryMonitoring() {
    if (!('memory' in performance)) return;

    const monitorMemory = () => {
      try {
        const memInfo = performance.memory;
        const memoryData = {
          usedJSHeapSize: memInfo.usedJSHeapSize,
          totalJSHeapSize: memInfo.totalJSHeapSize,
          jsHeapSizeLimit: memInfo.jsHeapSizeLimit,
          timestamp: Date.now()
        };

        this.metrics.memoryUsage.push(memoryData);
        
        // Keep only last 20 entries (10 minutes at 30s intervals)
        if (this.metrics.memoryUsage.length > 20) {
          this.metrics.memoryUsage.shift();
        }

        // Check for memory pressure
        const usagePercent = (memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit) * 100;
        if (usagePercent > 80) {
          console.warn(`High memory usage: ${usagePercent.toFixed(2)}%`);
          this.reportMetric('memory_pressure', { usage: usagePercent, timestamp: Date.now() });
        }

      } catch (error) {
        console.warn('Memory monitoring failed:', error);
      }
    };

    // Monitor memory every 30 seconds
    setInterval(monitorMemory, 30000);
    monitorMemory(); // Initial measurement
  }

  /**
   * Initialize page visibility monitoring
   */
  initializeVisibilityMonitoring() {
    let visibilityStart = Date.now();
    let totalVisibleTime = 0;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        totalVisibleTime += Date.now() - visibilityStart;
        this.reportMetric('page_hidden', { totalVisibleTime, timestamp: Date.now() });
      } else {
        visibilityStart = Date.now();
        this.reportMetric('page_visible', { timestamp: Date.now() });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Report total visible time on page unload
    window.addEventListener('beforeunload', () => {
      if (!document.hidden) {
        totalVisibleTime += Date.now() - visibilityStart;
      }
      this.reportMetric('page_unload', { totalVisibleTime, timestamp: Date.now() });
    });
  }

  /**
   * Start periodic reporting
   */
  startPeriodicReporting() {
    setInterval(() => {
      this.sendReport();
    }, this.config.reportingInterval);
  }

  /**
   * Get performance rating (good, needs-improvement, poor)
   */
  getRating(value, threshold) {
    if (value <= threshold) return 'good';
    if (value <= threshold * 1.5) return 'needs-improvement';
    return 'poor';
  }

  /**
   * Get resource type from performance entry
   */
  getResourceType(entry) {
    if (entry.initiatorType) return entry.initiatorType;
    
    const url = entry.name;
    if (url.match(/\.(css)$/i)) return 'css';
    if (url.match(/\.(js)$/i)) return 'script';
    if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) return 'img';
    if (url.match(/\.(woff|woff2|ttf|eot)$/i)) return 'font';
    
    return 'other';
  }

  /**
   * Mark custom timing
   */
  mark(name) {
    try {
      performance.mark(name);
    } catch (error) {
      console.warn('Performance mark failed:', error);
    }
  }

  /**
   * Measure custom timing
   */
  measure(name, startMark, endMark) {
    try {
      performance.measure(name, startMark, endMark);
    } catch (error) {
      console.warn('Performance measure failed:', error);
    }
  }

  /**
   * Record custom metric
   */
  recordCustomMetric(name, value, metadata = {}) {
    this.metrics.customMetrics.set(name, {
      value,
      metadata,
      timestamp: Date.now()
    });

    this.reportMetric(`custom_${name}`, { value, metadata, timestamp: Date.now() });
  }

  /**
   * Report individual metric
   */
  reportMetric(name, data) {
    // Dispatch custom event for local handling
    const event = new CustomEvent('performanceMetric', {
      detail: { name, data }
    });
    document.dispatchEvent(event);

    // Log to console in development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log(`Performance metric [${name}]:`, data);
    }
  }

  /**
   * Send performance report
   */
  async sendReport() {
    if (!this.config.reportingEndpoint) return;

    try {
      const report = {
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
        metrics: {
          coreWebVitals: this.metrics.coreWebVitals,
          resourceTiming: this.metrics.resourceTiming.slice(-10), // Last 10 resources
          memoryUsage: this.metrics.memoryUsage.slice(-5), // Last 5 memory readings
          customMetrics: Object.fromEntries(this.metrics.customMetrics)
        }
      };

      await fetch(this.config.reportingEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(report)
      });

    } catch (error) {
      console.warn('Performance report failed:', error);
    }
  }

  /**
   * Get current performance summary
   */
  getSummary() {
    return {
      coreWebVitals: this.metrics.coreWebVitals,
      resourceCount: this.metrics.resourceTiming.length,
      memoryUsage: this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1],
      customMetrics: Object.fromEntries(this.metrics.customMetrics),
      timestamp: Date.now()
    };
  }

  /**
   * Get performance recommendations
   */
  getRecommendations() {
    const recommendations = [];
    const cwv = this.metrics.coreWebVitals;

    // LCP recommendations
    if (cwv.lcp && cwv.lcp.rating === 'poor') {
      recommendations.push({
        metric: 'LCP',
        issue: 'Slow largest contentful paint',
        suggestions: [
          'Optimize images and use modern formats (WebP, AVIF)',
          'Implement lazy loading for below-the-fold content',
          'Use a CDN for faster asset delivery',
          'Minimize render-blocking resources'
        ]
      });
    }

    // FID recommendations
    if (cwv.fid && cwv.fid.rating === 'poor') {
      recommendations.push({
        metric: 'FID',
        issue: 'Slow first input delay',
        suggestions: [
          'Reduce JavaScript execution time',
          'Split large bundles and load code on demand',
          'Use web workers for heavy computations',
          'Minimize main thread blocking'
        ]
      });
    }

    // CLS recommendations
    if (cwv.cls && cwv.cls.rating === 'poor') {
      recommendations.push({
        metric: 'CLS',
        issue: 'High cumulative layout shift',
        suggestions: [
          'Set explicit dimensions for images and videos',
          'Reserve space for dynamic content',
          'Avoid inserting content above existing content',
          'Use CSS transforms instead of changing layout properties'
        ]
      });
    }

    // Memory recommendations
    const latestMemory = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
    if (latestMemory) {
      const usagePercent = (latestMemory.usedJSHeapSize / latestMemory.jsHeapSizeLimit) * 100;
      if (usagePercent > 70) {
        recommendations.push({
          metric: 'Memory',
          issue: 'High memory usage',
          suggestions: [
            'Review and optimize memory-intensive operations',
            'Implement proper cleanup for event listeners',
            'Use object pooling for frequently created objects',
            'Consider lazy loading for large datasets'
          ]
        });
      }
    }

    return recommendations;
  }

  /**
   * Destroy performance monitor
   */
  destroy() {
    // Disconnect all observers
    this.observers.forEach(observer => {
      try {
        observer.disconnect();
      } catch (error) {
        console.warn('Error disconnecting observer:', error);
      }
    });

    this.observers = [];
    this.isInitialized = false;
  }
}

// Create global performance monitor instance
if (typeof window !== 'undefined') {
  window.performanceMonitor = new PerformanceMonitor({
    enableCoreWebVitals: true,
    enableResourceTiming: true,
    enableMemoryMonitoring: true,
    reportingInterval: 60000 // Report every minute
  });

  // Add performance monitoring to dashboard if available
  window.addEventListener('load', () => {
    if (window.performanceMonitor) {
      window.performanceMonitor.mark('app-loaded');
      
      // Record initial load metrics
      setTimeout(() => {
        const summary = window.performanceMonitor.getSummary();
        console.log('Performance Summary:', summary);
        
        // Show recommendations in development
        if (window.location.hostname === 'localhost') {
          const recommendations = window.performanceMonitor.getRecommendations();
          if (recommendations.length > 0) {
            console.group('Performance Recommendations:');
            recommendations.forEach(rec => {
              console.warn(`${rec.metric}: ${rec.issue}`);
              rec.suggestions.forEach(suggestion => console.log(`  • ${suggestion}`));
            });
            console.groupEnd();
          }
        }
      }, 1000);
    }
  });
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PerformanceMonitor;
}