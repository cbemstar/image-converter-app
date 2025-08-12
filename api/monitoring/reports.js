/**
 * API endpoint for analytics reports
 * Implements requirement 17.3, 17.6: Weekly reports and analytics
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    switch (req.method) {
      case 'GET':
        return await handleGetReports(req, res);
      case 'POST':
        return await handleGenerateReport(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Reports API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleGetReports(req, res) {
  const { type, period, format } = req.query;

  try {
    if (type === 'templates') {
      return res.status(200).json({
        templates: getAvailableReportTemplates()
      });
    }

    if (type === 'history') {
      const history = await getReportHistory();
      return res.status(200).json({ history });
    }

    // Generate specific report type
    const report = await generateReport(type || 'system_summary', {
      period: period || '7d',
      format: format || 'json'
    });

    return res.status(200).json({ report });

  } catch (error) {
    console.error('Failed to get reports:', error);
    return res.status(500).json({ error: 'Failed to get reports' });
  }
}

async function handleGenerateReport(req, res) {
  const { templateName, options = {} } = req.body;

  if (!templateName) {
    return res.status(400).json({ error: 'Template name is required' });
  }

  try {
    const report = await generateReport(templateName, options);
    
    // Store report in database
    await storeReport(report);

    return res.status(201).json({ 
      success: true, 
      report: {
        id: report.id,
        name: report.name,
        generatedAt: report.generatedAt,
        format: report.format,
        sections: Object.keys(report.sections)
      }
    });

  } catch (error) {
    console.error('Failed to generate report:', error);
    return res.status(500).json({ error: 'Failed to generate report' });
  }
}

async function generateReport(templateName, options = {}) {
  const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const period = options.period || '7d';
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - parsePeriod(period));

  const report = {
    id: reportId,
    templateName,
    name: getReportName(templateName),
    generatedAt: new Date().toISOString(),
    generatedBy: options.generatedBy || 'api',
    format: options.format || 'json',
    period: `${startTime.toISOString()} to ${endTime.toISOString()}`,
    sections: {},
    metadata: {
      generationTime: 0,
      dataPoints: 0
    }
  };

  const startGeneration = Date.now();

  try {
    // Generate report sections based on template
    switch (templateName) {
      case 'system_summary':
        report.sections = await generateSystemSummary(startTime, endTime);
        break;
      case 'performance_report':
        report.sections = await generatePerformanceReport(startTime, endTime);
        break;
      case 'usage_analytics':
        report.sections = await generateUsageAnalytics(startTime, endTime);
        break;
      case 'error_analysis':
        report.sections = await generateErrorAnalysis(startTime, endTime);
        break;
      case 'webhook_report':
        report.sections = await generateWebhookReport(startTime, endTime);
        break;
      case 'business_metrics':
        report.sections = await generateBusinessMetrics(startTime, endTime);
        break;
      default:
        throw new Error(`Unknown report template: ${templateName}`);
    }

    report.metadata.generationTime = Date.now() - startGeneration;
    report.metadata.dataPoints = countDataPoints(report.sections);

    return report;

  } catch (error) {
    console.error('Report generation failed:', error);
    throw error;
  }
}

async function generateSystemSummary(startTime, endTime) {
  // Get metrics from database
  const metrics = await getMetricsFromDatabase(startTime, endTime);
  const alerts = await getAlertsFromDatabase(startTime, endTime);
  const logs = await getLogsFromDatabase(startTime, endTime);

  return {
    overview: {
      title: 'System Overview',
      period: `${startTime.toISOString()} to ${endTime.toISOString()}`,
      status: calculateOverallStatus(metrics, alerts),
      uptime: calculateUptime(logs),
      totalRequests: metrics.requests?.total || 0,
      errorRate: calculateErrorRate(metrics),
      averageResponseTime: metrics.performance?.avgResponseTime || 0
    },
    performance: {
      title: 'Performance Metrics',
      responseTime: {
        average: metrics.performance?.avgResponseTime || 0,
        p95: metrics.performance?.p95ResponseTime || 0,
        p99: metrics.performance?.p99ResponseTime || 0
      },
      throughput: metrics.requests?.throughput || 0,
      resourceUsage: getResourceUsage()
    },
    reliability: {
      title: 'Reliability Metrics',
      errorRate: calculateErrorRate(metrics),
      webhookSuccessRate: metrics.webhooks?.successRate || 100,
      quotaWriteFailureRate: metrics.quota?.failureRate || 0,
      activeAlerts: alerts.active?.length || 0,
      criticalAlerts: alerts.critical?.length || 0
    },
    usage: {
      title: 'Usage Statistics',
      totalConversions: metrics.conversions?.total || 0,
      successfulConversions: metrics.conversions?.successful || 0,
      failedConversions: metrics.conversions?.failed || 0,
      activeUsers: metrics.users?.active || 0,
      dataProcessed: metrics.conversions?.totalDataProcessed || 0
    }
  };
}

async function generatePerformanceReport(startTime, endTime) {
  const performanceMetrics = await getPerformanceMetrics(startTime, endTime);
  
  return {
    summary: {
      title: 'Performance Summary',
      period: `${startTime.toISOString()} to ${endTime.toISOString()}`,
      overallScore: calculatePerformanceScore(performanceMetrics),
      recommendations: generatePerformanceRecommendations(performanceMetrics)
    },
    responseTime: {
      title: 'Response Time Analysis',
      trends: performanceMetrics.responseTimeTrends || [],
      distribution: performanceMetrics.responseTimeDistribution || {},
      slowestEndpoints: performanceMetrics.slowestEndpoints || []
    },
    throughput: {
      title: 'Throughput Analysis',
      requestsPerSecond: performanceMetrics.throughput?.rps || 0,
      peakThroughput: performanceMetrics.throughput?.peak || 0,
      throughputTrends: performanceMetrics.throughputTrends || []
    },
    resources: {
      title: 'Resource Utilization',
      cpu: performanceMetrics.resources?.cpu || {},
      memory: performanceMetrics.resources?.memory || {},
      storage: performanceMetrics.resources?.storage || {}
    }
  };
}

async function generateUsageAnalytics(startTime, endTime) {
  const usageMetrics = await getUsageMetrics(startTime, endTime);
  
  return {
    overview: {
      title: 'Usage Overview',
      period: `${startTime.toISOString()} to ${endTime.toISOString()}`,
      totalConversions: usageMetrics.conversions?.total || 0,
      uniqueUsers: usageMetrics.users?.unique || 0,
      averageConversionsPerUser: usageMetrics.conversions?.avgPerUser || 0
    },
    conversions: {
      title: 'Conversion Analytics',
      byFormat: usageMetrics.conversions?.byFormat || {},
      bySize: usageMetrics.conversions?.bySize || {},
      trends: usageMetrics.conversions?.trends || [],
      peakHours: usageMetrics.conversions?.peakHours || []
    },
    users: {
      title: 'User Analytics',
      newUsers: usageMetrics.users?.new || 0,
      returningUsers: usageMetrics.users?.returning || 0,
      retentionRate: usageMetrics.users?.retentionRate || 0,
      segments: usageMetrics.users?.segments || {}
    },
    geographic: {
      title: 'Geographic Distribution',
      byCountry: usageMetrics.geographic?.byCountry || {},
      byRegion: usageMetrics.geographic?.byRegion || {}
    }
  };
}

async function generateErrorAnalysis(startTime, endTime) {
  const errorMetrics = await getErrorMetrics(startTime, endTime);
  
  return {
    summary: {
      title: 'Error Summary',
      period: `${startTime.toISOString()} to ${endTime.toISOString()}`,
      totalErrors: errorMetrics.total || 0,
      errorRate: errorMetrics.rate || 0,
      trend: errorMetrics.trend || 'stable'
    },
    breakdown: {
      title: 'Error Breakdown',
      byComponent: errorMetrics.byComponent || {},
      byType: errorMetrics.byType || {},
      bySeverity: errorMetrics.bySeverity || {}
    },
    patterns: {
      title: 'Error Patterns',
      timeDistribution: errorMetrics.timeDistribution || [],
      correlations: errorMetrics.correlations || [],
      rootCauses: errorMetrics.rootCauses || []
    },
    recommendations: {
      title: 'Recommendations',
      immediate: errorMetrics.recommendations?.immediate || [],
      longTerm: errorMetrics.recommendations?.longTerm || []
    }
  };
}

async function generateWebhookReport(startTime, endTime) {
  const webhookMetrics = await getWebhookMetrics(startTime, endTime);
  
  return {
    performance: {
      title: 'Webhook Performance',
      period: `${startTime.toISOString()} to ${endTime.toISOString()}`,
      successRate: webhookMetrics.successRate || 100,
      averageLatency: webhookMetrics.avgLatency || 0,
      p95Latency: webhookMetrics.p95Latency || 0,
      totalWebhooks: webhookMetrics.total || 0
    },
    reliability: {
      title: 'Reliability Metrics',
      retryRate: webhookMetrics.retryRate || 0,
      failuresByType: webhookMetrics.failuresByType || {},
      downtimeEvents: webhookMetrics.downtimeEvents || []
    },
    trends: {
      title: 'Trends Analysis',
      volumeTrends: webhookMetrics.volumeTrends || [],
      latencyTrends: webhookMetrics.latencyTrends || [],
      successRateTrends: webhookMetrics.successRateTrends || []
    }
  };
}

async function generateBusinessMetrics(startTime, endTime) {
  const businessMetrics = await getBusinessMetrics(startTime, endTime);
  
  return {
    revenue: {
      title: 'Revenue Metrics',
      period: `${startTime.toISOString()} to ${endTime.toISOString()}`,
      totalRevenue: businessMetrics.revenue?.total || 0,
      recurringRevenue: businessMetrics.revenue?.recurring || 0,
      growth: businessMetrics.revenue?.growth || 0
    },
    subscriptions: {
      title: 'Subscription Metrics',
      active: businessMetrics.subscriptions?.active || 0,
      new: businessMetrics.subscriptions?.new || 0,
      canceled: businessMetrics.subscriptions?.canceled || 0,
      churnRate: businessMetrics.subscriptions?.churnRate || 0
    },
    usage: {
      title: 'Usage-Based Metrics',
      conversionVolume: businessMetrics.usage?.conversions || 0,
      averageUsagePerUser: businessMetrics.usage?.avgPerUser || 0,
      highValueUsers: businessMetrics.usage?.highValueUsers || []
    }
  };
}

// Utility functions
function parsePeriod(period) {
  const match = period.match(/^(\d+)([hdwm])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // Default to 7 days

  const [, amount, unit] = match;
  const multipliers = {
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    m: 30 * 24 * 60 * 60 * 1000
  };

  return parseInt(amount) * multipliers[unit];
}

function getReportName(templateName) {
  const names = {
    system_summary: 'System Summary Report',
    performance_report: 'Performance Analysis Report',
    usage_analytics: 'Usage Analytics Report',
    error_analysis: 'Error Analysis Report',
    webhook_report: 'Webhook Performance Report',
    business_metrics: 'Business Metrics Report'
  };
  
  return names[templateName] || 'Custom Report';
}

function getAvailableReportTemplates() {
  return [
    {
      name: 'system_summary',
      title: 'System Summary',
      description: 'Comprehensive overview of system health and performance',
      sections: ['overview', 'performance', 'reliability', 'usage']
    },
    {
      name: 'performance_report',
      title: 'Performance Analysis',
      description: 'Detailed analysis of system performance metrics',
      sections: ['summary', 'responseTime', 'throughput', 'resources']
    },
    {
      name: 'usage_analytics',
      title: 'Usage Analytics',
      description: 'User behavior and conversion analytics',
      sections: ['overview', 'conversions', 'users', 'geographic']
    },
    {
      name: 'error_analysis',
      title: 'Error Analysis',
      description: 'Comprehensive error tracking and analysis',
      sections: ['summary', 'breakdown', 'patterns', 'recommendations']
    },
    {
      name: 'webhook_report',
      title: 'Webhook Performance',
      description: 'Webhook reliability and performance metrics',
      sections: ['performance', 'reliability', 'trends']
    },
    {
      name: 'business_metrics',
      title: 'Business Metrics',
      description: 'Revenue, subscriptions, and business analytics',
      sections: ['revenue', 'subscriptions', 'usage']
    }
  ];
}

// Database query functions (simplified - would be more complex in production)
async function getMetricsFromDatabase(startTime, endTime) {
  try {
    const { data: metrics } = await supabase
      .from('system_metrics')
      .select('*')
      .gte('timestamp', startTime.toISOString())
      .lte('timestamp', endTime.toISOString());

    return processMetricsData(metrics || []);
  } catch (error) {
    console.error('Failed to get metrics from database:', error);
    return {};
  }
}

async function getAlertsFromDatabase(startTime, endTime) {
  try {
    const { data: alerts } = await supabase
      .from('system_alerts')
      .select('*')
      .gte('created_at', startTime.toISOString())
      .lte('created_at', endTime.toISOString());

    return {
      active: alerts?.filter(a => !a.resolved) || [],
      critical: alerts?.filter(a => a.severity === 'critical') || [],
      total: alerts?.length || 0
    };
  } catch (error) {
    console.error('Failed to get alerts from database:', error);
    return { active: [], critical: [], total: 0 };
  }
}

async function getLogsFromDatabase(startTime, endTime) {
  try {
    const { data: logs } = await supabase
      .from('system_logs')
      .select('*')
      .gte('timestamp', startTime.toISOString())
      .lte('timestamp', endTime.toISOString())
      .limit(1000);

    return logs || [];
  } catch (error) {
    console.error('Failed to get logs from database:', error);
    return [];
  }
}

function processMetricsData(metrics) {
  // Process raw metrics data into structured format
  const processed = {
    requests: { total: 0, throughput: 0 },
    performance: { avgResponseTime: 0, p95ResponseTime: 0, p99ResponseTime: 0 },
    webhooks: { successRate: 100 },
    quota: { failureRate: 0 },
    conversions: { total: 0, successful: 0, failed: 0 },
    users: { active: 0 }
  };

  // This would be more sophisticated in a real implementation
  metrics.forEach(metric => {
    switch (metric.metric_name) {
      case 'requests_total':
        processed.requests.total += metric.value;
        break;
      case 'response_time_ms':
        processed.performance.avgResponseTime = metric.value;
        break;
      // Add more metric processing as needed
    }
  });

  return processed;
}

function calculateOverallStatus(metrics, alerts) {
  const criticalAlerts = alerts.critical?.length || 0;
  const errorRate = calculateErrorRate(metrics);
  
  if (criticalAlerts > 0 || errorRate > 10) return 'critical';
  if (errorRate > 5) return 'warning';
  return 'healthy';
}

function calculateErrorRate(metrics) {
  const totalRequests = metrics.requests?.total || 1;
  const totalErrors = metrics.errors?.total || 0;
  return (totalErrors / totalRequests) * 100;
}

function calculateUptime(logs) {
  // Simplified uptime calculation
  return 99.9; // Would be calculated from actual logs
}

function getResourceUsage() {
  if (typeof process !== 'undefined') {
    const memoryUsage = process.memoryUsage();
    return {
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024)
      }
    };
  }
  return {};
}

function countDataPoints(sections) {
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
  
  countRecursive(sections);
  return count;
}

async function storeReport(report) {
  try {
    await supabase
      .from('generated_reports')
      .insert({
        report_id: report.id,
        template_name: report.templateName,
        name: report.name,
        generated_at: report.generatedAt,
        generated_by: report.generatedBy,
        format: report.format,
        period: report.period,
        sections: Object.keys(report.sections),
        metadata: report.metadata,
        content: report.sections
      });
  } catch (error) {
    console.error('Failed to store report:', error);
  }
}

async function getReportHistory() {
  try {
    const { data: reports } = await supabase
      .from('generated_reports')
      .select('report_id, template_name, name, generated_at, generated_by, format, metadata')
      .order('generated_at', { ascending: false })
      .limit(50);

    return reports || [];
  } catch (error) {
    console.error('Failed to get report history:', error);
    return [];
  }
}

// Placeholder functions for metrics that would come from actual data sources
async function getPerformanceMetrics() { return {}; }
async function getUsageMetrics() { return {}; }
async function getErrorMetrics() { return {}; }
async function getWebhookMetrics() { return {}; }
async function getBusinessMetrics() { return {}; }

function calculatePerformanceScore() { return 85; }
function generatePerformanceRecommendations() { return []; }