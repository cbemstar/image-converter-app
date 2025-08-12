/**
 * Alerting and notification system for monitoring
 * Implements requirement 17.4, 17.5, 16.6: Automated alerting for system failures and anomalies
 */

// Import modules based on environment
let metricsCollector, createLogger;
if (typeof require !== 'undefined') {
  ({ metricsCollector } = require('./metrics-collector.js'));
  ({ createLogger } = require('./logger.js'));
} else {
  metricsCollector = window.metricsCollector;
  createLogger = window.createLogger;
}

class AlertingSystem {
  constructor() {
    this.logger = createLogger('alerting');
    this.alerts = new Map();
    this.alertRules = new Map();
    this.notificationChannels = new Map();
    this.alertHistory = [];
    this.maxHistorySize = 1000;
    
    this.initializeDefaultRules();
    this.startAlertMonitoring();
  }

  initializeDefaultRules() {
    // Webhook failure alerts (requirement 16.6)
    this.addAlertRule('webhook_failure_rate_high', {
      condition: () => {
        const successRate = metricsCollector.getWebhookSuccessRate();
        return successRate < 90;
      },
      severity: 'critical',
      message: () => `Webhook success rate dropped to ${metricsCollector.getWebhookSuccessRate().toFixed(1)}%`,
      cooldown: 300000, // 5 minutes
      maxRetries: 3
    });

    // Quota write failure alerts (requirement 17.7)
    this.addAlertRule('quota_write_failure_rate_high', {
      condition: () => {
        const failureRate = metricsCollector.getQuotaWriteFailureRate();
        return failureRate > 5;
      },
      severity: 'critical',
      message: () => `Quota write failure rate increased to ${metricsCollector.getQuotaWriteFailureRate().toFixed(1)}%`,
      cooldown: 300000, // 5 minutes
      maxRetries: 3
    });

    // High error rate alerts (requirement 17.4)
    this.addAlertRule('error_rate_high', {
      condition: () => {
        const totalErrors = metricsCollector.getAggregatedCounter('errors_total');
        const totalRequests = metricsCollector.getAggregatedCounter('requests_total') || 1;
        const errorRate = (totalErrors / totalRequests) * 100;
        return errorRate > 10;
      },
      severity: 'warning',
      message: () => {
        const totalErrors = metricsCollector.getAggregatedCounter('errors_total');
        const totalRequests = metricsCollector.getAggregatedCounter('requests_total') || 1;
        const errorRate = (totalErrors / totalRequests) * 100;
        return `Error rate increased to ${errorRate.toFixed(1)}%`;
      },
      cooldown: 600000, // 10 minutes
      maxRetries: 2
    });

    // Usage spike detection (requirement 17.5)
    this.addAlertRule('usage_spike_detected', {
      condition: () => {
        const recentConversions = metricsCollector.getAggregatedCounter('conversions_total');
        // Simple spike detection - would be more sophisticated in production
        return recentConversions > 1000; // Threshold for spike
      },
      severity: 'warning',
      message: () => `Usage spike detected: ${metricsCollector.getAggregatedCounter('conversions_total')} conversions`,
      cooldown: 1800000, // 30 minutes
      maxRetries: 1
    });

    // System resource alerts
    this.addAlertRule('memory_usage_high', {
      condition: () => {
        if (typeof process !== 'undefined') {
          const memoryUsage = process.memoryUsage();
          const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024;
          return memoryUsageMB > 500; // 500MB threshold
        }
        return false;
      },
      severity: 'warning',
      message: () => {
        const memoryUsage = process.memoryUsage();
        const memoryUsageMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
        return `High memory usage detected: ${memoryUsageMB}MB`;
      },
      cooldown: 900000, // 15 minutes
      maxRetries: 2
    });

    // Webhook retry threshold alerts
    this.addAlertRule('webhook_retries_excessive', {
      condition: () => {
        const retryCount = metricsCollector.getAggregatedCounter('webhook_retry_total');
        return retryCount > 10; // More than 10 retries indicates issues
      },
      severity: 'warning',
      message: () => `Excessive webhook retries detected: ${metricsCollector.getAggregatedCounter('webhook_retry_total')} retries`,
      cooldown: 600000, // 10 minutes
      maxRetries: 2
    });

    // Billing failure alerts (requirement 17.5)
    this.addAlertRule('billing_failures_detected', {
      condition: () => {
        const billingErrors = metricsCollector.getCounter('errors_total', { component: 'billing' });
        return billingErrors > 5;
      },
      severity: 'critical',
      message: () => `Multiple billing failures detected: ${metricsCollector.getCounter('errors_total', { component: 'billing' })} errors`,
      cooldown: 300000, // 5 minutes
      maxRetries: 3
    });
  }

