/**
 * Notification manager for handling different types of notifications
 * Implements requirement 17.4, 17.5: Automated alerting and notifications
 */

// Import modules based on environment
let createLogger;
if (typeof require !== 'undefined') {
  ({ createLogger } = require('./logger.js'));
} else {
  createLogger = window.createLogger;
}

class NotificationManager {
  constructor() {
    this.logger = createLogger('notifications');
    this.channels = new Map();
    this.templates = new Map();
    this.rateLimits = new Map();
    this.notificationHistory = [];
    this.maxHistorySize = 500;
    
    this.initializeDefaultChannels();
    this.initializeDefaultTemplates();
  }

  initializeDefaultChannels() {
    // Console notification channel (always available)
    this.addChannel('console', {
      type: 'console',
      enabled: true,
      severityFilter: 'info' // Accept all severities
    });

    // Database notification channel
    this.addChannel('database', {
      type: 'database',
      enabled: true,
      severityFilter: 'warning' // Only warnings and above
    });

    // Webhook channel for external integrations
    if (process.env.ALERT_WEBHOOK_URL) {
      this.addChannel('webhook', {
        type: 'webhook',
        url: process.env.ALERT_WEBHOOK_URL,
        headers: {
          'Authorization': process.env.ALERT_WEBHOOK_TOKEN ? `Bearer ${process.env.ALERT_WEBHOOK_TOKEN}` : undefined
        },
        enabled: true,
        severityFilter: 'warning'
      });
    }

    // Email channel (if configured)
    if (process.env.ALERT_EMAIL_ENABLED === 'true') {
      this.addChannel('email', {
        type: 'email',
        smtp: {
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        },
        from: process.env.ALERT_EMAIL_FROM,
        to: process.env.ALERT_EMAIL_TO?.split(',') || [],
        enabled: true,
        severityFilter: 'critical' // Only critical alerts
      });
    }
  }

  initializeDefaultTemplates() {
    // Default alert templates
    this.addTemplate('webhook_failure', {
      subject: 'Webhook Failure Alert',
      message: 'Webhook success rate has dropped to {{successRate}}%. Immediate attention required.',
      severity: 'critical'
    });

    this.addTemplate('quota_write_failure', {
      subject: 'Quota Write Failure Alert',
      message: 'Quota write failure rate has increased to {{failureRate}}%. Database operations may be affected.',
      severity: 'critical'
    });

    this.addTemplate('error_rate_high', {
      subject: 'High Error Rate Alert',
      message: 'System error rate has increased to {{errorRate}}%. Please investigate.',
      severity: 'warning'
    });

    this.addTemplate('usage_spike', {
      subject: 'Usage Spike Detected',
      message: 'Unusual usage spike detected: {{conversionCount}} conversions. Monitor for potential abuse.',
      severity: 'warning'
    });

    this.addTemplate('billing_failure', {
      subject: 'Billing System Alert',
      message: 'Multiple billing failures detected: {{errorCount}} errors. Revenue may be affected.',
      severity: 'critical'
    });

    this.addTemplate('system_health', {
      subject: 'System Health Alert',
      message: 'System health status changed to {{status}}. {{details}}',
      severity: 'warning'
    });
  }

  addChannel(name, config) {
    this.channels.set(name, {
      ...config,
      name,
      lastUsed: 0,
      successCount: 0,
      failureCount: 0
    });
    
    this.logger.info('Notification channel added', { 
      channelName: name, 
      type: config.type,
      enabled: config.enabled 
    });
  }

  removeChannel(name) {
    this.channels.delete(name);
    this.logger.info('Notification channel removed', { channelName: name });
  }

  enableChannel(name) {
    const channel = this.channels.get(name);
    if (channel) {
      channel.enabled = true;
      this.logger.info('Notification channel enabled', { channelName: name });
    }
  }

  disableChannel(name) {
    const channel = this.channels.get(name);
    if (channel) {
      channel.enabled = false;
      this.logger.info('Notification channel disabled', { channelName: name });
    }
  }

  addTemplate(name, template) {
    this.templates.set(name, template);
    this.logger.info('Notification template added', { templateName: name });
  }

