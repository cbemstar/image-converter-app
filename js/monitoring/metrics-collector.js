/**
 * Metrics collection system for monitoring usage, performance, and errors
 * Implements requirement 17.1 and 17.7: Metrics collection and webhook monitoring
 */

// Import logger based on environment
let createLogger;
if (typeof require !== 'undefined') {
  createLogger = require('./logger.js').createLogger;
} else {
  createLogger = window.createLogger;
}

class MetricsCollector {
  constructor() {
    this.logger = createLogger('metrics');
    this.metrics = new Map();
    this.counters = new Map();
    this.timers = new Map();
    this.histograms = new Map();
    
    // Initialize webhook-specific metrics per requirement 17.7
    this.initializeWebhookMetrics();
    
    // Start periodic metrics shipping
    this.startMetricsShipping();
  }

  initializeWebhookMetrics() {
    this.counters.set('webhook_success_total', 0);
    this.counters.set('webhook_failure_total', 0);
    this.counters.set('webhook_retry_total', 0);
    this.counters.set('quota_write_success_total', 0);
    this.counters.set('quota_write_failure_total', 0);
    this.histograms.set('webhook_latency_ms', []);
    this.histograms.set('quota_write_latency_ms', []);
  }

  // Counter methods
  incrementCounter(name, value = 1, labels = {}) {
    const key = this.getMetricKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
    
    this.logger.debug('Counter incremented', {
      metric: name,
      value: current + value,
      labels
    });
  }

  getCounter(name, labels = {}) {
    const key = this.getMetricKey(name, labels);
    return this.counters.get(key) || 0;
  }

  // Get aggregated counter value across all labels
  getAggregatedCounter(name) {
    let total = 0;
    for (const [key, value] of this.counters.entries()) {
      if (key.startsWith(name)) {
        total += value;
      }
    }
    return total;
  }

  // Histogram methods for latency tracking
  recordHistogram(name, value, labels = {}) {
    const key = this.getMetricKey(name, labels);
    if (!this.histograms.has(key)) {
      this.histograms.set(key, []);
    }
    
    const values = this.histograms.get(key);
    values.push({
      value,
      timestamp: Date.now()
    });
    
    // Keep only last 1000 values to prevent memory issues
    if (values.length > 1000) {
      values.shift();
    }
    
    this.logger.debug('Histogram value recorded', {
      metric: name,
      value,
      labels
    });
  }

  getHistogramStats(name, labels = {}) {
    const key = this.getMetricKey(name, labels);
    const values = this.histograms.get(key) || [];
    
    if (values.length === 0) {
      return { count: 0, min: 0, max: 0, avg: 0, p95: 0, p99: 0 };
    }
    
    const sortedValues = values.map(v => v.value).sort((a, b) => a - b);
    const count = sortedValues.length;
    const sum = sortedValues.reduce((a, b) => a + b, 0);
    
    return {
      count,
      min: sortedValues[0],
      max: sortedValues[count - 1],
      avg: sum / count,
      p95: sortedValues[Math.floor(count * 0.95)],
      p99: sortedValues[Math.floor(count * 0.99)]
    };
  }

  // Get aggregated histogram stats across all labels
  getAggregatedHistogramStats(name) {
    let allValues = [];
    
    for (const [key, values] of this.histograms.entries()) {
      if (key.startsWith(name)) {
        allValues = allValues.concat(values.map(v => v.value));
      }
    }
    
    if (allValues.length === 0) {
      return { count: 0, min: 0, max: 0, avg: 0, p95: 0, p99: 0 };
    }
    
    const sortedValues = allValues.sort((a, b) => a - b);
    const count = sortedValues.length;
    const sum = sortedValues.reduce((a, b) => a + b, 0);
    
    return {
      count,
      min: sortedValues[0],
      max: sortedValues[count - 1],
      avg: sum / count,
      p95: sortedValues[Math.floor(count * 0.95)],
      p99: sortedValues[Math.floor(count * 0.99)]
    };
  }

  // Timer methods for measuring operation duration
  startTimer(name, labels = {}) {
    const key = this.getMetricKey(name, labels);
    this.timers.set(key, Date.now());
    return key;
  }

  endTimer(timerKey) {
    const startTime = this.timers.get(timerKey);
    if (!startTime) {
      this.logger.warn('Timer not found', { timerKey });
      return 0;
    }
    
    const duration = Date.now() - startTime;
    this.timers.delete(timerKey);
    
    // Extract metric name from key for histogram recording
    const [name] = timerKey.split('|');
    const labels = this.parseLabelsFromKey(timerKey);
    this.recordHistogram(`${name}_duration_ms`, duration, labels);
    
    return duration;
  }

  // Specialized methods for specific metrics per requirements

  // Conversion metrics
  recordConversion(userId, success, processingTime, fileSize) {
    this.incrementCounter('conversions_total', 1, { success: success.toString() });
    this.recordHistogram('conversion_processing_time_ms', processingTime);
    this.recordHistogram('conversion_file_size_bytes', fileSize);
    
    this.logger.info('Conversion metrics recorded', {
      userId,
      success,
      processingTime,
      fileSize
    });
  }

  // Webhook metrics per requirement 17.7
  recordWebhookSuccess(eventType, latency) {
    this.incrementCounter('webhook_success_total', 1, { event_type: eventType });
    this.recordHistogram('webhook_latency_ms', latency, { event_type: eventType });
    
    this.logger.info('Webhook success recorded', {
      eventType,
      latency
    });
  }

