/**
 * Usage Analytics Display Component
 * 
 * Displays usage history and analytics with charts and insights
 * Requirements: 5.1, 5.5, 5.6
 */

export class UsageAnalytics {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      showChart: true,
      showInsights: true,
      showTrends: true,
      chartType: 'bar', // 'bar', 'line', 'area'
      timeRange: 6, // months
      ...options
    };
    
    if (!this.container) {
      console.error(`UsageAnalytics: Container with id "${containerId}" not found`);
      return;
    }
    
    this.usageHistory = [];
    this.currentUsage = null;
    this.chart = null;
    
    this.init();
  }

  /**
   * Initialize the component
   */
  init() {
    this.render();
  }

  /**
   * Update with new usage data
   * @param {Object} currentUsage - Current usage data
   * @param {Array} usageHistory - Historical usage data
   */
  update(currentUsage, usageHistory = []) {
    this.currentUsage = currentUsage;
    this.usageHistory = usageHistory;
    this.render();
  }

  /**
   * Render the analytics display
   */
  render() {
    if (!this.currentUsage && this.usageHistory.length === 0) {
      this.renderEmpty();
      return;
    }
    
    this.container.innerHTML = `
      <div class="usage-analytics">
        <div class="analytics-header">
          <h3>Usage Analytics</h3>
          <div class="analytics-controls">
            <select class="time-range-select" data-control="timeRange">
              <option value="3" ${this.options.timeRange === 3 ? 'selected' : ''}>Last 3 months</option>
              <option value="6" ${this.options.timeRange === 6 ? 'selected' : ''}>Last 6 months</option>
              <option value="12" ${this.options.timeRange === 12 ? 'selected' : ''}>Last 12 months</option>
            </select>
            <select class="chart-type-select" data-control="chartType">
              <option value="bar" ${this.options.chartType === 'bar' ? 'selected' : ''}>Bar Chart</option>
              <option value="line" ${this.options.chartType === 'line' ? 'selected' : ''}>Line Chart</option>
              <option value="area" ${this.options.chartType === 'area' ? 'selected' : ''}>Area Chart</option>
            </select>
          </div>
        </div>
        
        ${this.options.showChart ? this.renderChart() : ''}
        ${this.options.showInsights ? this.renderInsights() : ''}
        ${this.options.showTrends ? this.renderTrends() : ''}
        
        <div class="analytics-details">
          ${this.renderUsageTable()}
        </div>
      </div>
    `;
    
    this.attachEventListeners();
    
    if (this.options.showChart) {
      this.initializeChart();
    }
  }

  /**
   * Render empty state
   */
  renderEmpty() {
    this.container.innerHTML = `
      <div class="usage-analytics empty">
        <div class="empty-state">
          <i class="fas fa-chart-line"></i>
          <h4>No Usage Data Available</h4>
          <p>Start converting images to see your usage analytics here.</p>
        </div>
      </div>
    `;
  }

  /**
   * Render chart container
   * @returns {string} HTML for chart container
   */
  renderChart() {
    return `
      <div class="analytics-chart">
        <div class="chart-container">
          <canvas id="usage-chart" width="400" height="200"></canvas>
        </div>
      </div>
    `;
  }

  /**
   * Render insights section
   * @returns {string} HTML for insights
   */
  renderInsights() {
    const insights = this.generateInsights();
    
    return `
      <div class="analytics-insights">
        <h4>Key Insights</h4>
        <div class="insights-grid">
          ${insights.map(insight => `
            <div class="insight-card ${insight.type}">
              <div class="insight-icon">
                <i class="${insight.icon}"></i>
              </div>
              <div class="insight-content">
                <div class="insight-value">${insight.value}</div>
                <div class="insight-label">${insight.label}</div>
                ${insight.change ? `
                  <div class="insight-change ${insight.change.type}">
                    <i class="fas fa-arrow-${insight.change.type === 'positive' ? 'up' : 'down'}"></i>
                    ${insight.change.value}
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render trends section
   * @returns {string} HTML for trends
   */
  renderTrends() {
    const trends = this.analyzeTrends();
    
    return `
      <div class="analytics-trends">
        <h4>Usage Trends</h4>
        <div class="trends-list">
          ${trends.map(trend => `
            <div class="trend-item ${trend.type}">
              <div class="trend-icon">
                <i class="${trend.icon}"></i>
              </div>
              <div class="trend-content">
                <div class="trend-title">${trend.title}</div>
                <div class="trend-description">${trend.description}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render usage table
   * @returns {string} HTML for usage table
   */
  renderUsageTable() {
    if (this.usageHistory.length === 0) {
      return `
        <div class="no-history">
          <p>No historical data available yet.</p>
        </div>
      `;
    }
    
    return `
      <div class="usage-table-container">
        <h4>Usage History</h4>
        <div class="table-wrapper">
          <table class="usage-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Plan</th>
                <th>Used</th>
                <th>Limit</th>
                <th>Utilization</th>
                <th>Efficiency</th>
              </tr>
            </thead>
            <tbody>
              ${this.usageHistory.map(record => `
                <tr>
                  <td class="period-cell">
                    <div class="period-main">${this.formatPeriod(record.periodStart)}</div>
                    <div class="period-sub">${this.formatDateRange(record.periodStart, record.periodEnd)}</div>
                  </td>
                  <td>
                    <span class="plan-badge ${record.planName.toLowerCase()}">${record.planName}</span>
                  </td>
                  <td class="number-cell">${record.conversionsUsed.toLocaleString()}</td>
                  <td class="number-cell">${record.conversionsLimit === -1 ? 'Unlimited' : record.conversionsLimit.toLocaleString()}</td>
                  <td class="utilization-cell">
                    <div class="utilization-bar">
                      <div class="utilization-fill" style="width: ${record.utilizationPercent}%"></div>
                    </div>
                    <span class="utilization-text">${record.utilizationPercent}%</span>
                  </td>
                  <td class="efficiency-cell">
                    ${this.renderEfficiencyScore(record)}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /**
   * Generate insights from usage data
   * @returns {Array} Array of insight objects
   */
  generateInsights() {
    const insights = [];
    
    if (this.currentUsage) {
      // Current month usage
      insights.push({
        type: 'primary',
        icon: 'fas fa-chart-bar',
        value: this.currentUsage.conversionsUsed.toLocaleString(),
        label: 'This Month',
        change: this.getUsageChange()
      });
      
      // Remaining conversions
      insights.push({
        type: this.currentUsage.remainingConversions === 0 ? 'warning' : 'success',
        icon: 'fas fa-battery-three-quarters',
        value: this.currentUsage.remainingConversions.toLocaleString(),
        label: 'Remaining'
      });
    }
    
    if (this.usageHistory.length > 0) {
      // Average monthly usage
      const avgUsage = this.calculateAverageUsage();
      insights.push({
        type: 'info',
        icon: 'fas fa-calculator',
        value: avgUsage.toLocaleString(),
        label: 'Monthly Average'
      });
      
      // Peak usage month
      const peakUsage = Math.max(...this.usageHistory.map(h => h.conversionsUsed));
      insights.push({
        type: 'secondary',
        icon: 'fas fa-mountain',
        value: peakUsage.toLocaleString(),
        label: 'Peak Month'
      });
    }
    
    return insights;
  }

  /**
   * Analyze usage trends
   * @returns {Array} Array of trend objects
   */
  analyzeTrends() {
    const trends = [];
    
    if (this.usageHistory.length < 2) {
      return [{
        type: 'info',
        icon: 'fas fa-info-circle',
        title: 'Not Enough Data',
        description: 'More usage history needed to analyze trends.'
      }];
    }
    
    // Usage trend
    const usageTrend = this.calculateUsageTrend();
    if (usageTrend.direction !== 'stable') {
      trends.push({
        type: usageTrend.direction === 'increasing' ? 'warning' : 'success',
        icon: usageTrend.direction === 'increasing' ? 'fas fa-trending-up' : 'fas fa-trending-down',
        title: `Usage ${usageTrend.direction === 'increasing' ? 'Increasing' : 'Decreasing'}`,
        description: `Your usage has ${usageTrend.direction === 'increasing' ? 'increased' : 'decreased'} by ${usageTrend.change}% over the last few months.`
      });
    }
    
    // Efficiency trend
    const efficiencyTrend = this.calculateEfficiencyTrend();
    if (efficiencyTrend) {
      trends.push({
        type: efficiencyTrend.improving ? 'success' : 'info',
        icon: efficiencyTrend.improving ? 'fas fa-arrow-up' : 'fas fa-arrow-down',
        title: `Efficiency ${efficiencyTrend.improving ? 'Improving' : 'Declining'}`,
        description: efficiencyTrend.description
      });
    }
    
    // Plan utilization
    const utilizationTrend = this.analyzeUtilization();
    if (utilizationTrend) {
      trends.push(utilizationTrend);
    }
    
    return trends;
  }

  /**
   * Get usage change from previous month
   * @returns {Object|null} Change object or null
   */
  getUsageChange() {
    if (this.usageHistory.length < 2) return null;
    
    const current = this.currentUsage.conversionsUsed;
    const previous = this.usageHistory[1].conversionsUsed;
    
    if (previous === 0) return null;
    
    const change = ((current - previous) / previous * 100).toFixed(1);
    const isPositive = change > 0;
    
    return {
      type: isPositive ? 'positive' : 'negative',
      value: `${Math.abs(change)}%`
    };
  }

  /**
   * Calculate average monthly usage
   * @returns {number} Average usage
   */
  calculateAverageUsage() {
    if (this.usageHistory.length === 0) return 0;
    
    const total = this.usageHistory.reduce((sum, record) => sum + record.conversionsUsed, 0);
    return Math.round(total / this.usageHistory.length);
  }

  /**
   * Calculate usage trend
   * @returns {Object} Trend object
   */
  calculateUsageTrend() {
    if (this.usageHistory.length < 3) {
      return { direction: 'stable', change: 0 };
    }
    
    const recent = this.usageHistory.slice(0, 3);
    const older = this.usageHistory.slice(-3);
    
    const recentAvg = recent.reduce((sum, r) => sum + r.conversionsUsed, 0) / recent.length;
    const olderAvg = older.reduce((sum, r) => sum + r.conversionsUsed, 0) / older.length;
    
    if (olderAvg === 0) return { direction: 'stable', change: 0 };
    
    const change = ((recentAvg - olderAvg) / olderAvg * 100).toFixed(1);
    const threshold = 10; // 10% threshold for trend detection
    
    if (Math.abs(change) < threshold) {
      return { direction: 'stable', change: 0 };
    }
    
    return {
      direction: change > 0 ? 'increasing' : 'decreasing',
      change: Math.abs(change)
    };
  }

  /**
   * Calculate efficiency trend
   * @returns {Object|null} Efficiency trend object
   */
  calculateEfficiencyTrend() {
    if (this.usageHistory.length < 2) return null;
    
    const recent = this.usageHistory[0];
    const previous = this.usageHistory[1];
    
    const recentEfficiency = this.calculateEfficiency(recent);
    const previousEfficiency = this.calculateEfficiency(previous);
    
    const improving = recentEfficiency > previousEfficiency;
    const change = Math.abs(recentEfficiency - previousEfficiency);
    
    if (change < 5) return null; // Not significant enough
    
    return {
      improving,
      description: improving 
        ? `You're making better use of your plan with ${recentEfficiency}% efficiency.`
        : `Your plan utilization has decreased to ${recentEfficiency}%.`
    };
  }

  /**
   * Analyze utilization patterns
   * @returns {Object|null} Utilization trend object
   */
  analyzeUtilization() {
    if (this.usageHistory.length === 0) return null;
    
    const avgUtilization = this.usageHistory.reduce((sum, r) => sum + r.utilizationPercent, 0) / this.usageHistory.length;
    
    if (avgUtilization > 90) {
      return {
        type: 'warning',
        icon: 'fas fa-exclamation-triangle',
        title: 'High Utilization',
        description: `You're consistently using ${avgUtilization.toFixed(0)}% of your quota. Consider upgrading.`
      };
    } else if (avgUtilization < 30) {
      return {
        type: 'info',
        icon: 'fas fa-info-circle',
        title: 'Low Utilization',
        description: `You're only using ${avgUtilization.toFixed(0)}% of your quota on average. You might consider a lower plan.`
      };
    }
    
    return null;
  }

  /**
   * Calculate efficiency score for a usage record
   * @param {Object} record - Usage record
   * @returns {number} Efficiency percentage
   */
  calculateEfficiency(record) {
    if (record.conversionsLimit === -1) return 100; // Unlimited plans are always 100% efficient
    return Math.min(100, (record.conversionsUsed / record.conversionsLimit * 100));
  }

  /**
   * Render efficiency score
   * @param {Object} record - Usage record
   * @returns {string} HTML for efficiency score
   */
  renderEfficiencyScore(record) {
    const efficiency = this.calculateEfficiency(record);
    let scoreClass = 'efficiency-good';
    
    if (efficiency < 30) scoreClass = 'efficiency-low';
    else if (efficiency > 90) scoreClass = 'efficiency-high';
    
    return `
      <div class="efficiency-score ${scoreClass}">
        <span class="efficiency-value">${efficiency.toFixed(0)}%</span>
        <div class="efficiency-bar">
          <div class="efficiency-fill" style="width: ${efficiency}%"></div>
        </div>
      </div>
    `;
  }

  /**
   * Format period for display
   * @param {string} periodStart - Period start date
   * @returns {string} Formatted period
   */
  formatPeriod(periodStart) {
    const date = new Date(periodStart);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  /**
   * Format date range
   * @param {string} start - Start date
   * @param {string} end - End date
   * @returns {string} Formatted date range
   */
  formatDateRange(start, end) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    return `${startDate.getDate()} - ${endDate.getDate()}`;
  }

  /**
   * Initialize chart
   */
  initializeChart() {
    const canvas = this.container.querySelector('#usage-chart');
    if (!canvas || this.usageHistory.length === 0) return;
    
    // Simple canvas-based chart implementation
    this.drawChart(canvas);
  }

  /**
   * Draw chart on canvas
   * @param {HTMLCanvasElement} canvas - Canvas element
   */
  drawChart(canvas) {
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    // Set canvas size
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    const width = rect.width;
    const height = rect.height;
    const padding = 40;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Get data
    const data = this.usageHistory.slice().reverse(); // Reverse for chronological order
    const maxValue = Math.max(...data.map(d => d.conversionsUsed));
    
    // Draw chart based on type
    switch (this.options.chartType) {
      case 'line':
        this.drawLineChart(ctx, data, width, height, padding, maxValue);
        break;
      case 'area':
        this.drawAreaChart(ctx, data, width, height, padding, maxValue);
        break;
      default:
        this.drawBarChart(ctx, data, width, height, padding, maxValue);
    }
    
    // Draw axes and labels
    this.drawAxes(ctx, data, width, height, padding, maxValue);
  }

  /**
   * Draw bar chart
   */
  drawBarChart(ctx, data, width, height, padding, maxValue) {
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    const barWidth = chartWidth / data.length * 0.8;
    const barSpacing = chartWidth / data.length * 0.2;
    
    ctx.fillStyle = 'var(--primary)';
    
    data.forEach((record, index) => {
      const barHeight = (record.conversionsUsed / maxValue) * chartHeight;
      const x = padding + index * (barWidth + barSpacing) + barSpacing / 2;
      const y = height - padding - barHeight;
      
      ctx.fillRect(x, y, barWidth, barHeight);
    });
  }

  /**
   * Draw line chart
   */
  drawLineChart(ctx, data, width, height, padding, maxValue) {
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    
    ctx.strokeStyle = 'var(--primary)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    data.forEach((record, index) => {
      const x = padding + (index / (data.length - 1)) * chartWidth;
      const y = height - padding - (record.conversionsUsed / maxValue) * chartHeight;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    
    // Draw points
    ctx.fillStyle = 'var(--primary)';
    data.forEach((record, index) => {
      const x = padding + (index / (data.length - 1)) * chartWidth;
      const y = height - padding - (record.conversionsUsed / maxValue) * chartHeight;
      
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
    });
  }

  /**
   * Draw area chart
   */
  drawAreaChart(ctx, data, width, height, padding, maxValue) {
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    
    // Create gradient
    const gradient = ctx.createLinearGradient(0, padding, 0, height - padding);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.1)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    
    // Start from bottom left
    ctx.moveTo(padding, height - padding);
    
    // Draw the area
    data.forEach((record, index) => {
      const x = padding + (index / (data.length - 1)) * chartWidth;
      const y = height - padding - (record.conversionsUsed / maxValue) * chartHeight;
      ctx.lineTo(x, y);
    });
    
    // Close the area
    ctx.lineTo(padding + chartWidth, height - padding);
    ctx.closePath();
    ctx.fill();
    
    // Draw the line on top
    this.drawLineChart(ctx, data, width, height, padding, maxValue);
  }

  /**
   * Draw axes and labels
   */
  drawAxes(ctx, data, width, height, padding, maxValue) {
    ctx.strokeStyle = 'var(--border)';
    ctx.lineWidth = 1;
    
    // Draw axes
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();
    
    // Draw labels
    ctx.fillStyle = 'var(--muted-foreground)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    
    // X-axis labels (months)
    data.forEach((record, index) => {
      const x = padding + (index / (data.length - 1)) * (width - padding * 2);
      const label = this.formatPeriod(record.periodStart);
      ctx.fillText(label, x, height - padding + 20);
    });
    
    // Y-axis labels (usage values)
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const value = (maxValue / 4) * i;
      const y = height - padding - (i / 4) * (height - padding * 2);
      ctx.fillText(Math.round(value).toString(), padding - 10, y + 4);
    }
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    this.container.addEventListener('change', (e) => {
      if (e.target.matches('[data-control]')) {
        const control = e.target.dataset.control;
        const value = e.target.value;
        
        if (control === 'timeRange') {
          this.options.timeRange = parseInt(value);
          this.dispatchEvent('timeRangeChange', { timeRange: this.options.timeRange });
        } else if (control === 'chartType') {
          this.options.chartType = value;
          if (this.options.showChart) {
            this.initializeChart();
          }
        }
      }
    });
  }

  /**
   * Dispatch custom event
   * @param {string} eventName - Event name
   * @param {Object} detail - Event detail
   */
  dispatchEvent(eventName, detail) {
    this.container.dispatchEvent(new CustomEvent(eventName, {
      detail,
      bubbles: true
    }));
  }

  /**
   * Update options and re-render
   * @param {Object} newOptions - New options to merge
   */
  updateOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
    this.render();
  }

  /**
   * Destroy the component
   */
  destroy() {
    if (this.container) {
      this.container.innerHTML = '';
    }
    
    this.chart = null;
    this.usageHistory = [];
    this.currentUsage = null;
  }
}

