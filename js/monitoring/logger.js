/**
 * Structured logging system for the image converter application
 * Implements requirement 17.1: Ship logs and metrics to monitoring systems
 */

class Logger {
  constructor(component = 'unknown') {
    this.component = component;
    this.logLevel = this.getLogLevel();
    this.sessionId = this.generateSessionId();
  }

  getLogLevel() {
    // Default to 'info' in production, 'debug' in development
    return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
  }

  generateSessionId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  formatLogEntry(level, message, metadata = {}) {
    return {
      timestamp: new Date().toISOString(),
      level,
      component: this.component,
      sessionId: this.sessionId,
      message,
      metadata: {
        ...metadata,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
        url: typeof window !== 'undefined' ? window.location.href : 'server'
      }
    };
  }

  shouldLog(level) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.logLevel];
  }

  async shipLog(logEntry) {
    // Ship to console for development
    console.log(JSON.stringify(logEntry, null, 2));

    // Ship to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      try {
        // Send to monitoring endpoint
        await fetch('/api/logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(logEntry)
        });
      } catch (error) {
        // Fallback logging - don't let logging failures break the app
        console.error('Failed to ship log:', error);
      }
    }
  }

  debug(message, metadata = {}) {
    if (this.shouldLog('debug')) {
      const logEntry = this.formatLogEntry('debug', message, metadata);
      this.shipLog(logEntry);
    }
  }

  info(message, metadata = {}) {
    if (this.shouldLog('info')) {
      const logEntry = this.formatLogEntry('info', message, metadata);
      this.shipLog(logEntry);
    }
  }

  warn(message, metadata = {}) {
    if (this.shouldLog('warn')) {
      const logEntry = this.formatLogEntry('warn', message, metadata);
      this.shipLog(logEntry);
    }
  }

  error(message, metadata = {}) {
    if (this.shouldLog('error')) {
      const logEntry = this.formatLogEntry('error', message, metadata);
      this.shipLog(logEntry);
    }
  }

  // Specialized logging methods for specific events
  logConversion(userId, conversionData) {
    this.info('Image conversion completed', {
      event: 'conversion_completed',
      userId,
      originalFormat: conversionData.originalFormat,
      targetFormat: conversionData.targetFormat,
      fileSize: conversionData.fileSize,
      processingTime: conversionData.processingTime,
      success: conversionData.success
    });
  }

  logQuotaCheck(userId, quotaData) {
    this.info('Quota check performed', {
      event: 'quota_check',
      userId,
      conversionsUsed: quotaData.conversionsUsed,
      conversionsLimit: quotaData.conversionsLimit,
      quotaExceeded: quotaData.quotaExceeded
    });
  }

  logWebhookEvent(eventType, eventId, success, processingTime, error = null) {
    this.info('Webhook event processed', {
      event: 'webhook_processed',
      eventType,
      eventId,
      success,
      processingTime,
      error: error ? error.message : null
    });
  }

  logSecurityEvent(eventType, userId, details) {
    this.warn('Security event detected', {
      event: 'security_event',
      eventType,
      userId,
      details
    });
  }

  logPerformanceMetric(operation, duration, metadata = {}) {
    this.info('Performance metric recorded', {
      event: 'performance_metric',
      operation,
      duration,
      ...metadata
    });
  }
}

// Create component-specific loggers
const createLogger = (component) => new Logger(component);

// Pre-configured loggers for common components
const authLogger = new Logger('auth');
const conversionLogger = new Logger('conversion');
const billingLogger = new Logger('billing');
const webhookLogger = new Logger('webhook');
const securityLogger = new Logger('security');
const performanceLogger = new Logger('performance');

// CommonJS exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Logger,
    createLogger,
    authLogger,
    conversionLogger,
    billingLogger,
    webhookLogger,
    securityLogger,
    performanceLogger
  };
} else {
  // ES6 exports for browser
  window.Logger = Logger;
  window.createLogger = createLogger;
  window.authLogger = authLogger;
  window.conversionLogger = conversionLogger;
  window.billingLogger = billingLogger;
  window.webhookLogger = webhookLogger;
  window.securityLogger = securityLogger;
  window.performanceLogger = performanceLogger;
}