/**
 * Debug test for monitoring system
 */

const { MetricsCollector } = require('../js/monitoring/metrics-collector.js');

describe('Monitoring Debug', () => {
  it('should debug counter keys', () => {
    const metricsCollector = new MetricsCollector();
    
    // Record some metrics
    metricsCollector.recordWebhookSuccess('test', 100);
    metricsCollector.recordWebhookFailure('test', 200, new Error('test'));
    
    // Check what keys are actually created
    console.log('All counter keys:', Array.from(metricsCollector.counters.keys()));
    console.log('webhook_success_total:', metricsCollector.getCounter('webhook_success_total'));
    console.log('webhook_failure_total:', metricsCollector.getCounter('webhook_failure_total'));
    
    // Check the success rate calculation
    console.log('Success rate:', metricsCollector.getWebhookSuccessRate());
  });
});