// Add CSS styles for usage analytics
const usageAnalyticsStyles = `
  /* Usage Analytics Styles */
  .usage-analytics {
    font-family: inherit;
    color: var(--foreground);
  }
  
  .analytics-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border);
  }
  
  .analytics-header h3 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
  }
  
  .analytics-controls {
    display: flex;
    gap: 1rem;
  }
  
  .analytics-controls select {
    padding: 0.5rem;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--background);
    color: var(--foreground);
    font-size: 0.875rem;
  }
  
  /* Chart Styles */
  .analytics-chart {
    margin-bottom: 2rem;
  }
  
  .chart-container {
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1rem;
    height: 300px;
  }
  
  #usage-chart {
    width: 100%;
    height: 100%;
  }
  
  /* Insights Styles */
  .analytics-insights {
    margin-bottom: 2rem;
  }
  
  .analytics-insights h4 {
    margin: 0 0 1rem 0;
    font-size: 1.25rem;
    font-weight: 600;
  }
  
  .insights-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }
  
  .insight-card {
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .insight-card.primary {
    border-color: var(--primary);
    background: var(--primary-background, var(--background));
  }
  
  .insight-card.success {
    border-color: var(--success);
    background: var(--success-background, var(--background));
  }
  
  .insight-card.warning {
    border-color: var(--warning);
    background: var(--warning-background, var(--background));
  }
  
  .insight-card.info {
    border-color: var(--info);
    background: var(--info-background, var(--background));
  }
  
  .insight-icon {
    font-size: 2rem;
    opacity: 0.8;
  }
  
  .insight-content {
    flex: 1;
  }
  
  .insight-value {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 0.25rem;
  }
  
  .insight-label {
    font-size: 0.875rem;
    color: var(--muted-foreground);
    margin-bottom: 0.5rem;
  }
  
  .insight-change {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.8125rem;
    font-weight: 500;
  }
  
  .insight-change.positive {
    color: var(--success);
  }
  
  .insight-change.negative {
    color: var(--destructive);
  }
  
  /* Trends Styles */
  .analytics-trends {
    margin-bottom: 2rem;
  }
  
  .analytics-trends h4 {
    margin: 0 0 1rem 0;
    font-size: 1.25rem;
    font-weight: 600;
  }
  
  .trends-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .trend-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 8px;
  }
  
  .trend-item.success {
    border-color: var(--success);
    background: var(--success-background, var(--background));
  }
  
  .trend-item.warning {
    border-color: var(--warning);
    background: var(--warning-background, var(--background));
  }
  
  .trend-item.info {
    border-color: var(--info);
    background: var(--info-background, var(--background));
  }
  
  .trend-icon {
    font-size: 1.5rem;
    opacity: 0.8;
  }
  
  .trend-title {
    font-weight: 600;
    margin-bottom: 0.25rem;
  }
  
  .trend-description {
    font-size: 0.875rem;
    color: var(--muted-foreground);
  }
  
  /* Table Styles */
  .usage-table-container {
    margin-top: 2rem;
  }
  
  .usage-table-container h4 {
    margin: 0 0 1rem 0;
    font-size: 1.25rem;
    font-weight: 600;
  }
  
  .table-wrapper {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: 8px;
  }
  
  .usage-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }
  
  .usage-table th,
  .usage-table td {
    padding: 1rem;
    text-align: left;
    border-bottom: 1px solid var(--border);
  }
  
  .usage-table th {
    background: var(--muted);
    font-weight: 600;
    color: var(--foreground);
  }
  
  .usage-table tbody tr:hover {
    background: var(--muted);
  }
  
  .period-cell {
    min-width: 120px;
  }
  
  .period-main {
    font-weight: 500;
  }
  
  .period-sub {
    font-size: 0.8125rem;
    color: var(--muted-foreground);
  }
  
  .number-cell {
    text-align: right;
    font-weight: 500;
  }
  
  .utilization-cell {
    min-width: 120px;
  }
  
  .utilization-bar {
    width: 60px;
    height: 4px;
    background: var(--muted);
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 0.25rem;
  }
  
  .utilization-fill {
    height: 100%;
    background: var(--primary);
    transition: width 0.3s ease;
  }
  
  .utilization-text {
    font-size: 0.8125rem;
    color: var(--muted-foreground);
  }
  
  .efficiency-cell {
    min-width: 100px;
  }
  
  .efficiency-score {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .efficiency-value {
    font-weight: 500;
    font-size: 0.8125rem;
  }
  
  .efficiency-bar {
    width: 50px;
    height: 3px;
    background: var(--muted);
    border-radius: 2px;
    overflow: hidden;
  }
  
  .efficiency-fill {
    height: 100%;
    transition: width 0.3s ease;
  }
  
  .efficiency-low .efficiency-fill {
    background: var(--warning);
  }
  
  .efficiency-good .efficiency-fill {
    background: var(--success);
  }
  
  .efficiency-high .efficiency-fill {
    background: var(--primary);
  }
  
  /* Empty State */
  .usage-analytics.empty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 300px;
  }
  
  .empty-state {
    text-align: center;
    color: var(--muted-foreground);
  }
  
  .empty-state i {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }
  
  .empty-state h4 {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    font-weight: 600;
  }
  
  .empty-state p {
    margin: 0;
    font-size: 0.875rem;
  }
  
  /* Responsive Design */
  @media (max-width: 768px) {
    .analytics-header {
      flex-direction: column;
      gap: 1rem;
      align-items: flex-start;
    }
    
    .analytics-controls {
      width: 100%;
      justify-content: space-between;
    }
    
    .insights-grid {
      grid-template-columns: 1fr;
    }
    
    .insight-card {
      padding: 1rem;
    }
    
    .trend-item {
      padding: 0.75rem;
    }
    
    .usage-table th,
    .usage-table td {
      padding: 0.75rem 0.5rem;
    }
    
    .chart-container {
      height: 250px;
    }
  }
`;

// Inject styles if not already present
if (!document.getElementById('usage-analytics-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'usage-analytics-styles';
  styleSheet.textContent = usageAnalyticsStyles;
  document.head.appendChild(styleSheet);
}

// Make available globally
window.UsageAnalytics = UsageAnalytics;