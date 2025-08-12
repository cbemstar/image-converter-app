/**
 * API endpoint for metrics collection and retrieval
 * Implements requirement 17.1: Metrics collection for usage, performance, and errors
 * Implements requirement 17.7: Webhook success rate, latency, and quota write failures
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
      case 'POST':
        return await handleMetricsIngestion(req, res);
      case 'GET':
        return await handleMetricsRetrieval(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Metrics API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleMetricsIngestion(req, res) {
  const metricsData = req.body;

  if (!metricsData || !metricsData.timestamp) {
    return res.status(400).json({ error: 'Invalid metrics format' });
  }

  try {
    // Store counter metrics
    if (metricsData.counters) {
      const counterInserts = Object.entries(metricsData.counters).map(([name, value]) => {
        const [metricName, labelString] = name.split('|');
        const labels = labelString ? parseLabels(labelString) : {};
        
        return {
          timestamp: metricsData.timestamp,
          metric_name: metricName,
          metric_type: 'counter',
          value: value,
          labels: labels
        };
      });

      if (counterInserts.length > 0) {
        const { error } = await supabase
          .from('system_metrics')
          .insert(counterInserts);

        if (error) {
          console.error('Failed to store counter metrics:', error);
        }
      }
    }

    // Store histogram metrics
    if (metricsData.histograms) {
      const histogramInserts = Object.entries(metricsData.histograms).map(([name, stats]) => {
        const [metricName, labelString] = name.split('|');
        const labels = labelString ? parseLabels(labelString) : {};
        
        return {
          timestamp: metricsData.timestamp,
          metric_name: metricName,
          metric_type: 'histogram',
          value: stats.avg,
          labels: {
            ...labels,
            count: stats.count,
            min: stats.min,
            max: stats.max,
            p95: stats.p95,
            p99: stats.p99
          }
        };
      });

      if (histogramInserts.length > 0) {
        const { error } = await supabase
          .from('system_metrics')
          .insert(histogramInserts);

        if (error) {
          console.error('Failed to store histogram metrics:', error);
        }
      }
    }

    // Check for anomalies and trigger alerts
    await checkMetricAnomalies(metricsData);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Metrics ingestion error:', error);
    return res.status(500).json({ error: 'Failed to ingest metrics' });
  }
}

async function handleMetricsRetrieval(req, res) {
  const {
    metric_name,
    metric_type,
    startTime,
    endTime,
    aggregation = 'avg',
    interval = '1h'
  } = req.query;

  try {
    let query = supabase
      .from('system_metrics')
      .select('*')
      .order('timestamp', { ascending: true });

    // Apply filters
    if (metric_name) {
      query = query.eq('metric_name', metric_name);
    }

    if (metric_type) {
      query = query.eq('metric_type', metric_type);
    }

    if (startTime) {
      query = query.gte('timestamp', startTime);
    }

    if (endTime) {
      query = query.lte('timestamp', endTime);
    }

    const { data: metrics, error } = await query;

    if (error) {
      console.error('Failed to retrieve metrics:', error);
      return res.status(500).json({ error: 'Failed to retrieve metrics' });
    }

    // Aggregate metrics by interval if requested
    const aggregatedMetrics = aggregateMetricsByInterval(metrics || [], interval, aggregation);

    return res.status(200).json({
      metrics: aggregatedMetrics,
      interval,
      aggregation
    });
  } catch (error) {
    console.error('Metrics retrieval error:', error);
    return res.status(500).json({ error: 'Failed to retrieve metrics' });
  }
}

function parseLabels(labelString) {
  return labelString.split(',').reduce((acc, pair) => {
    const [key, value] = pair.split('=');
    acc[key] = value;
    return acc;
  }, {});
}

function aggregateMetricsByInterval(metrics, interval, aggregation) {
  const intervalMs = parseInterval(interval);
  const buckets = new Map();

  metrics.forEach(metric => {
    const timestamp = new Date(metric.timestamp);
    const bucketTime = new Date(Math.floor(timestamp.getTime() / intervalMs) * intervalMs);
    const bucketKey = bucketTime.toISOString();

    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, []);
    }
    buckets.get(bucketKey).push(metric);
  });

  return Array.from(buckets.entries()).map(([timestamp, bucketMetrics]) => {
    const values = bucketMetrics.map(m => m.value);
    let aggregatedValue;

    switch (aggregation) {
      case 'sum':
        aggregatedValue = values.reduce((a, b) => a + b, 0);
        break;
      case 'max':
        aggregatedValue = Math.max(...values);
        break;
      case 'min':
        aggregatedValue = Math.min(...values);
        break;
      case 'count':
        aggregatedValue = values.length;
        break;
      case 'avg':
      default:
        aggregatedValue = values.reduce((a, b) => a + b, 0) / values.length;
        break;
    }

    return {
      timestamp,
      value: aggregatedValue,
      count: values.length,
      metric_name: bucketMetrics[0]?.metric_name,
      metric_type: bucketMetrics[0]?.metric_type
    };
  });
}

function parseInterval(interval) {
  const match = interval.match(/^(\d+)([smhd])$/);
  if (!match) return 60000; // Default to 1 minute

  const [, amount, unit] = match;
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  return parseInt(amount) * multipliers[unit];
}

async function checkMetricAnomalies(metricsData) {
  // Check webhook success rate (requirement 17.7)
  const webhookSuccesses = metricsData.counters?.['webhook_success_total'] || 0;
  const webhookFailures = metricsData.counters?.['webhook_failure_total'] || 0;
  const totalWebhooks = webhookSuccesses + webhookFailures;
  
  if (totalWebhooks > 0) {
    const successRate = (webhookSuccesses / totalWebhooks) * 100;
    
    if (successRate < 90) {
      await createAlert('webhook_success_rate_low', {
        successRate,
        totalWebhooks,
        threshold: 90
      });
    }
  }

  // Check quota write failure rate (requirement 17.7)
  const quotaSuccesses = metricsData.counters?.['quota_write_success_total'] || 0;
  const quotaFailures = metricsData.counters?.['quota_write_failure_total'] || 0;
  const totalQuotaWrites = quotaSuccesses + quotaFailures;
  
  if (totalQuotaWrites > 0) {
    const failureRate = (quotaFailures / totalQuotaWrites) * 100;
    
    if (failureRate > 5) {
      await createAlert('quota_write_failure_rate_high', {
        failureRate,
        totalQuotaWrites,
        threshold: 5
      });
    }
  }

  // Check webhook latency (requirement 17.7)
  const webhookLatency = metricsData.histograms?.['webhook_latency_ms'];
  if (webhookLatency && webhookLatency.p95 > 5000) {
    await createAlert('webhook_latency_high', {
      p95Latency: webhookLatency.p95,
      threshold: 5000
    });
  }

  // Check error rate
  const totalErrors = metricsData.counters?.['errors_total'] || 0;
  const totalRequests = metricsData.counters?.['requests_total'] || 1;
  const errorRate = (totalErrors / totalRequests) * 100;
  
  if (errorRate > 10) {
    await createAlert('error_rate_high', {
      errorRate,
      totalErrors,
      totalRequests,
      threshold: 10
    });
  }
}

async function createAlert(alertType, metadata) {
  try {
    await supabase
      .from('system_alerts')
      .insert({
        alert_type: alertType,
        severity: getSeverity(alertType),
        message: generateAlertMessage(alertType, metadata),
        metadata: metadata,
        created_at: new Date().toISOString()
      });

    console.warn(`ALERT: ${alertType}`, metadata);
  } catch (error) {
    console.error('Failed to create alert:', error);
  }
}

function getSeverity(alertType) {
  const severityMap = {
    webhook_success_rate_low: 'critical',
    quota_write_failure_rate_high: 'critical',
    webhook_latency_high: 'warning',
    error_rate_high: 'critical'
  };
  
  return severityMap[alertType] || 'warning';
}

function generateAlertMessage(alertType, metadata) {
  switch (alertType) {
    case 'webhook_success_rate_low':
      return `Webhook success rate dropped to ${metadata.successRate.toFixed(1)}% (threshold: ${metadata.threshold}%)`;
    case 'quota_write_failure_rate_high':
      return `Quota write failure rate increased to ${metadata.failureRate.toFixed(1)}% (threshold: ${metadata.threshold}%)`;
    case 'webhook_latency_high':
      return `Webhook P95 latency increased to ${metadata.p95Latency}ms (threshold: ${metadata.threshold}ms)`;
    case 'error_rate_high':
      return `Error rate increased to ${metadata.errorRate.toFixed(1)}% (threshold: ${metadata.threshold}%)`;
    default:
      return `Alert: ${alertType}`;
  }
}