  async sendNotification(alert, templateName = null) {
    const template = templateName ? this.templates.get(templateName) : null;
    const notification = {
      id: this.generateNotificationId(),
      alert,
      template: templateName,
      timestamp: new Date().toISOString(),
      channels: [],
      success: false
    };

    try {
      // Apply template if specified
      if (template) {
        alert.subject = this.applyTemplate(template.subject, alert);
        alert.message = this.applyTemplate(template.message, alert);
      }

      // Send to all eligible channels
      for (const [channelName, channel] of this.channels.entries()) {
        if (!channel.enabled) continue;

        if (this.shouldSendToChannel(channel, alert)) {
          try {
            // Check rate limiting
            if (this.isRateLimited(channelName, alert)) {
              this.logger.warn('Notification rate limited', { 
                channelName, 
                alertName: alert.name 
              });
              continue;
            }

            await this.sendToChannel(channel, alert);
            
            channel.successCount++;
            channel.lastUsed = Date.now();
            notification.channels.push(channelName);
            
            this.logger.info('Notification sent successfully', {
              notificationId: notification.id,
              channelName,
              alertName: alert.name
            });

          } catch (error) {
            channel.failureCount++;
            
            this.logger.error('Failed to send notification', {
              notificationId: notification.id,
              channelName,
              alertName: alert.name,
              error: error.message
            });
          }
        }
      }

      notification.success = notification.channels.length > 0;
      this.addToHistory(notification);

      return notification;

    } catch (error) {
      this.logger.error('Notification processing failed', {
        notificationId: notification.id,
        error: error.message
      });
      
      notification.error = error.message;
      this.addToHistory(notification);
      
      throw error;
    }
  }

  shouldSendToChannel(channel, alert) {
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

    // Check time-based filters (e.g., business hours only)
    if (channel.timeFilter) {
      const now = new Date();
      const hour = now.getHours();
      
      if (channel.timeFilter.businessHoursOnly && (hour < 9 || hour > 17)) {
        return false;
      }
    }

    return true;
  }

  isRateLimited(channelName, alert) {
    const key = `${channelName}:${alert.name}`;
    const now = Date.now();
    const limit = this.rateLimits.get(key);

    if (!limit) {
      // First notification for this channel/alert combination
      this.rateLimits.set(key, {
        count: 1,
        windowStart: now,
        lastSent: now
      });
      return false;
    }

    // Check if we're in a new time window (1 hour)
    const windowDuration = 60 * 60 * 1000; // 1 hour
    if (now - limit.windowStart > windowDuration) {
      // Reset the window
      limit.count = 1;
      limit.windowStart = now;
      limit.lastSent = now;
      return false;
    }

    // Check rate limits based on severity
    const maxNotifications = alert.severity === 'critical' ? 10 : 3;
    const minInterval = alert.severity === 'critical' ? 5 * 60 * 1000 : 15 * 60 * 1000; // 5 or 15 minutes

    // Check count limit
    if (limit.count >= maxNotifications) {
      return true;
    }

    // Check time interval
    if (now - limit.lastSent < minInterval) {
      return true;
    }

    // Update limits
    limit.count++;
    limit.lastSent = now;
    return false;
  }

  async sendToChannel(channel, alert) {
    switch (channel.type) {
      case 'console':
        return this.sendConsoleNotification(channel, alert);
      case 'webhook':
        return this.sendWebhookNotification(channel, alert);
      case 'email':
        return this.sendEmailNotification(channel, alert);
      case 'database':
        return this.sendDatabaseNotification(channel, alert);
      case 'slack':
        return this.sendSlackNotification(channel, alert);
      default:
        throw new Error(`Unknown notification channel type: ${channel.type}`);
    }
  }

  async sendConsoleNotification(channel, alert) {
    const emoji = this.getSeverityEmoji(alert.severity);
    const timestamp = new Date().toLocaleTimeString();
    
    console.warn(`${emoji} [${timestamp}] ${alert.severity.toUpperCase()}: ${alert.message}`);
    
    if (alert.metadata) {
      console.warn('Alert metadata:', alert.metadata);
    }
  }

