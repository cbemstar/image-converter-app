/**
 * Test suite for monitoring and observability system
 * Tests requirement 17.1: Structured logging and metrics collection
 * Tests requirement 17.7: Webhook success rate, latency, and quota write failures
 */

const { metricsCollector } = require('../js/monitoring/metrics-collector.js');
const { createLogger } = require('../js/monitoring/logger.js');
const { logAggregator } = require('../js/monitoring/log-aggregator.js');
const { monitoringIntegration } = require('../js/monitoring/monitoring-integration.js');

// Mock fetch for testing
global.fetch = jest.fn();

describe('Monitoring System', () => {
  beforeEach(() => {
    // Reset metrics collector
    metricsCollector.counters.clear();
    metricsCollector.histograms.clear();
    metricsCollector.timers.clear();

    // Clear logs
    logAggregator.logs.length = 0;
    logAggregator.searchIndex.clear();

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
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { });

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

    it('should respect log levels', () => {
      const logger = createLogger('test-component');
      logger.logLevel = 'warn';

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { });

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      // Only warn and error should be logged
      expect(consoleSpy).toHaveBeenCalledTimes(2);

      consoleSpy.mockRestore();
    });

    it('should log conversion events correctly', () => {
      const logger = createLogger('conversion');
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { });

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

    it('should handle timers correctly', () => {
      const timerKey = metricsCollector.startTimer('operation_duration');

      // Simulate some work
      const duration = metricsCollector.endTimer(timerKey);

      expect(duration).toBeGreaterThan(0);

      const stats = metricsCollector.getHistogramStats('operation_duration_duration_ms');
      expect(stats.count).toBe(1);
    });

    it('should record webhook metrics correctly', () => {
      metricsCollector.recordWebhookSuccess('checkout.session.completed', 250);
      metricsCollector.recordWebhookFailure('invoice.paid', 1000, new Error('Timeout'));

      expect(metricsCollector.getCounter('webhook_success_total')).toBe(1);
      expect(metricsCollector.getCounter('webhook_failure_total')).toBe(1);

      const latencyStats = metricsCollector.getHistogramStats('webhook_latency_ms');
      expect(latencyStats.count).toBe(2);
    });

    it('should calculate webhook success rate correctly', () => {
      metricsCollector.recordWebhookSuccess('test', 100);
      metricsCollector.recordWebhookSuccess('test', 150);
      metricsCollector.recordWebhookFailure('test', 200, new Error('Test error'));

      const successRate = metricsCollector.getWebhookSuccessRate();
      expect(successRate).toBeCloseTo(66.67, 1);
    });

    it('should record quota write metrics correctly', () => {
      metricsCollector.recordQuotaWriteSuccess(50);
      metricsCollector.recordQuotaWriteFailure(100, new Error('Database error'));

      expect(metricsCollector.getCounter('quota_write_success_total')).toBe(1);
      expect(metricsCollector.getCounter('quota_write_failure_total')).toBe(1);

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
  });

  describe('Log Aggregator', () => {
    it('should add and index log entries', () => {
      const logEntry = {
        timestamp: new Date().toISOString(),
        level: 'info',
        component: 'test',
        message: 'Test message',
        metadata: {}
      };

      logAggregator.addLog(logEntry);

      expect(logAggregator.logs).toHaveLength(1);
      expect(logAggregator.logs[0]).toMatchObject(logEntry);
      expect(logAggregator.logs[0].id).toBeDefined();
    });

    it('should search logs correctly', () => {
      logAggregator.addLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        component: 'auth',
        message: 'User logged in',
        metadata: {}
      });

      logAggregator.addLog({
        timestamp: new Date().toISOString(),
        level: 'error',
        component: 'conversion',
        message: 'Conversion failed',
        metadata: {}
      });

      // Search by level
      const errorLogs = logAggregator.search('', { level: 'error' });
      expect(errorLogs.logs).toHaveLength(1);
      expect(errorLogs.logs[0].message).toBe('Conversion failed');

      // Search by component
      const authLogs = logAggregator.search('', { component: 'auth' });
      expect(authLogs.logs).toHaveLength(1);
      expect(authLogs.logs[0].message).toBe('User logged in');

      // Text search
      const loginLogs = logAggregator.search('logged');
      expect(loginLogs.logs).toHaveLength(1);
    });

    it('should maintain log limits', () => {
      const originalMaxLogs = logAggregator.maxLogs;
      logAggregator.maxLogs = 3;

      // Add more logs than the limit
      for (let i = 0; i < 5; i++) {
        logAggregator.addLog({
          timestamp: new Date().toISOString(),
          level: 'info',
          component: 'test',
          message: `Message ${i}`,
          metadata: {}
        });
      }

      expect(logAggregator.logs).toHaveLength(3);

      // Restore original limit
      logAggregator.maxLogs = originalMaxLogs;
    });

    it('should generate log statistics', () => {
      logAggregator.addLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        component: 'auth',
        message: 'Info message',
        metadata: {}
      });

      logAggregator.addLog({
        timestamp: new Date().toISOString(),
        level: 'error',
        component: 'conversion',
        message: 'Error message',
        metadata: {}
      });

      const stats = logAggregator.getLogStats('hour');

      expect(stats.total).toBe(2);
      expect(stats.byLevel.info).toBe(1);
      expect(stats.byLevel.error).toBe(1);
      expect(stats.byComponent.auth).toBe(1);
      expect(stats.byComponent.conversion).toBe(1);
    });

    it('should export logs in different formats', () => {
      logAggregator.addLog({
        timestamp: '2023-01-01T00:00:00.000Z',
        level: 'info',
        component: 'test',
        message: 'Test message',
        metadata: { key: 'value' }
      });

      // JSON export
      const jsonExport = logAggregator.exportLogs('json');
      expect(() => JSON.parse(jsonExport)).not.toThrow();

      // CSV export
      const csvExport = logAggregator.exportLogs('csv');
      expect(csvExport).toContain('timestamp,level,component,message,metadata');
      expect(csvExport).toContain('2023-01-01T00:00:00.000Z,info,test');

      // Text export
      const txtExport = logAggregator.exportLogs('txt');
      expect(txtExport).toContain('[2023-01-01T00:00:00.000Z] INFO test: Test message');
    });
  });

  describe('Monitoring Integration', () => {
    it('should initialize without errors', () => {
      expect(() => {
        monitoringIntegration.initialize();
      }).not.toThrow();

      expect(monitoringIntegration.initialized).toBe(true);
    });

    it('should provide monitoring status', () => {
      monitoringIntegration.initialize();

      const status = monitoringIntegration.getMonitoringStatus();

      expect(status).toMatchObject({
        initialized: true,
        logCount: expect.any(Number),
        metricsCount: expect.any(Number),
        webhookSuccessRate: expect.any(Number),
        quotaWriteFailureRate: expect.any(Number)
      });
    });

    it('should record events through integration methods', () => {
      monitoringIntegration.initialize();

      // Record conversion event
      monitoringIntegration.recordConversionEvent('user-123', {
        success: true,
        processingTime: 500,
        fileSize: 1024,
        originalFormat: 'png',
        targetFormat: 'webp'
      });

      expect(metricsCollector.getCounter('conversions_total', { success: 'true' })).toBe(1);

      // Record webhook event
      monitoringIntegration.recordWebhookEvent('checkout.session.completed', 'evt_123', true, 250);

      expect(metricsCollector.getCounter('webhook_success_total')).toBe(1);

      // Record quota write event
      monitoringIntegration.recordQuotaWriteEvent(true, 50);

      expect(metricsCollector.getCounter('quota_write_success_total')).toBe(1);
    });
  });

  describe('API Integration', () => {
    it('should ship logs to API endpoint', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      const logger = createLogger('test');

      // Set environment to production to trigger API shipping
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await logger.info('Test log message');

      // Wait for async shipping
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(fetch).toHaveBeenCalledWith('/api/logs', expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: expect.stringContaining('Test log message')
      }));

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });

    it('should ship metrics to API endpoint', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      metricsCollector.incrementCounter('test_metric', 1);

      // Trigger metrics shipping
      await metricsCollector.shipMetrics();

      expect(fetch).toHaveBeenCalledWith('/api/metrics', expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: expect.stringContaining('test_metric')
      }));
    });
  });

  describe('Error Handling', () => {
    it('should handle logging failures gracefully', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const logger = createLogger('test');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

      // Set environment to production to trigger API shipping
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // This should not throw
      expect(async () => {
        await logger.info('Test message');
      }).not.toThrow();

      // Should log the shipping error
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(consoleSpy).toHaveBeenCalledWith('Failed to ship log:', expect.any(Error));

      // Restore environment
      process.env.NODE_ENV = originalEnv;
      consoleSpy.mockRestore();
    });

    it('should handle metrics shipping failures gracefully', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { });

      // This should not throw
      expect(async () => {
        await metricsCollector.shipMetrics();
      }).not.toThrow();

      consoleSpy.mockRestore();
    });
  });
});