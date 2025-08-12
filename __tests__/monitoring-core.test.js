/**
 * Core monitoring system tests
 * Tests requirement 17.1: Structured logging and metrics collection
 * Tests requirement 17.7: Webhook success rate, latency, and quota write failures
 */

const { MetricsCollector } = require('../js/monitoring/metrics-collector.js');
const { createLogger } = require('../js/monitoring/logger.js');

// Mock fetch for testing
global.fetch = jest.fn();

describe('Core Monitoring System', () => {
  let metricsCollector;
  
  beforeEach(() => {
    // Create fresh metrics collector for each test
    metricsCollector = new MetricsCollector();
    
    // Reset fetch mock
    fetch.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Logger', () => {
    it('should create structured log entries', () => {
      const logger = createLogger('test-component');
      
      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      logger.info('Test message', { key: 'value' });
      
      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      
      expect(logEntry).toMatchObject({
        level: 'info',
        component: 'test-component',
        message: 'Test message',
        metadata: expect.objectContaining({
          key: 'value'
        })
      });
      
      expect(logEntry.timestamp).toBeDefined();
      expect(logEntry.sessionId).toBeDefined();
      
      consoleSpy.mockRestore();
    });

    it('should log conversion events correctly', () => {
      const logger = createLogger('conversion');
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      logger.logConversion('user-123', {
        originalFormat: 'png',
        targetFormat: 'webp',
        fileSize: 1024,
        processingTime: 500,
        success: true
      });
      
      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      
      expect(logEntry.metadata.event).toBe('conversion_completed');
      expect(logEntry.metadata.userId).toBe('user-123');
      expect(logEntry.metadata.originalFormat).toBe('png');
      expect(logEntry.metadata.targetFormat).toBe('webp');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Metrics Collector', () => {
    it('should increment counters correctly', () => {
      metricsCollector.incrementCounter('test_counter', 5);
      expect(metricsCollector.getCounter('test_counter')).toBe(5);
      
      metricsCollector.incrementCounter('test_counter', 3);
      expect(metricsCollector.getCounter('test_counter')).toBe(8);
    });

    it('should handle counters with labels', () => {
      metricsCollector.incrementCounter('requests_total', 1, { method: 'GET' });
      metricsCollector.incrementCounter('requests_total', 1, { method: 'POST' });
      metricsCollector.incrementCounter('requests_total', 2, { method: 'GET' });
      
      expect(metricsCollector.getCounter('requests_total', { method: 'GET' })).toBe(3);
      expect(metricsCollector.getCounter('requests_total', { method: 'POST' })).toBe(1);
    });

    it('should record histogram values', () => {
      metricsCollector.recordHistogram('response_time', 100);
      metricsCollector.recordHistogram('response_time', 200);
      metricsCollector.recordHistogram('response_time', 150);
      
      const stats = metricsCollector.getHistogramStats('response_time');
      
      expect(stats.count).toBe(3);
      expect(stats.min).toBe(100);
      expect(stats.max).toBe(200);
      expect(stats.avg).toBe(150);
    });

    it('should record webhook metrics correctly (requirement 17.7)', () => {
      metricsCollector.recordWebhookSuccess('checkout.session.completed', 250);
      metricsCollector.recordWebhookFailure('invoice.paid', 1000, new Error('Timeout'));
      
      expect(metricsCollector.getAggregatedCounter('webhook_success_total')).toBe(1);
      expect(metricsCollector.getAggregatedCounter('webhook_failure_total')).toBe(1);
      
      const latencyStats = metricsCollector.getAggregatedHistogramStats('webhook_latency_ms');
      expect(latencyStats.count).toBe(2);
    });

    it('should calculate webhook success rate correctly (requirement 17.7)', () => {
      metricsCollector.recordWebhookSuccess('test', 100);
      metricsCollector.recordWebhookSuccess('test', 150);
      metricsCollector.recordWebhookFailure('test', 200, new Error('Test error'));
      
      const successRate = metricsCollector.getWebhookSuccessRate();
      expect(successRate).toBeCloseTo(66.67, 1);
    });

    it('should record quota write metrics correctly (requirement 17.7)', () => {
      metricsCollector.recordQuotaWriteSuccess(50);
      metricsCollector.recordQuotaWriteFailure(100, new Error('Database error'));
      
      expect(metricsCollector.getAggregatedCounter('quota_write_success_total')).toBe(1);
      expect(metricsCollector.getAggregatedCounter('quota_write_failure_total')).toBe(1);
      
      const failureRate = metricsCollector.getQuotaWriteFailureRate();
      expect(failureRate).toBe(50);
    });

    it('should record conversion metrics correctly', () => {
      metricsCollector.recordConversion('user-123', true, 500, 1024);
      metricsCollector.recordConversion('user-456', false, 200, 2048);
      
      expect(metricsCollector.getCounter('conversions_total', { success: 'true' })).toBe(1);
      expect(metricsCollector.getCounter('conversions_total', { success: 'false' })).toBe(1);
      
      const processingStats = metricsCollector.getHistogramStats('conversion_processing_time_ms');
      expect(processingStats.count).toBe(2);
      expect(processingStats.avg).toBe(350);
    });

    it('should handle timers correctly', () => {
      const timerKey = metricsCollector.startTimer('operation_duration');
      
      // Simulate some work with a small delay
      const duration = metricsCollector.endTimer(timerKey);
      
      expect(duration).toBeGreaterThanOrEqual(0);
      
      const stats = metricsCollector.getHistogramStats('operation_duration_duration_ms');
      expect(stats.count).toBe(1);
    });

    it('should get all metrics for shipping', () => {
      metricsCollector.incrementCounter('test_counter', 5);
      metricsCollector.recordHistogram('test_histogram', 100);
      
      const allMetrics = metricsCollector.getAllMetrics();
      
      expect(allMetrics).toHaveProperty('timestamp');
      expect(allMetrics).toHaveProperty('counters');
      expect(allMetrics).toHaveProperty('histograms');
      expect(allMetrics.counters.test_counter).toBe(5);
      expect(allMetrics.histograms.test_histogram).toBeDefined();
    });
  });

  describe('Webhook Monitoring (Requirement 17.7)', () => {
    it('should track webhook success rate over time', () => {
      // Simulate a series of webhook events
      for (let i = 0; i < 10; i++) {
        metricsCollector.recordWebhookSuccess('test_event', 100 + i * 10);
      }
      
      for (let i = 0; i < 2; i++) {
        metricsCollector.recordWebhookFailure('test_event', 500, new Error('Test error'));
      }
      
      const successRate = metricsCollector.getWebhookSuccessRate();
      expect(successRate).toBeCloseTo(83.33, 1); // 10 successes out of 12 total
      
      const latencyStats = metricsCollector.getAggregatedHistogramStats('webhook_latency_ms');
      expect(latencyStats.count).toBe(12);
      expect(latencyStats.avg).toBeCloseTo(204, 0); // Average of all latencies
    });

    it('should track quota write failures', () => {
      // Simulate quota write operations
      for (let i = 0; i < 95; i++) {
        metricsCollector.recordQuotaWriteSuccess(50);
      }
      
      for (let i = 0; i < 5; i++) {
        metricsCollector.recordQuotaWriteFailure(100, new Error('Database timeout'));
      }
      
      const failureRate = metricsCollector.getQuotaWriteFailureRate();
      expect(failureRate).toBe(5); // 5% failure rate
      
      const latencyStats = metricsCollector.getAggregatedHistogramStats('quota_write_latency_ms');
      expect(latencyStats.count).toBe(100);
    });

    it('should handle webhook retry tracking', () => {
      metricsCollector.recordWebhookRetry('checkout.session.completed', 1);
      metricsCollector.recordWebhookRetry('checkout.session.completed', 2);
      metricsCollector.recordWebhookRetry('invoice.paid', 1);
      
      expect(metricsCollector.getAggregatedCounter('webhook_retry_total')).toBe(3);
      expect(metricsCollector.getCounter('webhook_retry_total', { 
        event_type: 'checkout.session.completed',
        attempt: '1'
      })).toBe(1);
    });
  });

  describe('Performance Metrics', () => {
    it('should record performance metrics correctly', () => {
      metricsCollector.recordPerformanceMetric('database_query', 150, true);
      metricsCollector.recordPerformanceMetric('database_query', 300, false);
      metricsCollector.recordPerformanceMetric('api_call', 500, true);
      
      const dbQueryStats = metricsCollector.getAggregatedHistogramStats('operation_duration_ms');
      
      expect(dbQueryStats.count).toBe(3); // All 3 operations recorded
      expect(dbQueryStats.avg).toBeCloseTo(316.67, 1); // (150 + 300 + 500) / 3
    });

    it('should track usage patterns', () => {
      metricsCollector.recordUsagePattern('user-1', 'free', 8, 10);
      metricsCollector.recordUsagePattern('user-2', 'pro', 45, 100);
      metricsCollector.recordUsagePattern('user-3', 'free', 10, 10);
      
      const utilizationStats = metricsCollector.getAggregatedHistogramStats('quota_utilization_percent');
      expect(utilizationStats.count).toBe(3);
      expect(utilizationStats.avg).toBeCloseTo(75, 1); // (80 + 45 + 100) / 3
    });
  });

  describe('Error Tracking', () => {
    it('should record errors by component and type', () => {
      metricsCollector.recordError('auth', 'login_failed', 'error');
      metricsCollector.recordError('auth', 'token_expired', 'warning');
      metricsCollector.recordError('conversion', 'file_too_large', 'error');
      
      expect(metricsCollector.getAggregatedCounter('errors_total')).toBe(3);
      expect(metricsCollector.getCounter('errors_total', { 
        component: 'auth',
        error_type: 'login_failed',
        severity: 'error'
      })).toBe(1);
      expect(metricsCollector.getCounter('errors_total', { 
        component: 'conversion',
        error_type: 'file_too_large',
        severity: 'error'
      })).toBe(1);
    });
  });
});