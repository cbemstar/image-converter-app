/**
 * Monitoring system initialization
 * Implements requirement 17.1: Structured logging for all system components
 */

import { monitoringIntegration } from './monitoring-integration.js';
import { metricsCollector } from './metrics-collector.js';
import { logAggregator } from './log-aggregator.js';
import { createLogger } from './logger.js';
import MonitoringDashboard from './dashboard.js';

class MonitoringSystem {
  constructor() {
    this.logger = createLogger('monitoring-system');
    this.dashboard = null;
    this.initialized = false;
  }

  async initialize(options = {}) {
    if (this.initialized) {
      this.logger.warn('Monitoring system already initialized');
      return;
    }

    const {
      enableDashboard = false,
      dashboardContainerId = 'monitoring-dashboard',
      logLevel = 'info',
      metricsInterval = 60000,
      enablePerformanceMonitoring = true,
      enableErrorTracking = true
    } = options;

    try {
      // Initialize core monitoring components
      this.logger.info('Initializing monitoring system', options);

      // Initialize monitoring integration
      monitoringIntegration.initialize();

      // Initialize dashboard if requested
      if (enableDashboard && typeof document !== 'undefined') {
        this.initializeDashboard(dashboardContainerId);
      }

      // Set up periodic health checks
      this.setupHealthChecks();

      // Set up cleanup routines
      this.setupCleanupRoutines();

      this.initialized = true;
      this.logger.info('Monitoring system initialized successfully');

      // Record initialization metrics
      metricsCollector.incrementCounter('monitoring_system_initialized');
      metricsCollector.recordPerformanceMetric('monitoring_init', Date.now() - this.initStartTime);

    } catch (error) {
      this.logger.error('Failed to initialize monitoring system', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  initializeDashboard(containerId) {
    try {
      this.dashboard = new MonitoringDashboard(containerId);
      this.logger.info('Monitoring dashboard initialized', { containerId });
    } catch (error) {
      this.logger.error('Failed to initialize monitoring dashboard', {
        error: error.message,
        containerId
      });
    }
  }

  setupHealthChecks() {
    // Run health checks every 5 minutes
    setInterval(() => {
      this.performHealthCheck();
    }, 5 * 60 * 1000);

    // Initial health check
    setTimeout(() => {
      this.performHealthCheck();
    }, 10000); // Wait 10 seconds after init
  }

  async performHealthCheck() {
    const healthData = {
      timestamp: new Date().toISOString(),
      monitoring: this.getMonitoringHealth(),
      system: await this.getSystemHealth(),
      metrics: this.getMetricsHealth()
    };

    this.logger.info('Health check completed', healthData);

    // Record health metrics
    metricsCollector.incrementCounter('health_checks_total');
    
    if (healthData.system.status !== 'healthy') {
      metricsCollector.incrementCounter('health_check_failures_total', 1, {
        component: 'system'
      });
    }

    return healthData;
  }

  getMonitoringHealth() {
    const status = monitoringIntegration.getMonitoringStatus();
    
    return {
      status: status.initialized ? 'healthy' : 'unhealthy',
      initialized: status.initialized,
      logCount: status.logCount,
      metricsCount: status.metricsCount
    };
  }

  async getSystemHealth() {
    const checks = [];

    // Check if logging is working
    try {
      this.logger.debug('Health check log test');
      checks.push({ component: 'logging', status: 'healthy' });
    } catch (error) {
      checks.push({ component: 'logging', status: 'unhealthy', error: error.message });
    }

    // Check if metrics collection is working
    try {
      metricsCollector.incrementCounter('health_check_test');
      checks.push({ component: 'metrics', status: 'healthy' });
    } catch (error) {
      checks.push({ component: 'metrics', status: 'unhealthy', error: error.message });
    }

    // Check API endpoints
    if (typeof fetch !== 'undefined') {
      try {
        const response = await fetch('/api/monitoring/health', {
          method: 'GET',
          timeout: 5000
        });
        
        checks.push({
          component: 'api',
          status: response.ok ? 'healthy' : 'unhealthy',
          responseTime: response.headers.get('x-response-time')
        });
      } catch (error) {
        checks.push({
          component: 'api',
          status: 'unhealthy',
          error: error.message
        });
      }
    }

    const unhealthyChecks = checks.filter(check => check.status !== 'healthy');
    
    return {
      status: unhealthyChecks.length === 0 ? 'healthy' : 'unhealthy',
      checks,
      unhealthyCount: unhealthyChecks.length
    };
  }

  getMetricsHealth() {
    const webhookSuccessRate = metricsCollector.getWebhookSuccessRate();
    const quotaWriteFailureRate = metricsCollector.getQuotaWriteFailureRate();
    
    const issues = [];
    
    if (webhookSuccessRate < 95) {
      issues.push(`Webhook success rate low: ${webhookSuccessRate.toFixed(1)}%`);
    }
    
    if (quotaWriteFailureRate > 5) {
      issues.push(`Quota write failure rate high: ${quotaWriteFailureRate.toFixed(1)}%`);
    }

    return {
      status: issues.length === 0 ? 'healthy' : 'warning',
      webhookSuccessRate,
      quotaWriteFailureRate,
      issues
    };
  }

  setupCleanupRoutines() {
    // Clean up old logs every hour
    setInterval(() => {
      logAggregator.cleanup(24); // Keep 24 hours of logs
      this.logger.info('Log cleanup completed');
    }, 60 * 60 * 1000);

    // Clean up old metrics every 6 hours
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 6 * 60 * 60 * 1000);
  }

  cleanupOldMetrics() {
    // This would typically call a database cleanup function
    // For now, we'll just log the cleanup
    this.logger.info('Metrics cleanup initiated');
    metricsCollector.incrementCounter('metrics_cleanup_total');
  }

  // Public API methods
  getLogger(component) {
    return createLogger(component);
  }

  getMetricsCollector() {
    return metricsCollector;
  }

  getLogAggregator() {
    return logAggregator;
  }

  getDashboard() {
    return this.dashboard;
  }

  // Export logs for analysis
  async exportLogs(format = 'json', timeRange = 'day') {
    const startTime = new Date();
    
    switch (timeRange) {
      case 'hour':
        startTime.setHours(startTime.getHours() - 1);
        break;
      case 'day':
        startTime.setDate(startTime.getDate() - 1);
        break;
      case 'week':
        startTime.setDate(startTime.getDate() - 7);
        break;
    }

    const logs = logAggregator.search('', {
      startTime: startTime.toISOString(),
      limit: 10000
    });

    return logAggregator.exportLogs(format, { logs: logs.logs });
  }

  // Get system status summary
  async getSystemStatus() {
    const health = await this.performHealthCheck();
    const logStats = logAggregator.getLogStats('hour');
    const systemStatus = logAggregator.getSystemStatus();

    return {
      overall: systemStatus.status,
      health,
      logs: logStats,
      metrics: {
        webhookSuccessRate: metricsCollector.getWebhookSuccessRate(),
        quotaWriteFailureRate: metricsCollector.getQuotaWriteFailureRate()
      },
      timestamp: new Date().toISOString()
    };
  }

  // Shutdown monitoring system
  shutdown() {
    if (this.dashboard) {
      this.dashboard.destroy();
    }
    
    this.logger.info('Monitoring system shutdown');
    this.initialized = false;
  }
}

// Global monitoring system instance
export const monitoringSystem = new MonitoringSystem();

// Auto-initialize with default options if in browser
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    monitoringSystem.initialize({
      enableDashboard: false, // Dashboard should be explicitly enabled
      enablePerformanceMonitoring: true,
      enableErrorTracking: true
    });
  });

  // Expose monitoring system globally for debugging
  window.monitoringSystem = monitoringSystem;
}

export default MonitoringSystem;