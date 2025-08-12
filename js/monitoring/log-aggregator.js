/**
 * Log aggregation and search system
 * Implements requirement 17.1: Log aggregation and search capabilities
 */

// Import logger based on environment
let createLogger;
if (typeof require !== 'undefined') {
  createLogger = require('./logger.js').createLogger;
} else {
  createLogger = window.createLogger;
}

class LogAggregator {
  constructor() {
    this.logger = createLogger('log-aggregator');
    this.logs = [];
    this.maxLogs = 10000; // Keep last 10k logs in memory
    this.searchIndex = new Map();
    this.filters = new Map();
    
    this.initializeAggregation();
  }

  initializeAggregation() {
    // Set up log collection from various sources
    this.setupConsoleInterception();
    this.setupErrorHandling();
    this.setupPerformanceObserver();
    
    this.logger.info('Log aggregator initialized');
  }

  setupConsoleInterception() {
    // Intercept console logs to aggregate them
    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
      debug: console.debug
    };

    const interceptor = (level) => (...args) => {
      // Call original console method
      originalConsole[level](...args);
      
      // Aggregate the log
      this.addLog({
        timestamp: new Date().toISOString(),
        level,
        component: 'console',
        message: args.join(' '),
        metadata: {
          source: 'console_intercept',
          args: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg))
        }
      });
    };

    console.log = interceptor('info');
    console.warn = interceptor('warn');
    console.error = interceptor('error');
    console.info = interceptor('info');
    console.debug = interceptor('debug');
  }

  setupErrorHandling() {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.addLog({
        timestamp: new Date().toISOString(),
        level: 'error',
        component: 'global',
        message: `Uncaught error: ${event.message}`,
        metadata: {
          source: 'global_error_handler',
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack
        }
      });
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.addLog({
        timestamp: new Date().toISOString(),
        level: 'error',
        component: 'promise',
        message: `Unhandled promise rejection: ${event.reason}`,
        metadata: {
          source: 'unhandled_rejection',
          reason: String(event.reason),
          stack: event.reason?.stack
        }
      });
    });
  }

  setupPerformanceObserver() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.addLog({
            timestamp: new Date().toISOString(),
            level: 'info',
            component: 'performance',
            message: `Performance entry: ${entry.name}`,
            metadata: {
              source: 'performance_observer',
              entryType: entry.entryType,
              name: entry.name,
              duration: entry.duration,
              startTime: entry.startTime
            }
          });
        }
      });

      try {
        observer.observe({ entryTypes: ['navigation', 'resource', 'measure', 'mark'] });
      } catch (error) {
        this.logger.warn('Performance observer setup failed', { error: error.message });
      }
    }
  }

  addLog(logEntry) {
    // Add timestamp if not present
    if (!logEntry.timestamp) {
      logEntry.timestamp = new Date().toISOString();
    }

    // Add unique ID
    logEntry.id = this.generateLogId();

    // Add to logs array
    this.logs.push(logEntry);

    // Maintain max logs limit
    if (this.logs.length > this.maxLogs) {
      const removedLog = this.logs.shift();
      this.removeFromSearchIndex(removedLog);
    }

    // Add to search index
    this.addToSearchIndex(logEntry);

    // Ship to external systems if configured
    this.shipLogEntry(logEntry);
  }

  generateLogId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  addToSearchIndex(logEntry) {
    // Index by component
    if (!this.searchIndex.has('component')) {
      this.searchIndex.set('component', new Map());
    }
    const componentIndex = this.searchIndex.get('component');
    if (!componentIndex.has(logEntry.component)) {
      componentIndex.set(logEntry.component, []);
    }
    componentIndex.get(logEntry.component).push(logEntry.id);

    // Index by level
    if (!this.searchIndex.has('level')) {
      this.searchIndex.set('level', new Map());
    }
    const levelIndex = this.searchIndex.get('level');
    if (!levelIndex.has(logEntry.level)) {
      levelIndex.set(logEntry.level, []);
    }
    levelIndex.get(logEntry.level).push(logEntry.id);

    // Index by message keywords
    if (!this.searchIndex.has('keywords')) {
      this.searchIndex.set('keywords', new Map());
    }
    const keywordIndex = this.searchIndex.get('keywords');
    const keywords = this.extractKeywords(logEntry.message);
    keywords.forEach(keyword => {
      if (!keywordIndex.has(keyword)) {
        keywordIndex.set(keyword, []);
      }
      keywordIndex.get(keyword).push(logEntry.id);
    });
  }

  removeFromSearchIndex(logEntry) {
    // Remove from component index
    const componentIndex = this.searchIndex.get('component');
    if (componentIndex && componentIndex.has(logEntry.component)) {
      const ids = componentIndex.get(logEntry.component);
      const index = ids.indexOf(logEntry.id);
      if (index > -1) {
        ids.splice(index, 1);
      }
    }

    // Remove from level index
    const levelIndex = this.searchIndex.get('level');
    if (levelIndex && levelIndex.has(logEntry.level)) {
      const ids = levelIndex.get(logEntry.level);
      const index = ids.indexOf(logEntry.id);
      if (index > -1) {
        ids.splice(index, 1);
      }
    }

    // Remove from keyword index
    const keywordIndex = this.searchIndex.get('keywords');
    if (keywordIndex) {
      const keywords = this.extractKeywords(logEntry.message);
      keywords.forEach(keyword => {
        if (keywordIndex.has(keyword)) {
          const ids = keywordIndex.get(keyword);
          const index = ids.indexOf(logEntry.id);
          if (index > -1) {
            ids.splice(index, 1);
          }
        }
      });
    }
  }

  extractKeywords(message) {
    return message
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 10); // Limit keywords per message
  }

  // Search functionality
  search(query, options = {}) {
    const {
      level = null,
      component = null,
      startTime = null,
      endTime = null,
      limit = 100,
      offset = 0
    } = options;

    let results = [...this.logs];

    // Filter by level
    if (level) {
      results = results.filter(log => log.level === level);
    }

    // Filter by component
    if (component) {
      results = results.filter(log => log.component === component);
    }

    // Filter by time range
    if (startTime) {
      results = results.filter(log => new Date(log.timestamp) >= new Date(startTime));
    }
    if (endTime) {
      results = results.filter(log => new Date(log.timestamp) <= new Date(endTime));
    }

    // Text search in message
    if (query) {
      const queryLower = query.toLowerCase();
      results = results.filter(log => 
        log.message.toLowerCase().includes(queryLower) ||
        JSON.stringify(log.metadata).toLowerCase().includes(queryLower)
      );
    }

    // Sort by timestamp (newest first)
    results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Apply pagination
    const total = results.length;
    results = results.slice(offset, offset + limit);

    return {
      logs: results,
      total,
      offset,
      limit,
      hasMore: offset + limit < total
    };
  }

  // Get logs by specific criteria
  getLogsByLevel(level, limit = 100) {
    return this.search('', { level, limit });
  }

  getLogsByComponent(component, limit = 100) {
    return this.search('', { component, limit });
  }

  getRecentLogs(minutes = 60, limit = 100) {
    const startTime = new Date(Date.now() - minutes * 60 * 1000).toISOString();
    return this.search('', { startTime, limit });
  }

  getErrorLogs(limit = 100) {
    return this.getLogsByLevel('error', limit);
  }

  // Analytics methods
  getLogStats(timeRange = 'hour') {
    const now = new Date();
    let startTime;

    switch (timeRange) {
      case 'hour':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'day':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
    }

    const recentLogs = this.logs.filter(log => 
      new Date(log.timestamp) >= startTime
    );

    const stats = {
      total: recentLogs.length,
      byLevel: {},
      byComponent: {},
      timeRange,
      startTime: startTime.toISOString(),
      endTime: now.toISOString()
    };

    // Count by level
    recentLogs.forEach(log => {
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
    });

    // Count by component
    recentLogs.forEach(log => {
      stats.byComponent[log.component] = (stats.byComponent[log.component] || 0) + 1;
    });

    return stats;
  }

  // Export logs for external analysis
  exportLogs(format = 'json', options = {}) {
    const logs = this.search('', options).logs;

    switch (format) {
      case 'json':
        return JSON.stringify(logs, null, 2);
      case 'csv':
        return this.convertToCSV(logs);
      case 'txt':
        return logs.map(log => 
          `[${log.timestamp}] ${log.level.toUpperCase()} ${log.component}: ${log.message}`
        ).join('\n');
      default:
        return JSON.stringify(logs, null, 2);
    }
  }

  convertToCSV(logs) {
    if (logs.length === 0) return '';

    const headers = ['timestamp', 'level', 'component', 'message', 'metadata'];
    const csvRows = [headers.join(',')];

    logs.forEach(log => {
      const row = [
        log.timestamp,
        log.level,
        log.component,
        `"${log.message.replace(/"/g, '""')}"`,
        `"${JSON.stringify(log.metadata).replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  async shipLogEntry(logEntry) {
    // Ship to external log aggregation service
    try {
      if (typeof fetch !== 'undefined' && process.env.NODE_ENV === 'production') {
        await fetch('/api/logs/ingest', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(logEntry)
        });
      }
    } catch (error) {
      // Don't log shipping errors to avoid infinite loops
      console.warn('Failed to ship log entry:', error.message);
    }
  }

  // Clean up old logs
  cleanup(olderThanHours = 24) {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    const initialCount = this.logs.length;
    
    this.logs = this.logs.filter(log => new Date(log.timestamp) > cutoffTime);
    
    const removedCount = initialCount - this.logs.length;
    if (removedCount > 0) {
      this.logger.info('Log cleanup completed', {
        removedCount,
        remainingCount: this.logs.length,
        cutoffTime: cutoffTime.toISOString()
      });
    }

    // Rebuild search index after cleanup
    this.rebuildSearchIndex();
  }

  rebuildSearchIndex() {
    this.searchIndex.clear();
    this.logs.forEach(log => this.addToSearchIndex(log));
  }

  // Get system status
  getSystemStatus() {
    const stats = this.getLogStats('hour');
    const errorRate = (stats.byLevel.error || 0) / stats.total * 100;
    const warningRate = (stats.byLevel.warn || 0) / stats.total * 100;

    return {
      status: errorRate > 10 ? 'critical' : warningRate > 20 ? 'warning' : 'healthy',
      errorRate,
      warningRate,
      totalLogs: stats.total,
      lastHour: stats
    };
  }
}

// Global log aggregator instance
const logAggregator = new LogAggregator();

// CommonJS exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LogAggregator,
    logAggregator
  };
} else {
  // ES6 exports for browser
  window.LogAggregator = LogAggregator;
  window.logAggregator = logAggregator;
}