  async sendWebhookNotification(channel, alert) {
    const payload = {
      alert: {
        id: alert.id,
        name: alert.name,
        severity: alert.severity,
        message: alert.message,
        subject: alert.subject,
        timestamp: alert.timestamp,
        metadata: alert.metadata
      },
      notification: {
        channel: channel.name,
        timestamp: new Date().toISOString()
      },
      system: {
        source: 'image-converter-monitoring',
        environment: process.env.NODE_ENV || 'development'
      }
    };

    if (typeof fetch !== 'undefined') {
      const response = await fetch(channel.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...channel.headers
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Webhook notification failed: ${response.status} ${response.statusText}`);
      }

      return await response.json().catch(() => ({}));
    }
  }

  async sendEmailNotification(channel, alert) {
    // In a real implementation, this would use a service like SendGrid, SES, or SMTP
    const emailData = {
      from: channel.from,
      to: channel.to,
      subject: alert.subject || `Alert: ${alert.name}`,
      html: this.generateEmailHTML(alert),
      text: this.generateEmailText(alert)
    };

    this.logger.info('Email notification would be sent', emailData);
    
    // Simulate email sending
    return { messageId: `sim_${Date.now()}` };
  }

  async sendDatabaseNotification(channel, alert) {
    if (typeof fetch !== 'undefined') {
      const response = await fetch('/api/monitoring/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alert)
      });

      if (!response.ok) {
        throw new Error(`Database notification failed: ${response.status}`);
      }

      return await response.json();
    }
  }

  async sendSlackNotification(channel, alert) {
    const payload = {
      text: `${this.getSeverityEmoji(alert.severity)} *${alert.severity.toUpperCase()}*: ${alert.message}`,
      attachments: [
        {
          color: this.getSeverityColor(alert.severity),
          fields: [
            {
              title: 'Alert Name',
              value: alert.name,
              short: true
            },
            {
              title: 'Timestamp',
              value: alert.timestamp,
              short: true
            }
          ]
        }
      ]
    };

    if (typeof fetch !== 'undefined') {
      const response = await fetch(channel.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Slack notification failed: ${response.status}`);
      }
    }
  }

  applyTemplate(template, alert) {
    let result = template;
    
    // Replace placeholders with alert data
    result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return alert[key] || alert.metadata?.[key] || match;
    });
    
    return result;
  }

  generateEmailHTML(alert) {
    return `
      <html>
        <body style="font-family: Arial, sans-serif; margin: 20px;">
          <div style="border-left: 4px solid ${this.getSeverityColor(alert.severity)}; padding-left: 20px;">
            <h2 style="color: ${this.getSeverityColor(alert.severity)};">
              ${this.getSeverityEmoji(alert.severity)} ${alert.severity.toUpperCase()} Alert
            </h2>
            <h3>${alert.subject || alert.name}</h3>
            <p><strong>Message:</strong> ${alert.message}</p>
            <p><strong>Time:</strong> ${new Date(alert.timestamp).toLocaleString()}</p>
            ${alert.metadata ? `<p><strong>Details:</strong> <pre>${JSON.stringify(alert.metadata, null, 2)}</pre></p>` : ''}
          </div>
          <hr>
          <p style="color: #666; font-size: 12px;">
            This alert was generated by the Image Converter monitoring system.
          </p>
        </body>
      </html>
    `;
  }

  generateEmailText(alert) {
    return `
${alert.severity.toUpperCase()} ALERT: ${alert.subject || alert.name}

Message: ${alert.message}
Time: ${new Date(alert.timestamp).toLocaleString()}
${alert.metadata ? `Details: ${JSON.stringify(alert.metadata, null, 2)}` : ''}

---
This alert was generated by the Image Converter monitoring system.
    `.trim();
  }

  getSeverityEmoji(severity) {
    const emojis = {
      info: 'ℹ️',
      warning: '⚠️',
      critical: '🚨'
    };
    return emojis[severity] || '📢';
  }

  getSeverityColor(severity) {
    const colors = {
      info: '#2196F3',
      warning: '#FF9800',
      critical: '#F44336'
    };
    return colors[severity] || '#757575';
  }

  addToHistory(notification) {
    this.notificationHistory.push(notification);
    
    // Maintain history size limit
    if (this.notificationHistory.length > this.maxHistorySize) {
      this.notificationHistory.shift();
    }
  }

  generateNotificationId() {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getChannelStats() {
    const stats = {};
    
    for (const [name, channel] of this.channels.entries()) {
      stats[name] = {
        type: channel.type,
        enabled: channel.enabled,
        successCount: channel.successCount,
        failureCount: channel.failureCount,
        lastUsed: channel.lastUsed,
        successRate: channel.successCount + channel.failureCount > 0 
          ? (channel.successCount / (channel.successCount + channel.failureCount)) * 100 
          : 0
      };
    }
    
    return stats;
  }

  getNotificationHistory(limit = 50) {
    return this.notificationHistory.slice(-limit);
  }

  clearRateLimits() {
    this.rateLimits.clear();
    this.logger.info('Rate limits cleared');
  }

  // Test notification functionality
  async sendTestNotification(channelName = null, severity = 'warning') {
    const testAlert = {
      id: 'test_alert_' + Date.now(),
      name: 'test_notification',
      severity,
      message: 'This is a test notification to verify the notification system is working correctly.',
      subject: 'Test Notification',
      timestamp: new Date().toISOString(),
      metadata: {
        test: true,
        environment: process.env.NODE_ENV || 'development'
      }
    };

    if (channelName) {
      const channel = this.channels.get(channelName);
      if (!channel) {
        throw new Error(`Channel '${channelName}' not found`);
      }
      
      await this.sendToChannel(channel, testAlert);
      this.logger.info('Test notification sent to specific channel', { channelName });
    } else {
      await this.sendNotification(testAlert);
      this.logger.info('Test notification sent to all eligible channels');
    }

    return testAlert;
  }
}

// Global notification manager instance
const notificationManager = new NotificationManager();

// CommonJS exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    NotificationManager,
    notificationManager
  };
} else {
  // ES6 exports for browser
  window.NotificationManager = NotificationManager;
  window.notificationManager = notificationManager;
}

// Export for ES6 modules
if (typeof window === 'undefined') {
  module.exports.default = NotificationManager;
}