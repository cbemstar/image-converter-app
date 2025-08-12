/**
 * Quota Progress Indicator Component
 * 
 * Creates visual progress indicators and meters for usage quotas
 * Requirements: 5.1, 5.5, 5.6
 */

export class QuotaProgressIndicator {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      style: 'bar', // 'bar', 'circle', 'mini', 'card'
      showNumbers: true,
      showPercentage: true,
      showRemaining: true,
      animated: true,
      colorThresholds: {
        safe: 60,      // Green below 60%
        warning: 85,   // Yellow between 60-85%
        critical: 95,  // Orange between 85-95%
        danger: 100    // Red at/above 95%
      },
      size: 'medium', // 'small', 'medium', 'large'
      ...options
    };
    
    if (!this.container) {
      console.error(`QuotaProgressIndicator: Container with id "${containerId}" not found`);
      return;
    }
    
    this.currentUsage = null;
    this.animationFrame = null;
  }

  /**
   * Update the progress indicator with new usage data
   * @param {Object} usage - Usage data object
   */
  update(usage) {
    if (!usage || !this.container) return;
    
    this.currentUsage = usage;
    this.render();
  }

  /**
   * Render the progress indicator
   */
  render() {
    if (!this.currentUsage) return;
    
    const { conversionsUsed, conversionsLimit, remainingConversions } = this.currentUsage;
    const percentage = Math.min(100, (conversionsUsed / conversionsLimit) * 100);
    
    switch (this.options.style) {
      case 'circle':
        this.renderCircular(percentage);
        break;
      case 'mini':
        this.renderMini(percentage);
        break;
      case 'card':
        this.renderCard(percentage);
        break;
      default:
        this.renderBar(percentage);
    }
  }

  /**
   * Render bar-style progress indicator
   * @param {number} percentage - Usage percentage
   */
  renderBar(percentage) {
    const { conversionsUsed, conversionsLimit, remainingConversions } = this.currentUsage;
    const color = this.getColorForPercentage(percentage);
    const sizeClass = `quota-progress-${this.options.size}`;
    
    this.container.innerHTML = `
      <div class="quota-progress-bar ${sizeClass}">
        ${this.options.showNumbers ? `
          <div class="quota-progress-header">
            <div class="quota-progress-label">
              <span class="quota-used">${conversionsUsed}</span>
              <span class="quota-separator">/</span>
              <span class="quota-limit">${conversionsLimit}</span>
              <span class="quota-unit">conversions</span>
            </div>
            ${this.options.showPercentage ? `
              <div class="quota-percentage" style="color: ${color}">
                ${Math.round(percentage)}%
              </div>
            ` : ''}
          </div>
        ` : ''}
        
        <div class="quota-progress-track">
          <div class="quota-progress-fill ${this.options.animated ? 'animated' : ''}" 
               style="width: ${percentage}%; background-color: ${color};"
               data-percentage="${percentage}">
          </div>
        </div>
        
        ${this.options.showRemaining ? `
          <div class="quota-progress-footer">
            <span class="quota-remaining">
              ${remainingConversions} remaining
            </span>
            ${this.renderResetInfo()}
          </div>
        ` : ''}
      </div>
    `;
    
    if (this.options.animated) {
      this.animateProgress();
    }
  }

  /**
   * Render circular progress indicator
   * @param {number} percentage - Usage percentage
   */
  renderCircular(percentage) {
    const { conversionsUsed, conversionsLimit, remainingConversions } = this.currentUsage;
    const color = this.getColorForPercentage(percentage);
    const radius = this.getCircularRadius();
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;
    const sizeClass = `quota-progress-${this.options.size}`;
    
    this.container.innerHTML = `
      <div class="quota-progress-circular ${sizeClass}">
        <div class="quota-progress-circle-container">
          <svg class="quota-progress-svg" width="${(radius + 10) * 2}" height="${(radius + 10) * 2}">
            <circle
              class="quota-progress-track-circle"
              cx="${radius + 10}"
              cy="${radius + 10}"
              r="${radius}"
              fill="none"
              stroke="var(--muted)"
              stroke-width="8"
            />
            <circle
              class="quota-progress-fill-circle ${this.options.animated ? 'animated' : ''}"
              cx="${radius + 10}"
              cy="${radius + 10}"
              r="${radius}"
              fill="none"
              stroke="${color}"
              stroke-width="8"
              stroke-linecap="round"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${strokeDashoffset}"
              transform="rotate(-90 ${radius + 10} ${radius + 10})"
            />
          </svg>
          
          <div class="quota-progress-center">
            ${this.options.showPercentage ? `
              <div class="quota-percentage-large" style="color: ${color}">
                ${Math.round(percentage)}%
              </div>
            ` : ''}
            ${this.options.showNumbers ? `
              <div class="quota-numbers-small">
                ${conversionsUsed}/${conversionsLimit}
              </div>
            ` : ''}
          </div>
        </div>
        
        ${this.options.showRemaining ? `
          <div class="quota-progress-footer">
            <span class="quota-remaining">
              ${remainingConversions} remaining
            </span>
          </div>
        ` : ''}
      </div>
    `;
    
    if (this.options.animated) {
      this.animateCircularProgress();
    }
  }

  /**
   * Render mini progress indicator
   * @param {number} percentage - Usage percentage
   */
  renderMini(percentage) {
    const { conversionsUsed, conversionsLimit } = this.currentUsage;
    const color = this.getColorForPercentage(percentage);
    
    this.container.innerHTML = `
      <div class="quota-progress-mini">
        <div class="quota-mini-info">
          <span class="quota-mini-text">${conversionsUsed}/${conversionsLimit}</span>
          <span class="quota-mini-percentage" style="color: ${color}">
            ${Math.round(percentage)}%
          </span>
        </div>
        <div class="quota-mini-track">
          <div class="quota-mini-fill ${this.options.animated ? 'animated' : ''}" 
               style="width: ${percentage}%; background-color: ${color};">
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render card-style progress indicator
   * @param {number} percentage - Usage percentage
   */
  renderCard(percentage) {
    const { conversionsUsed, conversionsLimit, remainingConversions, planName } = this.currentUsage;
    const color = this.getColorForPercentage(percentage);
    const statusText = this.getStatusText(percentage);
    
    this.container.innerHTML = `
      <div class="quota-progress-card">
        <div class="quota-card-header">
          <div class="quota-card-title">
            <h4>Usage This Month</h4>
            <span class="plan-badge ${planName?.toLowerCase() || 'free'}">${planName || 'Free'}</span>
          </div>
          <div class="quota-card-percentage" style="color: ${color}">
            ${Math.round(percentage)}%
          </div>
        </div>
        
        <div class="quota-card-progress">
          <div class="quota-progress-track">
            <div class="quota-progress-fill ${this.options.animated ? 'animated' : ''}" 
                 style="width: ${percentage}%; background-color: ${color};">
            </div>
          </div>
        </div>
        
        <div class="quota-card-stats">
          <div class="quota-stat">
            <span class="quota-stat-label">Used</span>
            <span class="quota-stat-value">${conversionsUsed}</span>
          </div>
          <div class="quota-stat">
            <span class="quota-stat-label">Limit</span>
            <span class="quota-stat-value">${conversionsLimit}</span>
          </div>
          <div class="quota-stat">
            <span class="quota-stat-label">Remaining</span>
            <span class="quota-stat-value" style="color: ${remainingConversions === 0 ? 'var(--destructive)' : 'var(--success)'}">
              ${remainingConversions}
            </span>
          </div>
        </div>
        
        <div class="quota-card-status">
          <span class="quota-status-text" style="color: ${color}">
            ${statusText}
          </span>
          ${this.renderResetInfo()}
        </div>
      </div>
    `;
    
    if (this.options.animated) {
      this.animateProgress();
    }
  }

  /**
   * Get color based on usage percentage
   * @param {number} percentage - Usage percentage
   * @returns {string} CSS color value
   */
  getColorForPercentage(percentage) {
    const { colorThresholds } = this.options;
    
    if (percentage >= colorThresholds.danger) {
      return 'var(--destructive, #ef4444)';
    } else if (percentage >= colorThresholds.critical) {
      return 'var(--warning, #f59e0b)';
    } else if (percentage >= colorThresholds.warning) {
      return 'var(--warning-light, #fbbf24)';
    } else {
      return 'var(--success, #10b981)';
    }
  }

  /**
   * Get status text based on usage percentage
   * @param {number} percentage - Usage percentage
   * @returns {string} Status text
   */
  getStatusText(percentage) {
    if (percentage >= 100) {
      return 'Quota exceeded';
    } else if (percentage >= 95) {
      return 'Almost at limit';
    } else if (percentage >= 85) {
      return 'Running low';
    } else if (percentage >= 60) {
      return 'Good usage';
    } else {
      return 'Plenty available';
    }
  }

  /**
   * Get circular progress radius based on size
   * @returns {number} Radius in pixels
   */
  getCircularRadius() {
    const radiusMap = {
      small: 30,
      medium: 45,
      large: 60
    };
    
    return radiusMap[this.options.size] || radiusMap.medium;
  }

  /**
   * Render reset information
   * @returns {string} HTML for reset info
   */
  renderResetInfo() {
    const { periodEnd, isGuest } = this.currentUsage;
    
    if (isGuest) {
      return '<span class="quota-reset-info">Resets daily</span>';
    }
    
    if (periodEnd) {
      const resetDate = new Date(periodEnd);
      const now = new Date();
      const daysUntilReset = Math.ceil((resetDate - now) / (1000 * 60 * 60 * 24));
      
      if (daysUntilReset <= 0) {
        return '<span class="quota-reset-info">Resets soon</span>';
      } else if (daysUntilReset === 1) {
        return '<span class="quota-reset-info">Resets tomorrow</span>';
      } else if (daysUntilReset <= 7) {
        return `<span class="quota-reset-info">Resets in ${daysUntilReset} days</span>`;
      } else {
        return `<span class="quota-reset-info">Resets ${resetDate.toLocaleDateString()}</span>`;
      }
    }
    
    return '';
  }

  /**
   * Animate progress bar
   */
  animateProgress() {
    const progressFill = this.container.querySelector('.quota-progress-fill');
    if (!progressFill) return;
    
    // Start from 0 and animate to target
    progressFill.style.width = '0%';
    
    requestAnimationFrame(() => {
      const targetWidth = progressFill.dataset.percentage + '%';
      progressFill.style.width = targetWidth;
    });
  }

  /**
   * Animate circular progress
   */
  animateCircularProgress() {
    const progressCircle = this.container.querySelector('.quota-progress-fill-circle');
    if (!progressCircle) return;
    
    const circumference = parseFloat(progressCircle.getAttribute('stroke-dasharray'));
    
    // Start from full offset (0% progress)
    progressCircle.style.strokeDashoffset = circumference;
    
    requestAnimationFrame(() => {
      const percentage = (this.currentUsage.conversionsUsed / this.currentUsage.conversionsLimit) * 100;
      const targetOffset = circumference - (percentage / 100) * circumference;
      progressCircle.style.strokeDashoffset = targetOffset;
    });
  }

  /**
   * Update options and re-render
   * @param {Object} newOptions - New options to merge
   */
  updateOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
    if (this.currentUsage) {
      this.render();
    }
  }

  /**
   * Get current usage data
   * @returns {Object|null} Current usage data
   */
  getCurrentUsage() {
    return this.currentUsage;
  }

  /**
   * Destroy the component
   */
  destroy() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    
    if (this.container) {
      this.container.innerHTML = '';
    }
    
    this.currentUsage = null;
  }
}

// Add CSS styles for quota progress indicators
const quotaProgressStyles = `
  /* Base Quota Progress Styles */
  .quota-progress-bar,
  .quota-progress-circular,
  .quota-progress-mini,
  .quota-progress-card {
    font-family: inherit;
    color: var(--foreground);
  }
  
  /* Bar Progress Indicator */
  .quota-progress-bar {
    width: 100%;
  }
  
  .quota-progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  
  .quota-progress-label {
    font-size: 14px;
    color: var(--foreground);
  }
  
  .quota-used {
    font-weight: 600;
  }
  
  .quota-separator {
    margin: 0 4px;
    color: var(--muted-foreground);
  }
  
  .quota-limit {
    color: var(--muted-foreground);
  }
  
  .quota-unit {
    margin-left: 4px;
    color: var(--muted-foreground);
    font-size: 12px;
  }
  
  .quota-percentage {
    font-weight: 600;
    font-size: 14px;
  }
  
  .quota-progress-track {
    width: 100%;
    height: 8px;
    background: var(--muted);
    border-radius: 4px;
    overflow: hidden;
    position: relative;
  }
  
  .quota-progress-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.8s ease-in-out;
  }
  
  .quota-progress-fill.animated {
    transition: width 1.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .quota-progress-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 8px;
    font-size: 12px;
    color: var(--muted-foreground);
  }
  
  .quota-remaining {
    font-weight: 500;
  }
  
  .quota-reset-info {
    font-size: 11px;
    opacity: 0.8;
  }
  
  /* Size Variations */
  .quota-progress-small .quota-progress-track {
    height: 4px;
  }
  
  .quota-progress-small .quota-progress-header,
  .quota-progress-small .quota-progress-footer {
    font-size: 12px;
  }
  
  .quota-progress-large .quota-progress-track {
    height: 12px;
  }
  
  .quota-progress-large .quota-progress-header,
  .quota-progress-large .quota-progress-footer {
    font-size: 16px;
  }
  
  /* Circular Progress Indicator */
  .quota-progress-circular {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .quota-progress-circle-container {
    position: relative;
    display: inline-block;
  }
  
  .quota-progress-svg {
    transform: rotate(-90deg);
  }
  
  .quota-progress-fill-circle {
    transition: stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .quota-progress-center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
  }
  
  .quota-percentage-large {
    font-size: 18px;
    font-weight: 700;
    line-height: 1;
  }
  
  .quota-numbers-small {
    font-size: 11px;
    color: var(--muted-foreground);
    margin-top: 2px;
  }
  
  /* Mini Progress Indicator */
  .quota-progress-mini {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .quota-mini-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
  }
  
  .quota-mini-text {
    font-weight: 500;
  }
  
  .quota-mini-percentage {
    font-weight: 600;
  }
  
  .quota-mini-track {
    width: 100%;
    height: 3px;
    background: var(--muted);
    border-radius: 2px;
    overflow: hidden;
  }
  
  .quota-mini-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.8s ease-in-out;
  }
  
  /* Card Progress Indicator */
  .quota-progress-card {
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
  }
  
  .quota-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
  }
  
  .quota-card-title {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .quota-card-title h4 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--foreground);
  }
  
  .quota-card-percentage {
    font-size: 24px;
    font-weight: 700;
  }
  
  .quota-card-progress {
    margin-bottom: 16px;
  }
  
  .quota-card-stats {
    display: flex;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  
  .quota-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  
  .quota-stat-label {
    font-size: 11px;
    color: var(--muted-foreground);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .quota-stat-value {
    font-size: 16px;
    font-weight: 600;
    color: var(--foreground);
  }
  
  .quota-card-status {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
  }
  
  .quota-status-text {
    font-weight: 500;
  }
  
  /* Responsive Design */
  @media (max-width: 768px) {
    .quota-progress-header,
    .quota-progress-footer {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }
    
    .quota-card-header {
      flex-direction: column;
      gap: 8px;
    }
    
    .quota-card-stats {
      flex-direction: column;
      gap: 8px;
    }
    
    .quota-stat {
      flex-direction: row;
      justify-content: space-between;
    }
  }
  
  /* Dark Mode Adjustments */
  @media (prefers-color-scheme: dark) {
    .quota-progress-card {
      background: var(--card-background, var(--background));
      border-color: var(--card-border, var(--border));
    }
  }
  
  /* High Contrast Mode */
  @media (prefers-contrast: high) {
    .quota-progress-track,
    .quota-mini-track {
      border: 1px solid var(--foreground);
    }
    
    .quota-progress-card {
      border-width: 2px;
    }
  }
  
  /* Animation for reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .quota-progress-fill,
    .quota-progress-fill-circle,
    .quota-mini-fill {
      transition: none;
    }
  }
`;

// Inject styles if not already present
if (!document.getElementById('quota-progress-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'quota-progress-styles';
  styleSheet.textContent = quotaProgressStyles;
  document.head.appendChild(styleSheet);
}

// Make available globally
window.QuotaProgressIndicator = QuotaProgressIndicator;