  recordWebhookFailure(eventType, latency, error) {
    this.incrementCounter('webhook_failure_total', 1, { 
      event_type: eventType,
      error_type: error.name || 'unknown'
    });
    this.recordHistogram('webhook_latency_ms', latency, { event_type: eventType });
    
    this.logger.error('Webhook failure recorded', {
      eventType,
      latency,
      error: error.message
    });
  }

  recordWebhookRetry(eventType, attempt) {
    this.incrementCounter('webhook_retry_total', 1, { 
      event_type: eventType,
      attempt: attempt.toString()
    });
    
    this.logger.warn('Webhook retry recorded', {
      eventType,
      attempt
    });
  }

  // Quota write metrics per requirement 17.7
  recordQuotaWriteSuccess(latency) {
    this.incrementCounter('quota_write_success_total');
    this.recordHistogram('quota_write_latency_ms', latency);
    
    this.logger.debug('Quota write success recorded', { latency });
  }

  recordQuotaWriteFailure(latency, error) {
    this.incrementCounter('quota_write_failure_total', 1, {
      error_type: error.name || 'unknown'
    });
    this.recordHistogram('quota_write_latency_ms', latency);
    
    this.logger.error('Quota write failure recorded', {
      latency,
      error: error.message
    });
  }

  // Usage pattern metrics
  recordUsagePattern(userId, planType, quotaUsed, quotaLimit) {
    const utilizationPercent = (quotaUsed / quotaLimit) * 100;
    
    this.recordHistogram('quota_utilization_percent', utilizationPercent, {
      plan_type: planType
    });
    
    this.logger.info('Usage pattern recorded', {
      userId,
      planType,
      quotaUsed,
      quotaLimit,
      utilizationPercent
    });
  }

  // Error rate metrics
  recordError(component, errorType, severity = 'error') {
    this.incrementCounter('errors_total', 1, {
      component,
      error_type: errorType,
      severity
    });
    
    this.logger.error('Error metrics recorded', {
      component,
      errorType,
      severity
    });
  }

  // Performance metrics
  recordPerformanceMetric(operation, duration, success = true) {
    this.recordHistogram('operation_duration_ms', duration, {
      operation,
      success: success.toString()
    });
    
    this.logger.info('Performance metric recorded', {
      operation,
      duration,
      success
    });
  }

  // Utility methods
  getMetricKey(name, labels = {}) {
    const labelString = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    
    return labelString ? `${name}|${labelString}` : name;
  }

  parseLabelsFromKey(key) {
    const [, labelString] = key.split('|');
    if (!labelString) return {};
    
    return labelString.split(',').reduce((acc, pair) => {
      const [k, v] = pair.split('=');
      acc[k] = v;
      return acc;
    }, {});
  }

  // Get all metrics for shipping
  getAllMetrics() {
    const timestamp = new Date().toISOString();
    
    return {
      timestamp,
      counters: Object.fromEntries(this.counters),
      histograms: Object.fromEntries(
        Array.from(this.histograms.entries()).map(([key, values]) => [
          key,
          this.getHistogramStats(key.split('|')[0], this.parseLabelsFromKey(key))
        ])
      )
    };
  }

  // Periodic metrics shipping
  startMetricsShipping() {
    // Only start shipping in browser environment, not in tests
    if (typeof window !== 'undefined' && typeof jest === 'undefined') {
      // Ship metrics every 60 seconds
      setInterval(() => {
        this.shipMetrics();
      }, 60000);
    }
  }

  async shipMetrics() {
    try {
      const metrics = this.getAllMetrics();
      
      // Ship to monitoring endpoint
      if (typeof fetch !== 'undefined') {
        await fetch('/api/metrics', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(metrics)
        });
      }
      
      this.logger.debug('Metrics shipped successfully', {
        metricsCount: Object.keys(metrics.counters).length + Object.keys(metrics.histograms).length
      });
      
    } catch (error) {
      this.logger.error('Failed to ship metrics', {
        error: error.message
      });
    }
  }

  // Get webhook success rate for dashboards
  getWebhookSuccessRate() {
    let successes = 0;
    let failures = 0;
    
    // Aggregate across all labels
    for (const [key, value] of this.counters.entries()) {
      if (key.startsWith('webhook_success_total')) {
        successes += value;
      } else if (key.startsWith('webhook_failure_total')) {
        failures += value;
      }
    }
    
    const total = successes + failures;
    return total > 0 ? (successes / total) * 100 : 100;
  }

  // Get quota write failure rate
  getQuotaWriteFailureRate() {
    let successes = 0;
    let failures = 0;
    
    // Aggregate across all labels
    for (const [key, value] of this.counters.entries()) {
      if (key.startsWith('quota_write_success_total')) {
        successes += value;
      } else if (key.startsWith('quota_write_failure_total')) {
        failures += value;
      }
    }
    
    const total = successes + failures;
    return total > 0 ? (failures / total) * 100 : 0;
  }
}

// Global metrics collector instance
const metricsCollector = new MetricsCollector();

// CommonJS exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MetricsCollector,
    metricsCollector
  };
} else {
  // ES6 exports for browser
  window.MetricsCollector = MetricsCollector;
  window.metricsCollector = metricsCollector;
}