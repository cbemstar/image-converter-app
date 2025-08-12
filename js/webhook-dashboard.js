/**
 * Webhook Dashboard Utilities
 * Provides functions to fetch and display webhook monitoring data
 */

class WebhookDashboard {
  constructor(supabaseUrl, supabaseKey) {
    this.supabaseUrl = supabaseUrl
    this.supabaseKey = supabaseKey
  }

  /**
   * Fetch webhook metrics from the monitoring endpoint
   */
  async getMetrics() {
    try {
      const response = await fetch(`${this.supabaseUrl}/functions/v1/webhook-monitor/metrics`, {
        headers: {
          'Authorization': `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Failed to fetch webhook metrics:', error)
      throw error
    }
  }

  /**
   * Fetch dead letter queue items
   */
  async getDLQ() {
    try {
      const response = await fetch(`${this.supabaseUrl}/functions/v1/webhook-monitor/dlq`, {
        headers: {
          'Authorization': `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Failed to fetch DLQ:', error)
      throw error
    }
  }

  /**
   * Retry a failed webhook event
   */
  async retryEvent(eventId) {
    try {
      const response = await fetch(`${this.supabaseUrl}/functions/v1/webhook-monitor/retry`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ eventId })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Failed to retry webhook event:', error)
      throw error
    }
  }

  /**
   * Get health check results
   */
  async getHealthCheck() {
    try {
      const response = await fetch(`${this.supabaseUrl}/functions/v1/webhook-health-check`, {
        headers: {
          'Authorization': `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Failed to fetch health check:', error)
      throw error
    }
  }

  /**
   * Render metrics dashboard HTML
   */
  renderMetricsDashboard(metrics) {
    const successRateColor = metrics.successRate >= 95 ? 'green' : metrics.successRate >= 80 ? 'orange' : 'red'
    
    return `
      <div class="webhook-dashboard">
        <h2>Webhook Metrics (Last 24 Hours)</h2>
        
        <div class="metrics-grid">
          <div class="metric-card">
            <h3>Success Rate</h3>
            <div class="metric-value" style="color: ${successRateColor}">
              ${metrics.successRate.toFixed(1)}%
            </div>
            <div class="metric-detail">
              ${metrics.processedEvents}/${metrics.totalEvents} processed
            </div>
          </div>
          
          <div class="metric-card">
            <h3>Failed Events</h3>
            <div class="metric-value" style="color: ${metrics.failedEvents > 0 ? 'red' : 'green'}">
              ${metrics.failedEvents}
            </div>
            <div class="metric-detail">
              In dead letter queue
            </div>
          </div>
          
          <div class="metric-card">
            <h3>Avg Processing Time</h3>
            <div class="metric-value">
              ${(metrics.avgProcessingTime / 1000).toFixed(1)}s
            </div>
            <div class="metric-detail">
              Per webhook event
            </div>
          </div>
          
          <div class="metric-card">
            <h3>Total Events</h3>
            <div class="metric-value">
              ${metrics.totalEvents}
            </div>
            <div class="metric-detail">
              Last 24 hours
            </div>
          </div>
        </div>
        
        <div class="events-by-type">
          <h3>Events by Type</h3>
          <div class="event-types">
            ${Object.entries(metrics.eventsByType)
              .map(([type, count]) => `
                <div class="event-type">
                  <span class="event-name">${type}</span>
                  <span class="event-count">${count}</span>
                </div>
              `).join('')}
          </div>
        </div>
        
        ${metrics.recentFailures.length > 0 ? `
          <div class="recent-failures">
            <h3>Recent Failures</h3>
            <div class="failures-list">
              ${metrics.recentFailures.map(failure => `
                <div class="failure-item">
                  <div class="failure-header">
                    <span class="event-id">${failure.eventId}</span>
                    <span class="event-type">${failure.eventType}</span>
                    <span class="attempts">Attempts: ${failure.attempts}</span>
                  </div>
                  <div class="failure-error">${failure.error}</div>
                  <div class="failure-time">${new Date(failure.createdAt).toLocaleString()}</div>
                  <button onclick="retryWebhookEvent('${failure.eventId}')" class="retry-btn">
                    Retry
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `
  }

  /**
   * Render health check dashboard HTML
   */
  renderHealthDashboard(healthCheck) {
    const healthColor = {
      'healthy': 'green',
      'warning': 'orange',
      'critical': 'red'
    }[healthCheck.overallHealth]

    return `
      <div class="health-dashboard">
        <h2>Webhook Health Status</h2>
        
        <div class="health-status">
          <div class="health-indicator" style="background-color: ${healthColor}">
            ${healthCheck.overallHealth.toUpperCase()}
          </div>
          <div class="health-timestamp">
            Last checked: ${new Date(healthCheck.timestamp).toLocaleString()}
          </div>
        </div>
        
        ${healthCheck.alerts.length > 0 ? `
          <div class="alerts-section">
            <h3>Active Alerts</h3>
            ${healthCheck.alerts.map(alert => `
              <div class="alert alert-${alert.severity}">
                <div class="alert-message">${alert.message}</div>
                ${alert.threshold ? `<div class="alert-details">Threshold: ${alert.threshold}, Actual: ${alert.actual}</div>` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}
        
        ${healthCheck.recommendations.length > 0 ? `
          <div class="recommendations-section">
            <h3>Recommendations</h3>
            <ul class="recommendations-list">
              ${healthCheck.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
        
        <div class="health-metrics">
          <h3>Key Metrics</h3>
          <div class="metrics-grid">
            <div class="metric-item">
              <span class="metric-label">Success Rate (24h)</span>
              <span class="metric-value">${healthCheck.metrics.successRate24h}%</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">DLQ Count</span>
              <span class="metric-value">${healthCheck.metrics.dlqCount}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Unprocessed Count</span>
              <span class="metric-value">${healthCheck.metrics.unprocessedCount}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Avg Processing Time</span>
              <span class="metric-value">${(healthCheck.metrics.avgProcessingTime / 1000).toFixed(1)}s</span>
            </div>
          </div>
        </div>
      </div>
    `
  }

  /**
   * Get CSS styles for the dashboard
   */
  getDashboardStyles() {
    return `
      <style>
        .webhook-dashboard, .health-dashboard {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }
        
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin: 20px 0;
        }
        
        .metric-card {
          background: white;
          border: 1px solid #e1e5e9;
          border-radius: 8px;
          padding: 20px;
          text-align: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .metric-card h3 {
          margin: 0 0 10px 0;
          color: #666;
          font-size: 14px;
          font-weight: 500;
        }
        
        .metric-value {
          font-size: 32px;
          font-weight: bold;
          margin: 10px 0;
        }
        
        .metric-detail {
          color: #888;
          font-size: 12px;
        }
        
        .health-status {
          display: flex;
          align-items: center;
          gap: 20px;
          margin: 20px 0;
        }
        
        .health-indicator {
          padding: 10px 20px;
          border-radius: 20px;
          color: white;
          font-weight: bold;
          font-size: 14px;
        }
        
        .health-timestamp {
          color: #666;
          font-size: 14px;
        }
        
        .alert {
          padding: 15px;
          margin: 10px 0;
          border-radius: 4px;
          border-left: 4px solid;
        }
        
        .alert-info { background: #e3f2fd; border-color: #2196f3; }
        .alert-warning { background: #fff3e0; border-color: #ff9800; }
        .alert-error { background: #ffebee; border-color: #f44336; }
        .alert-critical { background: #fce4ec; border-color: #e91e63; }
        
        .alert-message {
          font-weight: 500;
          margin-bottom: 5px;
        }
        
        .alert-details {
          font-size: 12px;
          color: #666;
        }
        
        .recommendations-list {
          background: #f5f5f5;
          padding: 15px;
          border-radius: 4px;
        }
        
        .failure-item {
          background: white;
          border: 1px solid #e1e5e9;
          border-radius: 4px;
          padding: 15px;
          margin: 10px 0;
        }
        
        .failure-header {
          display: flex;
          gap: 15px;
          margin-bottom: 10px;
          font-size: 14px;
        }
        
        .event-id {
          font-family: monospace;
          background: #f0f0f0;
          padding: 2px 6px;
          border-radius: 3px;
        }
        
        .failure-error {
          color: #d32f2f;
          font-size: 13px;
          margin: 5px 0;
        }
        
        .failure-time {
          color: #666;
          font-size: 12px;
          margin: 5px 0;
        }
        
        .retry-btn {
          background: #1976d2;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }
        
        .retry-btn:hover {
          background: #1565c0;
        }
        
        .event-types {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 10px;
        }
        
        .event-type {
          display: flex;
          justify-content: space-between;
          padding: 8px 12px;
          background: #f5f5f5;
          border-radius: 4px;
        }
        
        .metric-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #eee;
        }
        
        .metric-label {
          color: #666;
        }
        
        .metric-value {
          font-weight: 500;
        }
      </style>
    `
  }
}

// Global function for retry button
async function retryWebhookEvent(eventId) {
  try {
    const dashboard = new WebhookDashboard(
      window.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
      window.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
    
    const result = await dashboard.retryEvent(eventId)
    
    if (result.success) {
      alert('Webhook event retry initiated successfully')
      // Refresh the dashboard
      location.reload()
    } else {
      alert(`Failed to retry webhook event: ${result.message}`)
    }
  } catch (error) {
    alert(`Error retrying webhook event: ${error.message}`)
  }
}

// Export for use in Node.js environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebhookDashboard
}

// Export for use in ES6 modules
if (typeof window !== 'undefined') {
  window.WebhookDashboard = WebhookDashboard
}