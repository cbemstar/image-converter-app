/**
 * Analytics and reporting engine for monitoring system
 * Implements requirement 17.3, 17.6: Weekly reports and system health monitoring
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

class AnalyticsEngine {
  constructor() {
    this.logger = createLogger('analytics');
    this.reports = new Map();
    this.scheduledReports = new Map();
    this.reportHistory = [];
    this.maxHistorySize = 100;
    
    this.initializeReportTemplates();
    this.startScheduledReporting();
  }

  initializeReportTemplates() {
    // Weekly usage and performance report (requirement 17.3)
    this.addReportTemplate('weekly_summary', {
      name: 'Weekly System Summary',
      description: 'Comprehensive weekly report covering usage, performance, and system health',
      schedule: 'weekly', // Every Monday at 9 AM
      sections: [
        'usage_metrics',
        'performance_metrics',
        'error_analysis',
        'webhook_performance',
        'quota_analysis',
        'system_health',
        'recommendations'
      ],
      recipients: ['admin@example.com'],
      format: 'html'
    });

    // Daily health report
    this.addReportTemplate('daily_health', {
      name: 'Daily Health Check',
      description: 'Daily system health and performance summary',
      schedule: 'daily', // Every day at 8 AM
      sections: [
        'system_health',
        'error_summary',
        'performance_summary',
        'alerts_summary'
      ],
      recipients: ['ops@example.com'],
      format: 'text'
    });

    // Monthly business report
    this.addReportTemplate('monthly_business', {
      name: 'Monthly Business Analytics',
      description: 'Monthly report focusing on business metrics and user behavior',
      schedule: 'monthly', // First day of month at 10 AM
      sections: [
        'user_analytics',
        'conversion_analytics',
        'billing_analytics',
        'growth_metrics',
        'revenue_analysis'
      ],
      recipients: ['business@example.com'],
      format: 'html'
    });
  }

  addReportTemplate(name, template) {
    this.reports.set(name, {
      ...template,
      name,
      lastGenerated: null,
      generationCount: 0
    });
    
    this.logger.info('Report template added', { templateName: name });
  }

  async generateReport(templateName, options = {}) {
    const template = this.reports.get(templateName);
    if (!template) {
      throw new Error(`Report template '${templateName}' not found`);
    }

    const reportId = this.generateReportId();
    const startTime = Date.now();

    this.logger.info('Generating report', { 
      reportId, 
      templateName, 
      sections: template.sections 
    });

    try {
      const report = {
        id: reportId,
        templateName,
        name: template.name,
        description: template.description,
        generatedAt: new Date().toISOString(),
        generatedBy: options.generatedBy || 'system',
        format: options.format || template.format,
        sections: {},
        metadata: {
          generationTime: 0,
          dataPoints: 0,
          period: options.period || this.getDefaultPeriod(template.schedule)
        }
      };

      // Generate each section
      for (const sectionName of template.sections) {
        try {
          report.sections[sectionName] = await this.generateSection(sectionName, report.metadata.period);
          report.metadata.dataPoints += this.countDataPoints(report.sections[sectionName]);
        } catch (error) {
          this.logger.error('Failed to generate report section', {
            reportId,
            sectionName,
            error: error.message
          });
          
          report.sections[sectionName] = {
            error: error.message,
            generated: false
          };
        }
      }

      report.metadata.generationTime = Date.now() - startTime;

      // Update template stats
      template.lastGenerated = report.generatedAt;
      template.generationCount++;

      // Add to history
      this.addToHistory(report);

      // Send report if recipients are specified
      if (template.recipients && template.recipients.length > 0) {
        await this.sendReport(report, template.recipients);
      }

      this.logger.info('Report generated successfully', {
        reportId,
        templateName,
        generationTime: report.metadata.generationTime,
        dataPoints: report.metadata.dataPoints
      });

      return report;

    } catch (error) {
      this.logger.error('Report generation failed', {
        reportId,
        templateName,
        error: error.message
      });
      throw error;
    }
  }

  async generateSection(sectionName, period) {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - this.parsePeriod(period));

    switch (sectionName) {
      case 'usage_metrics':
        return this.generateUsageMetrics(startTime, endTime);
      case 'performance_metrics':
        return this.generatePerformanceMetrics(startTime, endTime);
      case 'error_analysis':
        return this.generateErrorAnalysis(startTime, endTime);
      case 'webhook_performance':
        return this.generateWebhookPerformance(startTime, endTime);
      case 'quota_analysis':
        return this.generateQuotaAnalysis(startTime, endTime);
      case 'system_health':
        return this.generateSystemHealth(startTime, endTime);
      case 'recommendations':
        return this.generateRecommendations(startTime, endTime);
      case 'user_analytics':
        return this.generateUserAnalytics(startTime, endTime);
      case 'conversion_analytics':
        return this.generateConversionAnalytics(startTime, endTime);
      case 'billing_analytics':
        return this.generateBillingAnalytics(startTime, endTime);
      case 'growth_metrics':
        return this.generateGrowthMetrics(startTime, endTime);
      case 'revenue_analysis':
        return this.generateRevenueAnalysis(startTime, endTime);
      case 'error_summary':
        return this.generateErrorSummary(startTime, endTime);
      case 'performance_summary':
        return this.generatePerformanceSummary(startTime, endTime);
      case 'alerts_summary':
        return this.generateAlertsSummary(startTime, endTime);
      default:
        throw new Error(`Unknown report section: ${sectionName}`);
    }
  }

  async generateUsageMetrics(startTime, endTime) {
    const totalConversions = metricsCollector.getAggregatedCounter('conversions_total');
    const successfulConversions = metricsCollector.getCounter('conversions_total', { success: 'true' });
    const failedConversions = metricsCollector.getCounter('conversions_total', { success: 'false' });
    
    const conversionStats = metricsCollector.getAggregatedHistogramStats('conversion_processing_time_ms');
    const fileSizeStats = metricsCollector.getAggregatedHistogramStats('conversion_file_size_bytes');

    return {
      title: 'Usage Metrics',
      period: `${startTime.toISOString()} to ${endTime.toISOString()}`,
      metrics: {
        totalConversions,
        successfulConversions,
        failedConversions,
        successRate: totalConversions > 0 ? (successfulConversions / totalConversions) * 100 : 0,
        averageProcessingTime: conversionStats.avg || 0,
        medianProcessingTime: conversionStats.p50 || 0,
        p95ProcessingTime: conversionStats.p95 || 0,
        averageFileSize: fileSizeStats.avg || 0,
        totalDataProcessed: fileSizeStats.avg * totalConversions || 0
      },
      trends: {
        conversionGrowth: this.calculateGrowthRate('conversions_total', period),
        performanceImprovement: this.calculatePerformanceChange('conversion_processing_time_ms', period)
      }
    };
  }

  async generatePerformanceMetrics(startTime, endTime) {
    const operationStats = metricsCollector.getAggregatedHistogramStats('operation_duration_ms');
    const memoryUsage = this.getCurrentMemoryUsage();
    
    return {
      title: 'Performance Metrics',
      period: `${startTime.toISOString()} to ${endTime.toISOString()}`,
      metrics: {
        averageResponseTime: operationStats.avg || 0,
        p95ResponseTime: operationStats.p95 || 0,
        p99ResponseTime: operationStats.p99 || 0,
        totalOperations: operationStats.count || 0,
        memoryUsage: memoryUsage,
        slowestOperations: this.getSlowOperations(),
        performanceScore: this.calculatePerformanceScore(operationStats)
      },
      alerts: this.getPerformanceAlerts()
    };
  }

  async generateErrorAnalysis(startTime, endTime) {
    const totalErrors = metricsCollector.getAggregatedCounter('errors_total');
    const errorsByComponent = this.getErrorsByComponent();
    const errorsByType = this.getErrorsByType();
    const errorsByTime = this.getErrorsByTimeWindow(startTime, endTime);

    return {
      title: 'Error Analysis',
      period: `${startTime.toISOString()} to ${endTime.toISOString()}`,
      summary: {
        totalErrors,
        errorRate: this.calculateErrorRate(),
        topErrorComponents: Object.entries(errorsByComponent)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5),
        topErrorTypes: Object.entries(errorsByType)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
      },
      trends: {
        errorsByHour: errorsByTime,
        errorGrowthRate: this.calculateGrowthRate('errors_total', period)
      },
      recommendations: this.generateErrorRecommendations(errorsByComponent, errorsByType)
    };
  }

  async generateWebhookPerformance(startTime, endTime) {
    const successRate = metricsCollector.getWebhookSuccessRate();
    const latencyStats = metricsCollector.getAggregatedHistogramStats('webhook_latency_ms');
    const retryCount = metricsCollector.getAggregatedCounter('webhook_retry_total');
    
    return {
      title: 'Webhook Performance',
      period: `${startTime.toISOString()} to ${endTime.toISOString()}`,
      metrics: {
        successRate,
        averageLatency: latencyStats.avg || 0,
        p95Latency: latencyStats.p95 || 0,
        totalWebhooks: latencyStats.count || 0,
        totalRetries: retryCount,
        retryRate: latencyStats.count > 0 ? (retryCount / latencyStats.count) * 100 : 0
      },
      healthStatus: this.getWebhookHealthStatus(successRate, latencyStats.p95),
      recommendations: this.generateWebhookRecommendations(successRate, latencyStats.p95, retryCount)
    };
  }

  async generateQuotaAnalysis(startTime, endTime) {
    const quotaFailureRate = metricsCollector.getQuotaWriteFailureRate();
    const quotaLatencyStats = metricsCollector.getAggregatedHistogramStats('quota_write_latency_ms');
    const utilizationStats = metricsCollector.getAggregatedHistogramStats('quota_utilization_percent');

    return {
      title: 'Quota Analysis',
      period: `${startTime.toISOString()} to ${endTime.toISOString()}`,
      metrics: {
        writeFailureRate: quotaFailureRate,
        averageWriteLatency: quotaLatencyStats.avg || 0,
        p95WriteLatency: quotaLatencyStats.p95 || 0,
        totalWrites: quotaLatencyStats.count || 0,
        averageUtilization: utilizationStats.avg || 0,
        highUtilizationUsers: this.getHighUtilizationUsers()
      },
      trends: {
        utilizationTrend: this.calculateUtilizationTrend(period),
        writePerformanceTrend: this.calculateWritePerformanceTrend(period)
      }
    };
  }

  async generateSystemHealth(startTime, endTime) {
    const activeAlerts = this.getActiveAlertsCount();
    const systemUptime = this.calculateSystemUptime();
    const resourceUsage = this.getResourceUsage();

    return {
      title: 'System Health',
      period: `${startTime.toISOString()} to ${endTime.toISOString()}`,
      overall: {
        status: this.getOverallSystemStatus(),
        uptime: systemUptime,
        availability: this.calculateAvailability(startTime, endTime)
      },
      alerts: {
        active: activeAlerts,
        resolved: this.getResolvedAlertsCount(startTime, endTime),
        critical: this.getCriticalAlertsCount()
      },
      resources: resourceUsage,
      services: {
        authentication: this.getServiceHealth('auth'),
        billing: this.getServiceHealth('billing'),
        conversion: this.getServiceHealth('conversion'),
        storage: this.getServiceHealth('storage')
      }
    };
  }

  async generateRecommendations(startTime, endTime) {
    const recommendations = [];

    // Performance recommendations
    const performanceScore = this.calculatePerformanceScore();
    if (performanceScore < 80) {
      recommendations.push({
        category: 'performance',
        priority: 'high',
        title: 'Improve System Performance',
        description: `Current performance score is ${performanceScore}%. Consider optimizing slow operations and increasing resources.`,
        actions: [
          'Review and optimize slow database queries',
          'Implement caching for frequently accessed data',
          'Consider scaling up server resources'
        ]
      });
    }

    // Error rate recommendations
    const errorRate = this.calculateErrorRate();
    if (errorRate > 5) {
      recommendations.push({
        category: 'reliability',
        priority: 'high',
        title: 'Reduce Error Rate',
        description: `Current error rate is ${errorRate.toFixed(2)}%. Focus on fixing the most common error types.`,
        actions: [
          'Investigate and fix top error sources',
          'Implement better error handling',
          'Add more comprehensive input validation'
        ]
      });
    }

    // Webhook recommendations
    const webhookSuccessRate = metricsCollector.getWebhookSuccessRate();
    if (webhookSuccessRate < 95) {
      recommendations.push({
        category: 'integration',
        priority: 'critical',
        title: 'Improve Webhook Reliability',
        description: `Webhook success rate is ${webhookSuccessRate.toFixed(1)}%. This affects billing and user experience.`,
        actions: [
          'Implement exponential backoff for webhook retries',
          'Add webhook endpoint health monitoring',
          'Consider implementing a dead letter queue'
        ]
      });
    }

    return {
      title: 'Recommendations',
      period: `${startTime.toISOString()} to ${endTime.toISOString()}`,
      recommendations,
      summary: `Generated ${recommendations.length} recommendations based on system analysis.`
    };
  }

  // Additional section generators for business reports
  async generateUserAnalytics(startTime, endTime) {
    return {
      title: 'User Analytics',
      period: `${startTime.toISOString()} to ${endTime.toISOString()}`,
      metrics: {
        activeUsers: this.getActiveUsersCount(startTime, endTime),
        newUsers: this.getNewUsersCount(startTime, endTime),
        returningUsers: this.getReturningUsersCount(startTime, endTime),
        userRetentionRate: this.calculateUserRetentionRate(startTime, endTime),
        averageSessionDuration: this.getAverageSessionDuration(startTime, endTime)
      },
      segments: this.getUserSegments(startTime, endTime),
      behavior: this.getUserBehaviorAnalysis(startTime, endTime)
    };
  }

  async generateConversionAnalytics(startTime, endTime) {
    const formatStats = this.getConversionsByFormat(startTime, endTime);
    const sizeStats = this.getConversionsBySizeRange(startTime, endTime);

    return {
      title: 'Conversion Analytics',
      period: `${startTime.toISOString()} to ${endTime.toISOString()}`,
      overview: {
        totalConversions: metricsCollector.getAggregatedCounter('conversions_total'),
        popularFormats: formatStats,
        fileSizeDistribution: sizeStats,
        peakUsageHours: this.getPeakUsageHours(startTime, endTime)
      },
      trends: {
        dailyConversions: this.getDailyConversionTrend(startTime, endTime),
        formatTrends: this.getFormatTrends(startTime, endTime)
      }
    };
  }

  async generateBillingAnalytics(startTime, endTime) {
    return {
      title: 'Billing Analytics',
      period: `${startTime.toISOString()} to ${endTime.toISOString()}`,
      revenue: {
        totalRevenue: this.getTotalRevenue(startTime, endTime),
        recurringRevenue: this.getRecurringRevenue(startTime, endTime),
        oneTimeRevenue: this.getOneTimeRevenue(startTime, endTime),
        revenueGrowth: this.getRevenueGrowth(startTime, endTime)
      },
      subscriptions: {
        activeSubscriptions: this.getActiveSubscriptions(),
        newSubscriptions: this.getNewSubscriptions(startTime, endTime),
        canceledSubscriptions: this.getCanceledSubscriptions(startTime, endTime),
        churnRate: this.calculateChurnRate(startTime, endTime)
      },
      plans: this.getPlanAnalytics(startTime, endTime)
    };
  }

  // Utility methods
  getDefaultPeriod(schedule) {
    switch (schedule) {
      case 'daily': return '24h';
      case 'weekly': return '7d';
      case 'monthly': return '30d';
      default: return '24h';
    }
  }

  parsePeriod(period) {
    const match = period.match(/^(\d+)([hdwm])$/);
    if (!match) return 24 * 60 * 60 * 1000; // Default to 24 hours

    const [, amount, unit] = match;
    const multipliers = {
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
      w: 7 * 24 * 60 * 60 * 1000,
      m: 30 * 24 * 60 * 60 * 1000
    };

    return parseInt(amount) * multipliers[unit];
  }

  calculateGrowthRate(metricName, period) {
    // Simplified growth calculation - would be more sophisticated in production
    const current = metricsCollector.getAggregatedCounter(metricName);
    const previous = current * 0.8; // Simulated previous period data
    
    return previous > 0 ? ((current - previous) / previous) * 100 : 0;
  }

  calculatePerformanceScore(operationStats = null) {
    if (!operationStats) {
      operationStats = metricsCollector.getAggregatedHistogramStats('operation_duration_ms');
    }

    // Simple performance scoring based on response times
    const avgResponseTime = operationStats.avg || 0;
    const p95ResponseTime = operationStats.p95 || 0;

    let score = 100;
    
    // Deduct points for slow average response time
    if (avgResponseTime > 1000) score -= 30;
    else if (avgResponseTime > 500) score -= 15;
    else if (avgResponseTime > 200) score -= 5;

    // Deduct points for slow P95 response time
    if (p95ResponseTime > 5000) score -= 40;
    else if (p95ResponseTime > 2000) score -= 20;
    else if (p95ResponseTime > 1000) score -= 10;

    return Math.max(0, score);
  }

  calculateErrorRate() {
    const totalErrors = metricsCollector.getAggregatedCounter('errors_total');
    const totalRequests = metricsCollector.getAggregatedCounter('requests_total') || 1;
    
    return (totalErrors / totalRequests) * 100;
  }

  getCurrentMemoryUsage() {
    if (typeof process !== 'undefined') {
      const memoryUsage = process.memoryUsage();
      return {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024)
      };
    }
    return null;
  }

  // Placeholder methods for data that would come from database/external sources
  getActiveUsersCount() { return Math.floor(Math.random() * 1000) + 100; }
  getNewUsersCount() { return Math.floor(Math.random() * 100) + 10; }
  getReturningUsersCount() { return Math.floor(Math.random() * 500) + 50; }
  getTotalRevenue() { return Math.floor(Math.random() * 10000) + 1000; }
  getActiveSubscriptions() { return Math.floor(Math.random() * 200) + 50; }
  getActiveAlertsCount() { return Math.floor(Math.random() * 5); }
  getCriticalAlertsCount() { return Math.floor(Math.random() * 2); }

  getOverallSystemStatus() {
    const errorRate = this.calculateErrorRate();
    const webhookSuccessRate = metricsCollector.getWebhookSuccessRate();
    
    if (errorRate > 10 || webhookSuccessRate < 90) return 'critical';
    if (errorRate > 5 || webhookSuccessRate < 95) return 'warning';
    return 'healthy';
  }

  countDataPoints(section) {
    let count = 0;
    
    function countRecursive(obj) {
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          countRecursive(obj[key]);
        } else if (typeof obj[key] === 'number') {
          count++;
        }
      }
    }
    
    countRecursive(section);
    return count;
  }

  generateReportId() {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  addToHistory(report) {
    this.reportHistory.push({
      id: report.id,
      templateName: report.templateName,
      name: report.name,
      generatedAt: report.generatedAt,
      generatedBy: report.generatedBy,
      format: report.format,
      metadata: report.metadata
    });

    // Maintain history size limit
    if (this.reportHistory.length > this.maxHistorySize) {
      this.reportHistory.shift();
    }
  }

  async sendReport(report, recipients) {
    // In a real implementation, this would send the report via email or other channels
    this.logger.info('Report would be sent', {
      reportId: report.id,
      recipients,
      format: report.format
    });
  }

  startScheduledReporting() {
    // Check for scheduled reports every hour
    setInterval(() => {
      this.checkScheduledReports();
    }, 60 * 60 * 1000);

    this.logger.info('Scheduled reporting started');
  }

  async checkScheduledReports() {
    const now = new Date();
    
    for (const [templateName, template] of this.reports.entries()) {
      if (this.shouldGenerateReport(template, now)) {
        try {
          await this.generateReport(templateName);
          this.logger.info('Scheduled report generated', { templateName });
        } catch (error) {
          this.logger.error('Failed to generate scheduled report', {
            templateName,
            error: error.message
          });
        }
      }
    }
  }

  shouldGenerateReport(template, now) {
    if (!template.schedule || !template.lastGenerated) {
      return false;
    }

    const lastGenerated = new Date(template.lastGenerated);
    const timeSinceLastReport = now.getTime() - lastGenerated.getTime();

    switch (template.schedule) {
      case 'daily':
        return timeSinceLastReport > 24 * 60 * 60 * 1000;
      case 'weekly':
        return timeSinceLastReport > 7 * 24 * 60 * 60 * 1000 && now.getDay() === 1; // Monday
      case 'monthly':
        return timeSinceLastReport > 30 * 24 * 60 * 60 * 1000 && now.getDate() === 1; // First of month
      default:
        return false;
    }
  }

  getReportHistory(limit = 20) {
    return this.reportHistory.slice(-limit);
  }

  getReportTemplates() {
    return Array.from(this.reports.entries()).map(([name, template]) => ({
      name,
      title: template.name,
      description: template.description,
      schedule: template.schedule,
      sections: template.sections,
      lastGenerated: template.lastGenerated,
      generationCount: template.generationCount
    }));
  }
}

// Global analytics engine instance
const analyticsEngine = new AnalyticsEngine();

// CommonJS exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AnalyticsEngine,
    analyticsEngine
  };
} else {
  // ES6 exports for browser
  window.AnalyticsEngine = AnalyticsEngine;
  window.analyticsEngine = analyticsEngine;
}

// Export for ES6 modules
if (typeof window === 'undefined') {
  module.exports.default = AnalyticsEngine;
}