  addAlertRule(name, rule) {
    this.alertRules.set(name, {
      ...rule,
      name,
      lastTriggered: 0,
      retryCount: 0,
      enabled: true
    });
    
    this.logger.info('Alert rule added', { ruleName: name, severity: rule.severity });
  }

  removeAlertRule(name) {
    this.alertRules.delete(name);
    this.logger.info('Alert rule removed', { ruleName: name });
  }

  enableAlertRule(name) {
    const rule = this.alertRules.get(name);
    if (rule) {
      rule.enabled = true;
      this.logger.info('Alert rule enabled', { ruleName: name });
    }
  }

  disableAlertRule(name) {
    const rule = this.alertRules.get(name);
    if (rule) {
      rule.enabled = false;
      this.logger.info('Alert rule disabled', { ruleName: name });
    }
  }

  addNotificationChannel(name, channel) {
    this.notificationChannels.set(name, channel);
    this.logger.info('Notification channel added', { channelName: name, type: channel.type });
  }

  removeNotificationChannel(name) {
    this.notificationChannels.delete(name);
    this.logger.info('Notification channel removed', { channelName: name });
  }

  async checkAlerts() {
    const now = Date.now();
    const triggeredAlerts = [];

    for (const [name, rule] of this.alertRules.entries()) {
      if (!rule.enabled) continue;

      // Check cooldown period
      if (now - rule.lastTriggered < rule.cooldown) {
        continue;
      }

      try {
        if (rule.condition()) {
          // Check if we've exceeded max retries
          if (rule.retryCount >= rule.maxRetries) {
            this.logger.warn('Alert rule max retries exceeded', { 
              ruleName: name, 
              retryCount: rule.retryCount 
            });
            continue;
          }

          const alert = {
            id: this.generateAlertId(),
            name,
            severity: rule.severity,
            message: typeof rule.message === 'function' ? rule.message() : rule.message,
            timestamp: new Date().toISOString(),
            resolved: false,
            retryCount: rule.retryCount
          };

          triggeredAlerts.push(alert);
          this.alerts.set(alert.id, alert);
          
          // Update rule state
          rule.lastTriggered = now;
          rule.retryCount++;

          this.logger.warn('Alert triggered', {
            alertId: alert.id,
            ruleName: name,
            severity: alert.severity,
            message: alert.message
          });

          // Add to history
          this.addToHistory(alert);

          // Send notifications
          await this.sendNotifications(alert);
        } else {
          // Reset retry count if condition is no longer met
          if (rule.retryCount > 0) {
            rule.retryCount = 0;
            this.logger.info('Alert rule condition resolved', { ruleName: name });
          }
        }
      } catch (error) {
        this.logger.error('Error checking alert rule', {
          ruleName: name,
          error: error.message
        });
      }
    }

    return triggeredAlerts;
  }

  async sendNotifications(alert) {
    const notifications = [];

    for (const [channelName, channel] of this.notificationChannels.entries()) {
      try {
        // Check if this channel should receive this alert based on severity
        if (this.shouldNotifyChannel(channel, alert)) {
          await this.sendToChannel(channel, alert);
          notifications.push(channelName);
          
          this.logger.info('Notification sent', {
            alertId: alert.id,
            channel: channelName,
            severity: alert.severity
          });
        }
      } catch (error) {
        this.logger.error('Failed to send notification', {
          alertId: alert.id,
          channel: channelName,
          error: error.message
        });
      }
    }

    return notifications;
  }

  shouldNotifyChannel(channel, alert) {
    // Check severity filter
    if (channel.severityFilter) {
      const severityLevels = { info: 0, warning: 1, critical: 2 };
      const alertLevel = severityLevels[alert.severity] || 0;
      const channelLevel = severityLevels[channel.severityFilter] || 0;
      
      if (alertLevel < channelLevel) {
        return false;
      }
    }

    // Check alert name filter
    if (channel.alertFilter && !channel.alertFilter.includes(alert.name)) {
      return false;
    }

    return true;
  }

  async sendToChannel(channel, alert) {
    switch (channel.type) {
      case 'webhook':
        return this.sendWebhookNotification(channel, alert);
      case 'email':
        return this.sendEmailNotification(channel, alert);
      case 'console':
        return this.sendConsoleNotification(channel, alert);
      case 'database':
        return this.sendDatabaseNotification(channel, alert);
      default:
        throw new Error(`Unknown notification channel type: ${channel.type}`);
    }
  }

