/**
 * Integration module for connecting monitoring system with existing components
 * Implements requirement 17.1: Structured logging for all system components
 * Implements requirement 17.7: Track webhook success rate, latency, and quota write failures
 */

// Import modules based on environment
let metricsCollector, createLogger, logAggregator;
if (typeof require !== 'undefined') {
  ({ metricsCollector } = require('./metrics-collector.js'));
  ({ createLogger } = require('./logger.js'));
  ({ logAggregator } = require('./log-aggregator.js'));
} else {
  metricsCollector = window.metricsCollector;
  createLogger = window.createLogger;
  logAggregator = window.logAggregator;
}

class MonitoringIntegration {
  constructor() {
    this.logger = createLogger('monitoring-integration');
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) {
      return;
    }

    this.setupConversionMonitoring();
    this.setupAuthMonitoring();
    this.setupBillingMonitoring();
    this.setupWebhookMonitoring();
    this.setupQuotaMonitoring();
    this.setupErrorMonitoring();
    this.setupPerformanceMonitoring();

    this.initialized = true;
    this.logger.info('Monitoring integration initialized');
  }

  setupConversionMonitoring() {
    // Monitor image conversion events
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const [url, options] = args;
      
      // Check if this is a conversion request
      if (url.includes('/functions/v1/image-conversion') || url.includes('/convert')) {
        const startTime = Date.now();
        const timer = metricsCollector.startTimer('conversion_request');
        
        try {
          const response = await originalFetch(...args);
          const duration = Date.now() - startTime;
          
          // Record conversion metrics
          metricsCollector.recordConversion(
            this.getUserId(),
            response.ok,
            duration,
            this.getRequestSize(options)
          );

          // Log conversion event
          this.logger.logConversion(this.getUserId(), {
            success: response.ok,
            processingTime: duration,
            originalFormat: this.extractFormat(options, 'original'),
            targetFormat: this.extractFormat(options, 'target'),
            fileSize: this.getRequestSize(options)
          });

          metricsCollector.endTimer(timer);
          return response;
        } catch (error) {
          const duration = Date.now() - startTime;
          
          metricsCollector.recordConversion(
            this.getUserId(),
            false,
            duration,
            this.getRequestSize(options)
          );

          this.logger.error('Conversion request failed', {
            error: error.message,
            duration,
            url
          });

          metricsCollector.endTimer(timer);
          throw error;
        }
      }
      
      return originalFetch(...args);
    };
  }

  setupAuthMonitoring() {
    // Monitor authentication events
    if (typeof window !== 'undefined' && window.supabase) {
      const { data: authListener } = window.supabase.auth.onAuthStateChange((event, session) => {
        this.logger.info('Auth state changed', {
          event,
          userId: session?.user?.id,
          email: session?.user?.email
        });

        metricsCollector.incrementCounter('auth_events_total', 1, {
          event_type: event
        });

        if (event === 'SIGNED_IN') {
          metricsCollector.incrementCounter('auth_success_total');
        } else if (event === 'SIGN_IN_ERROR') {
          metricsCollector.incrementCounter('auth_failure_total');
        }
      });
    }
  }

  setupBillingMonitoring() {
    // Monitor billing-related events
    const originalStripeRedirect = window.redirectToStripe;
    if (originalStripeRedirect) {
      window.redirectToStripe = async (...args) => {
        const startTime = Date.now();
        
        try {
          const result = await originalStripeRedirect(...args);
          const duration = Date.now() - startTime;
          
          metricsCollector.recordPerformanceMetric('stripe_redirect', duration, true);
          this.logger.info('Stripe redirect initiated', {
            duration,
            userId: this.getUserId()
          });
          
          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          
          metricsCollector.recordPerformanceMetric('stripe_redirect', duration, false);
          this.logger.error('Stripe redirect failed', {
            error: error.message,
            duration,
            userId: this.getUserId()
          });
          
          throw error;
        }
      };
    }
  }

  setupWebhookMonitoring() {
    // This would typically be done in the webhook handler
    // Adding client-side monitoring for webhook-related UI updates
    
    const originalUpdateUI = window.updateUIAfterWebhook;
    if (originalUpdateUI) {
      window.updateUIAfterWebhook = (webhookData) => {
        this.logger.info('UI updated after webhook', {
          webhookType: webhookData.type,
          userId: this.getUserId()
        });

        metricsCollector.incrementCounter('webhook_ui_updates_total', 1, {
          webhook_type: webhookData.type
        });

        return originalUpdateUI(webhookData);
      };
    }
  }

  setupQuotaMonitoring() {
    // Monitor quota-related operations
    const originalQuotaCheck = window.checkQuota;
    if (originalQuotaCheck) {
      window.checkQuota = async (...args) => {
        const startTime = Date.now();
        const timer = metricsCollector.startTimer('quota_check');
        
        try {
          const result = await originalQuotaCheck(...args);
          const duration = metricsCollector.endTimer(timer);
          
          this.logger.logQuotaCheck(this.getUserId(), {
            conversionsUsed: result.conversionsUsed,
            conversionsLimit: result.conversionsLimit,
            quotaExceeded: result.quotaExceeded
          });

          metricsCollector.recordUsagePattern(
            this.getUserId(),
            result.planType,
            result.conversionsUsed,
            result.conversionsLimit
          );

          return result;
        } catch (error) {
          metricsCollector.endTimer(timer);
          
          this.logger.error('Quota check failed', {
            error: error.message,
            userId: this.getUserId()
          });
          
          throw error;
        }
      };
    }
  }

  setupErrorMonitoring() {
    // Enhanced error monitoring
    const originalErrorHandler = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
      metricsCollector.recordError('client', error?.name || 'unknown', 'error');
      
      this.logger.error('Client error occurred', {
        message,
        source,
        lineno,
        colno,
        stack: error?.stack
      });

      if (originalErrorHandler) {
        return originalErrorHandler(message, source, lineno, colno, error);
      }
    };

    // Promise rejection monitoring
    window.addEventListener('unhandledrejection', (event) => {
      metricsCollector.recordError('client', 'unhandled_promise_rejection', 'error');
      
      this.logger.error('Unhandled promise rejection', {
        reason: event.reason,
        stack: event.reason?.stack
      });
    });
  }

  setupPerformanceMonitoring() {
    // Monitor page load performance
    if ('performance' in window) {
      window.addEventListener('load', () => {
        setTimeout(() => {
          const navigation = performance.getEntriesByType('navigation')[0];
          if (navigation) {
            metricsCollector.recordPerformanceMetric('page_load', navigation.loadEventEnd);
            metricsCollector.recordPerformanceMetric('dom_content_loaded', navigation.domContentLoadedEventEnd);
            metricsCollector.recordPerformanceMetric('first_paint', navigation.responseEnd);
            
            this.logger.logPerformanceMetric('page_load', navigation.loadEventEnd, {
              domContentLoaded: navigation.domContentLoadedEventEnd,
              firstPaint: navigation.responseEnd
            });
          }
        }, 0);
      });
    }

    // Monitor resource loading
    if ('PerformanceObserver' in window) {
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'resource') {
            metricsCollector.recordPerformanceMetric(
              'resource_load',
              entry.duration,
              entry.responseEnd > 0
            );
          }
        }
      });

      try {
        resourceObserver.observe({ entryTypes: ['resource'] });
      } catch (error) {
        this.logger.warn('Resource observer setup failed', { error: error.message });
      }
    }
  }

  // Utility methods
  getUserId() {
    // Try to get user ID from various sources
    if (typeof window !== 'undefined') {
      if (window.supabase?.auth?.user?.id) {
        return window.supabase.auth.user.id;
      }
      
      if (window.currentUser?.id) {
        return window.currentUser.id;
      }
      
      // Try to get from localStorage
      const user = localStorage.getItem('supabase.auth.token');
      if (user) {
        try {
          const parsed = JSON.parse(user);
          return parsed.user?.id;
        } catch (e) {
          // Ignore parsing errors
        }
      }
    }
    
    return null;
  }

  getRequestSize(options) {
    if (!options || !options.body) return 0;
    
    if (typeof options.body === 'string') {
      return new Blob([options.body]).size;
    }
    
    if (options.body instanceof FormData) {
      // Estimate FormData size (not exact)
      let size = 0;
      for (const [key, value] of options.body.entries()) {
        if (value instanceof File) {
          size += value.size;
        } else {
          size += new Blob([String(value)]).size;
        }
      }
      return size;
    }
    
    return 0;
  }

  extractFormat(options, type) {
    if (!options || !options.body) return 'unknown';
    
    try {
      if (options.body instanceof FormData) {
        const format = options.body.get(`${type}Format`);
        return format || 'unknown';
      }
      
      if (typeof options.body === 'string') {
        const parsed = JSON.parse(options.body);
        return parsed[`${type}Format`] || 'unknown';
      }
    } catch (e) {
      // Ignore parsing errors
    }
    
    return 'unknown';
  }

  // Manual event recording methods for components to use
  recordConversionEvent(userId, conversionData) {
    metricsCollector.recordConversion(
      userId,
      conversionData.success,
      conversionData.processingTime,
      conversionData.fileSize
    );
    
    this.logger.logConversion(userId, conversionData);
  }

  recordWebhookEvent(eventType, eventId, success, latency, error = null) {
    if (success) {
      metricsCollector.recordWebhookSuccess(eventType, latency);
    } else {
      metricsCollector.recordWebhookFailure(eventType, latency, error);
    }
    
    this.logger.logWebhookEvent(eventType, eventId, success, latency, error);
  }

  recordQuotaWriteEvent(success, latency, error = null) {
    if (success) {
      metricsCollector.recordQuotaWriteSuccess(latency);
    } else {
      metricsCollector.recordQuotaWriteFailure(latency, error);
    }
  }

  recordSecurityEvent(eventType, userId, details) {
    metricsCollector.recordError('security', eventType, 'warning');
    this.logger.logSecurityEvent(eventType, userId, details);
  }

  // Get monitoring status
  getMonitoringStatus() {
    return {
      initialized: this.initialized,
      logCount: logAggregator.logs.length,
      metricsCount: metricsCollector.counters.size + metricsCollector.histograms.size,
      webhookSuccessRate: metricsCollector.getWebhookSuccessRate(),
      quotaWriteFailureRate: metricsCollector.getQuotaWriteFailureRate()
    };
  }
}

// Global monitoring integration instance
const monitoringIntegration = new MonitoringIntegration();

// Auto-initialize if in browser environment
if (typeof window !== 'undefined') {
  // Initialize after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      monitoringIntegration.initialize();
    });
  } else {
    monitoringIntegration.initialize();
  }
}

// CommonJS exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MonitoringIntegration,
    monitoringIntegration
  };
} else {
  // ES6 exports for browser
  window.MonitoringIntegration = MonitoringIntegration;
  window.monitoringIntegration = monitoringIntegration;
}