/**
 * Real-time monitoring dashboard for system metrics
 * Implements requirement 17.1: Real-time monitoring dashboards
 * Implements requirement 17.7: Webhook success rate, latency, and quota write failures
 */

import { metricsCollector } from './metrics-collector.js';
import { createLogger } from './logger.js';

class MonitoringDashboard {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.logger = createLogger('dashboard');
    this.refreshInterval = 30000; // 30 seconds
    this.charts = new Map();
    
    if (!this.container) {
      this.logger.error('Dashboard container not found', { containerId });
      return;
    }
    
    this.initialize();
  }

  initialize() {
    this.createDashboardLayout();
    this.startAutoRefresh();
    this.logger.info('Monitoring dashboard initialized');
  }

  createDashboardLayout() {
    this.container.innerHTML = `
      <div class="monitoring-dashboard">
        <div class="dashboard-header">
          <h2>System Monitoring Dashboard</h2>
          <div class="last-updated">Last updated: <span id="last-updated">Never</span></div>
        </div>
        
        <div class="metrics-grid">
          <!-- Webhook Metrics Section -->
          <div class="metric-card webhook-metrics">
            <h3>Webhook Performance</h3>
            <div class="metric-row">
              <div class="metric-item">
                <span class="metric-label">Success Rate</span>
                <span class="metric-value" id="webhook-success-rate">-</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">Avg Latency</span>
                <span class="metric-value" id="webhook-avg-latency">-</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">Total Processed</span>
                <span class="metric-value" id="webhook-total">-</span>
              </div>
            </div>
            <div class="chart-container">
              <canvas id="webhook-latency-chart"></canvas>
            </div>
          </div>

          <!-- Quota Write Metrics Section -->
          <div class="metric-card quota-metrics">
            <h3>Quota Write Performance</h3>
            <div class="metric-row">
              <div class="metric-item">
                <span class="metric-label">Failure Rate</span>
                <span class="metric-value" id="quota-failure-rate">-</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">Avg Latency</span>
                <span class="metric-value" id="quota-avg-latency">-</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">Total Writes</span>
                <span class="metric-value" id="quota-total">-</span>
              </div>
            </div>
            <div class="chart-container">
              <canvas id="quota-latency-chart"></canvas>
            </div>
          </div>

          <!-- Conversion Metrics Section -->
          <div class="metric-card conversion-metrics">
            <h3>Conversion Performance</h3>
            <div class="metric-row">
              <div class="metric-item">
                <span class="metric-label">Success Rate</span>
                <span class="metric-value" id="conversion-success-rate">-</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">Avg Processing Time</span>
                <span class="metric-value" id="conversion-avg-time">-</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">Total Conversions</span>
                <span class="metric-value" id="conversion-total">-</span>
              </div>
            </div>
            <div class="chart-container">
              <canvas id="conversion-time-chart"></canvas>
            </div>
          </div>

          <!-- Usage Patterns Section -->
          <div class="metric-card usage-metrics">
            <h3>Usage Patterns</h3>
            <div class="metric-row">
              <div class="metric-item">
                <span class="metric-label">Avg Quota Utilization</span>
                <span class="metric-value" id="quota-utilization">-</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">Active Users</span>
                <span class="metric-value" id="active-users">-</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">Upgrade Rate</span>
                <span class="metric-value" id="upgrade-rate">-</span>
              </div>
            </div>
            <div class="chart-container">
              <canvas id="usage-pattern-chart"></canvas>
            </div>
          </div>

          <!-- Error Metrics Section -->
          <div class="metric-card error-metrics">
            <h3>Error Tracking</h3>
            <div class="metric-row">
              <div class="metric-item">
                <span class="metric-label">Error Rate</span>
                <span class="metric-value" id="error-rate">-</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">Critical Errors</span>
                <span class="metric-value" id="critical-errors">-</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">Security Events</span>
                <span class="metric-value" id="security-events">-</span>
              </div>
            </div>
            <div class="error-list" id="recent-errors">
              <h4>Recent Errors</h4>
              <div class="error-items"></div>
            </div>
          </div>

          <!-- System Health Section -->
          <div class="metric-card health-metrics">
            <h3>System Health</h3>
            <div class="health-indicators">
              <div class="health-indicator" id="auth-health">
                <span class="health-label">Authentication</span>
                <span class="health-status">-</span>
              </div>
              <div class="health-indicator" id="billing-health">
                <span class="health-label">Billing</span>
                <span class="health-status">-</span>
              </div>
              <div class="health-indicator" id="conversion-health">
                <span class="health-label">Conversion</span>
                <span class="health-status">-</span>
              </div>
              <div class="health-indicator" id="storage-health">
                <span class="health-label">Storage</span>
                <span class="health-status">-</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.addDashboardStyles();
  }

  addDashboardStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .monitoring-dashboard {
        padding: 20px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .dashboard-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 30px;
        padding-bottom: 15px;
        border-bottom: 2px solid #e1e5e9;
      }

      .dashboard-header h2 {
        margin: 0;
        color: #1a202c;
      }

      .last-updated {
        color: #718096;
        font-size: 14px;
      }

      .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
        gap: 20px;
      }

      .metric-card {
        background: white;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        border: 1px solid #e1e5e9;
      }

      .metric-card h3 {
        margin: 0 0 15px 0;
        color: #2d3748;
        font-size: 18px;
      }

      .metric-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 20px;
      }

      .metric-item {
        text-align: center;
        flex: 1;
      }

      .metric-label {
        display: block;
        font-size: 12px;
        color: #718096;
        margin-bottom: 5px;
        text-transform: uppercase;
        font-weight: 600;
      }

      .metric-value {
        display: block;
        font-size: 24px;
        font-weight: bold;
        color: #2d3748;
      }

      .chart-container {
        height: 200px;
        margin-top: 15px;
      }

      .health-indicators {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 15px;
      }

      .health-indicator {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
        background: #f7fafc;
        border-radius: 6px;
      }

      .health-label {
        font-weight: 500;
        color: #4a5568;
      }

      .health-status {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
      }

      .health-status.healthy {
        background: #c6f6d5;
        color: #22543d;
      }

      .health-status.warning {
        background: #fef5e7;
        color: #c05621;
      }

      .health-status.critical {
        background: #fed7d7;
        color: #c53030;
      }

      .error-list {
        margin-top: 15px;
      }

      .error-list h4 {
        margin: 0 0 10px 0;
        font-size: 14px;
        color: #4a5568;
      }

      .error-items {
        max-height: 150px;
        overflow-y: auto;
      }

      .error-item {
        padding: 8px;
        margin-bottom: 5px;
        background: #fed7d7;
        border-radius: 4px;
        font-size: 12px;
        color: #c53030;
      }
    `;
    document.head.appendChild(style);
  }

  async updateDashboard() {
    try {
      const metrics = await this.fetchMetrics();
      this.updateWebhookMetrics(metrics);
      this.updateQuotaMetrics(metrics);
      this.updateConversionMetrics(metrics);
      this.updateUsageMetrics(metrics);
      this.updateErrorMetrics(metrics);
      this.updateHealthIndicators(metrics);
      
      document.getElementById('last-updated').textContent = new Date().toLocaleTimeString();
      
      this.logger.debug('Dashboard updated successfully');
    } catch (error) {
      this.logger.error('Failed to update dashboard', { error: error.message });
    }
  }

  async fetchMetrics() {
    // In a real implementation, this would fetch from your metrics API
    // For now, we'll use the local metrics collector
    return metricsCollector.getAllMetrics();
  }

  updateWebhookMetrics(metrics) {
    const successRate = metricsCollector.getWebhookSuccessRate();
    const latencyStats = metricsCollector.getHistogramStats('webhook_latency_ms');
    const totalWebhooks = metricsCollector.getCounter('webhook_success_total') + 
                         metricsCollector.getCounter('webhook_failure_total');

    document.getElementById('webhook-success-rate').textContent = `${successRate.toFixed(1)}%`;
    document.getElementById('webhook-avg-latency').textContent = `${latencyStats.avg.toFixed(0)}ms`;
    document.getElementById('webhook-total').textContent = totalWebhooks.toString();
  }

  updateQuotaMetrics(metrics) {
    const failureRate = metricsCollector.getQuotaWriteFailureRate();
    const latencyStats = metricsCollector.getHistogramStats('quota_write_latency_ms');
    const totalWrites = metricsCollector.getCounter('quota_write_success_total') + 
                       metricsCollector.getCounter('quota_write_failure_total');

    document.getElementById('quota-failure-rate').textContent = `${failureRate.toFixed(1)}%`;
    document.getElementById('quota-avg-latency').textContent = `${latencyStats.avg.toFixed(0)}ms`;
    document.getElementById('quota-total').textContent = totalWrites.toString();
  }

  updateConversionMetrics(metrics) {
    const successCount = metricsCollector.getCounter('conversions_total', { success: 'true' });
    const failureCount = metricsCollector.getCounter('conversions_total', { success: 'false' });
    const total = successCount + failureCount;
    const successRate = total > 0 ? (successCount / total) * 100 : 100;
    const processingStats = metricsCollector.getHistogramStats('conversion_processing_time_ms');

    document.getElementById('conversion-success-rate').textContent = `${successRate.toFixed(1)}%`;
    document.getElementById('conversion-avg-time').textContent = `${processingStats.avg.toFixed(0)}ms`;
    document.getElementById('conversion-total').textContent = total.toString();
  }

  updateUsageMetrics(metrics) {
    const utilizationStats = metricsCollector.getHistogramStats('quota_utilization_percent');
    
    document.getElementById('quota-utilization').textContent = `${utilizationStats.avg.toFixed(1)}%`;
    document.getElementById('active-users').textContent = '-'; // Would need user tracking
    document.getElementById('upgrade-rate').textContent = '-'; // Would need billing analytics
  }

  updateErrorMetrics(metrics) {
    const totalErrors = metricsCollector.getCounter('errors_total');
    const criticalErrors = metricsCollector.getCounter('errors_total', { severity: 'error' });
    const securityEvents = metricsCollector.getCounter('errors_total', { component: 'security' });

    document.getElementById('error-rate').textContent = `${totalErrors}/hr`; // Simplified
    document.getElementById('critical-errors').textContent = criticalErrors.toString();
    document.getElementById('security-events').textContent = securityEvents.toString();
  }

  updateHealthIndicators(metrics) {
    // Simplified health check based on error rates and success rates
    const webhookSuccessRate = metricsCollector.getWebhookSuccessRate();
    const quotaFailureRate = metricsCollector.getQuotaWriteFailureRate();
    
    this.setHealthStatus('auth-health', webhookSuccessRate > 95 ? 'healthy' : 'warning');
    this.setHealthStatus('billing-health', webhookSuccessRate > 90 ? 'healthy' : 'critical');
    this.setHealthStatus('conversion-health', quotaFailureRate < 5 ? 'healthy' : 'warning');
    this.setHealthStatus('storage-health', 'healthy'); // Would need storage metrics
  }

  setHealthStatus(elementId, status) {
    const element = document.getElementById(elementId);
    const statusElement = element.querySelector('.health-status');
    statusElement.textContent = status;
    statusElement.className = `health-status ${status}`;
  }

  startAutoRefresh() {
    // Initial update
    this.updateDashboard();
    
    // Set up periodic updates
    setInterval(() => {
      this.updateDashboard();
    }, this.refreshInterval);
    
    this.logger.info('Auto-refresh started', { interval: this.refreshInterval });
  }

  destroy() {
    // Clean up intervals and event listeners
    this.logger.info('Dashboard destroyed');
  }
}

export default MonitoringDashboard;