  async sendWebhookNotification(channel, alert) {
    const payload = {
      alert: {
        id: alert.id,
        name: alert.name,
        severity: alert.severity,
        message: alert.message,
        timestamp: alert.timestamp
      },
      metadata: {
        source: 'image-converter-monitoring',
        environment: process.env.NODE_ENV || 'development'
      }
    };

    if (typeof fetch !== 'undefined') {
      const response = await fetch(channel.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(channel.headers || {})
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Webhook notification failed: ${response.status} ${response.statusText}`);
      }
    }
  }

  async sendEmailNotification(channel, alert) {
    // In a real implementation, this would integrate with an email service
    this.logger.info('Email notification would be sent', {
      to: channel.email,
      subject: `Alert: ${alert.name}`,
      message: alert.message
    });
  }

  async sendConsoleNotification(channel, alert) {
    const prefix = alert.severity === 'critical' ? '🚨' : '⚠️';
    console.warn(`${prefix} ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`);
  }

  async sendDatabaseNotification(channel, alert) {
    // Store alert in database for persistence
    if (typeof fetch !== 'undefined') {
      await fetch('/api/monitoring/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alert)
      });
    }
  }

  resolveAlert(alertId, resolvedBy = 'system') {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date().toISOString();
      alert.resolvedBy = resolvedBy;
      
      this.logger.info('Alert resolved', {
        alertId,
        resolvedBy,
        duration: Date.now() - new Date(alert.timestamp).getTime()
      });
      
      return true;
    }
    return false;
  }

  getActiveAlerts() {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  getAlertHistory(limit = 100) {
    return this.alertHistory.slice(-limit);
  }

  getAlertStats() {
    const activeAlerts = this.getActiveAlerts();
    const totalAlerts = this.alerts.size;
    const resolvedAlerts = totalAlerts - activeAlerts.length;
    
    const severityCounts = {
      critical: 0,
      warning: 0,
      info: 0
    };

    activeAlerts.forEach(alert => {
      severityCounts[alert.severity] = (severityCounts[alert.severity] || 0) + 1;
    });

    return {
      active: activeAlerts.length,
      total: totalAlerts,
      resolved: resolvedAlerts,
      severityCounts,
      rules: {
        total: this.alertRules.size,
        enabled: Array.from(this.alertRules.values()).filter(rule => rule.enabled).length
      }
    };
  }

  addToHistory(alert) {
    this.alertHistory.push({
      ...alert,
      historicalTimestamp: new Date().toISOString()
    });

    // Maintain history size limit
    if (this.alertHistory.length > this.maxHistorySize) {
      this.alertHistory.shift();
    }
  }

  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  startAlertMonitoring() {
    // Check alerts every 60 seconds
    setInterval(() => {
      this.checkAlerts().catch(error => {
        this.logger.error('Error during alert check', { error: error.message });
      });
    }, 60000);

    // Initial check after 10 seconds
    setTimeout(() => {
      this.checkAlerts().catch(error => {
        this.logger.error('Error during initial alert check', { error: error.message });
      });
    }, 10000);

    this.logger.info('Alert monitoring started');
  }

  // Manual alert triggering for testing
  triggerTestAlert(severity = 'warning') {
    const alert = {
      id: this.generateAlertId(),
      name: 'test_alert',
      severity,
      message: 'This is a test alert',
      timestamp: new Date().toISOString(),
      resolved: false,
      retryCount: 0
    };

    this.alerts.set(alert.id, alert);
    this.addToHistory(alert);
    this.sendNotifications(alert);

    this.logger.info('Test alert triggered', { alertId: alert.id });
    return alert;
  }

  // Cleanup old resolved alerts
  cleanupResolvedAlerts(olderThanHours = 24) {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [alertId, alert] of this.alerts.entries()) {
      if (alert.resolved && new Date(alert.resolvedAt) < cutoffTime) {
        this.alerts.delete(alertId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.info('Cleaned up resolved alerts', { 
        cleanedCount, 
        remainingAlerts: this.alerts.size 
      });
    }

    return cleanedCount;
  }

  // Get system health based on active alerts
  getSystemHealth() {
    const activeAlerts = this.getActiveAlerts();
    const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical');
    const warningAlerts = activeAlerts.filter(alert => alert.severity === 'warning');

    let status = 'healthy';
    if (criticalAlerts.length > 0) {
      status = 'critical';
    } else if (warningAlerts.length > 0) {
      status = 'warning';
    }

    return {
      status,
      activeAlerts: activeAlerts.length,
      criticalAlerts: criticalAlerts.length,
      warningAlerts: warningAlerts.length,
      lastCheck: new Date().toISOString()
    };
  }
}

// Global alerting system instance
const alertingSystem = new AlertingSystem();

// CommonJS exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AlertingSystem,
    alertingSystem
  };
} else {
  // ES6 exports for browser
  window.AlertingSystem = AlertingSystem;
  window.alertingSystem = alertingSystem;
}

// Export for ES6 modules
if (typeof window === 'undefined') {
  module.exports.default = AlertingSystem;
}