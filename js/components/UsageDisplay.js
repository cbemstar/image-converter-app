/**
 * Usage Display Component
 * 
 * Displays current usage, quota progress, and plan information
 * Requirements: 5.1, 5.6, 2.4
 */

import { useUsage } from '../hooks/useUsage.js';

export class UsageDisplay {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      showHistory: false,
      showUpgradeButton: true,
      compact: false,
      autoRefresh: true,
      ...options
    };
    
    this.usage = useUsage();
    this.unsubscribe = null;
    this.isDestroyed = false;
    
    if (!this.container) {
      console.error(`UsageDisplay: Container with id "${containerId}" not found`);
      return;
    }
    
    this.init();
  }

  /**
   * Initialize the component
   */
  async init() {
    // Subscribe to usage updates
    this.unsubscribe = this.usage.subscribe((state) => {
      this.render(state);
    });
    
    // Start auto-refresh if enabled
    if (this.options.autoRefresh) {
      this.usage.startAutoRefresh();
    }
    
    // Initial fetch
    await this.usage.fetchUsage();
  }

  /**
   * Render the usage display
   * @param {Object} state - Current usage state
   */
  render(state) {
    if (this.isDestroyed) return;
    
    const { usage, loading, error } = state;
    
    if (loading && !usage) {
      this.renderLoading();
      return;
    }
    
    if (error) {
      this.renderError(error);
      return;
    }
    
    if (!usage) {
      this.renderEmpty();
      return;
    }
    
    if (this.options.compact) {
      this.renderCompact(usage);
    } else {
      this.renderFull(usage);
    }
  }

  /**
   * Render loading state
   */
  renderLoading() {
    this.container.innerHTML = `
      <div class="usage-display loading">
        <div class="flex items-center gap-2">
          <div class="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full"></div>
          <span class="text-sm text-muted-foreground">Loading usage...</span>
        </div>
      </div>
    `;
  }

  /**
   * Render error state
   * @param {string} error - Error message
   */
  renderError(error) {
    this.container.innerHTML = `
      <div class="usage-display error">
        <div class="flex items-center gap-2 text-destructive">
          <i class="fas fa-exclamation-triangle"></i>
          <span class="text-sm">Error loading usage: ${error}</span>
        </div>
      </div>
    `;
  }

  /**
   * Render empty state
   */
  renderEmpty() {
    this.container.innerHTML = `
      <div class="usage-display empty">
        <div class="text-sm text-muted-foreground">
          <i class="fas fa-chart-bar mr-2"></i>
          No usage data available
        </div>
      </div>
    `;
  }

  /**
   * Render compact usage display
   * @param {Object} usage - Usage data
   */
  renderCompact(usage) {
    const { conversionsUsed, conversionsLimit, remainingConversions, planName } = usage;
    const utilizationPercent = Math.round((conversionsUsed / conversionsLimit) * 100);
    const progressColor = this.getProgressColor(utilizationPercent);
    
    this.container.innerHTML = `
      <div class="usage-display compact">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <div class="plan-badge ${planName.toLowerCase()}">${planName}</div>
            <span class="text-sm text-foreground">
              ${conversionsUsed}/${conversionsLimit} used
            </span>
          </div>
          <div class="flex items-center gap-2">
            <div class="progress-bar-mini">
              <div class="progress-fill" style="width: ${utilizationPercent}%; background-color: ${progressColor}"></div>
            </div>
            ${remainingConversions === 0 ? this.renderUpgradeButton(true) : ''}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render full usage display
   * @param {Object} usage - Usage data
   */
  renderFull(usage) {
    const { 
      conversionsUsed, 
      conversionsLimit, 
      remainingConversions, 
      planName, 
      planStatus,
      periodEnd,
      features = [],
      isGuest = false
    } = usage;
    
    const utilizationPercent = Math.round((conversionsUsed / conversionsLimit) * 100);
    const progressColor = this.getProgressColor(utilizationPercent);
    const resetDate = new Date(periodEnd).toLocaleDateString();
    
    this.container.innerHTML = `
      <div class="usage-display full">
        <div class="usage-header">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-foreground">Usage & Plan</h3>
            <div class="plan-badge ${planName.toLowerCase()}">${planName}</div>
          </div>
          ${planStatus !== 'active' ? `<div class="status-warning">Plan status: ${planStatus}</div>` : ''}
        </div>
        
        <div class="usage-stats">
          <div class="stat-row">
            <span class="stat-label">Conversions Used</span>
            <span class="stat-value">${conversionsUsed} / ${conversionsLimit}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Remaining</span>
            <span class="stat-value ${remainingConversions === 0 ? 'text-destructive' : 'text-success'}">${remainingConversions}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">${isGuest ? 'Resets' : 'Next Reset'}</span>
            <span class="stat-value">${isGuest ? 'Daily' : resetDate}</span>
          </div>
        </div>
        
        <div class="progress-section">
          <div class="flex justify-between text-sm mb-2">
            <span class="text-muted-foreground">Usage</span>
            <span class="text-foreground font-medium">${utilizationPercent}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${utilizationPercent}%; background-color: ${progressColor}"></div>
          </div>
          ${this.renderUsageMessage(utilizationPercent, remainingConversions)}
        </div>
        
        ${features.length > 0 ? this.renderFeatures(features) : ''}
        
        <div class="usage-actions">
          ${this.renderActionButtons(usage)}
        </div>
      </div>
    `;
    
    // Add event listeners
    this.attachEventListeners();
  }

  /**
   * Render plan features
   * @param {Array} features - Array of feature strings
   * @returns {string} HTML for features section
   */
  renderFeatures(features) {
    return `
      <div class="features-section">
        <h4 class="text-sm font-medium text-foreground mb-2">Plan Features</h4>
        <ul class="feature-list">
          ${features.map(feature => `
            <li class="feature-item">
              <i class="fas fa-check text-success"></i>
              <span>${feature}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  /**
   * Render usage message based on utilization
   * @param {number} utilizationPercent - Usage percentage
   * @param {number} remainingConversions - Remaining conversions
   * @returns {string} HTML for usage message
   */
  renderUsageMessage(utilizationPercent, remainingConversions) {
    if (remainingConversions === 0) {
      return `
        <div class="usage-message error">
          <i class="fas fa-exclamation-circle"></i>
          <span>You've reached your conversion limit. Upgrade to continue.</span>
        </div>
      `;
    } else if (utilizationPercent >= 90) {
      return `
        <div class="usage-message warning">
          <i class="fas fa-exclamation-triangle"></i>
          <span>You're running low on conversions. Consider upgrading soon.</span>
        </div>
      `;
    } else if (utilizationPercent >= 75) {
      return `
        <div class="usage-message info">
          <i class="fas fa-info-circle"></i>
          <span>You've used most of your monthly conversions.</span>
        </div>
      `;
    }
    
    return '';
  }

  /**
   * Render action buttons
   * @param {Object} usage - Usage data
   * @returns {string} HTML for action buttons
   */
  renderActionButtons(usage) {
    const { remainingConversions, isGuest } = usage;
    let buttons = [];
    
    if (isGuest) {
      buttons.push(`
        <button class="btn btn-primary" data-action="sign-up">
          <i class="fas fa-user-plus mr-2"></i>
          Sign Up for More
        </button>
      `);
    } else {
      if (remainingConversions === 0 || this.options.showUpgradeButton) {
        buttons.push(this.renderUpgradeButton());
      }
      
      if (this.options.showHistory) {
        buttons.push(`
          <button class="btn btn-secondary" data-action="view-history">
            <i class="fas fa-history mr-2"></i>
            View History
          </button>
        `);
      }
      
      buttons.push(`
        <button class="btn btn-secondary" data-action="refresh">
          <i class="fas fa-sync-alt mr-2"></i>
          Refresh
        </button>
      `);
    }
    
    return buttons.join('');
  }

  /**
   * Render upgrade button
   * @param {boolean} mini - Whether to render mini version
   * @returns {string} HTML for upgrade button
   */
  renderUpgradeButton(mini = false) {
    if (mini) {
      return `
        <button class="btn btn-primary btn-sm" data-action="upgrade">
          <i class="fas fa-arrow-up"></i>
        </button>
      `;
    }
    
    return `
      <button class="btn btn-primary" data-action="upgrade">
        <i class="fas fa-arrow-up mr-2"></i>
        Upgrade Plan
      </button>
    `;
  }

  /**
   * Get progress bar color based on utilization
   * @param {number} percent - Utilization percentage
   * @returns {string} CSS color value
   */
  getProgressColor(percent) {
    if (percent >= 100) return '#ef4444'; // red
    if (percent >= 90) return '#f59e0b';  // amber
    if (percent >= 75) return '#eab308';  // yellow
    return '#10b981'; // green
  }

  /**
   * Attach event listeners to action buttons
   */
  attachEventListeners() {
    const buttons = this.container.querySelectorAll('[data-action]');
    
    buttons.forEach(button => {
      button.addEventListener('click', (e) => {
        const action = e.target.closest('[data-action]').dataset.action;
        this.handleAction(action);
      });
    });
  }

  /**
   * Handle action button clicks
   * @param {string} action - Action to perform
   */
  async handleAction(action) {
    switch (action) {
      case 'refresh':
        await this.usage.refreshUsage();
        break;
        
      case 'upgrade':
        this.showUpgradeModal();
        break;
        
      case 'sign-up':
        this.showSignUpModal();
        break;
        
      case 'view-history':
        await this.showUsageHistory();
        break;
        
      default:
        console.warn(`Unknown action: ${action}`);
    }
  }

  /**
   * Show upgrade modal
   */
  showUpgradeModal() {
    // Use existing upgrade modal if available
    if (window.showUpgradeModal) {
      window.showUpgradeModal();
    } else if (window.toggleStripeAccordion) {
      window.toggleStripeAccordion(true);
    } else {
      // Fallback: redirect to pricing page
      window.location.href = '/pricing.html';
    }
  }

  /**
   * Show sign up modal
   */
  showSignUpModal() {
    // Use existing auth modal if available
    if (window.showAuthModal) {
      window.showAuthModal();
    } else {
      // Fallback: redirect to auth page
      window.location.href = '/auth.html';
    }
  }

  /**
   * Show usage history modal
   */
  async showUsageHistory() {
    try {
      const history = await this.usage.getUsageHistory();
      
      if (history.length === 0) {
        this.showNotification('No usage history available', 'info');
        return;
      }
      
      // Create and show history modal
      this.createHistoryModal(history);
      
    } catch (error) {
      console.error('Error showing usage history:', error);
      this.showNotification('Failed to load usage history', 'error');
    }
  }

  /**
   * Create and show usage history modal
   * @param {Array} history - Usage history data
   */
  createHistoryModal(history) {
    // Remove existing modal if present
    const existingModal = document.getElementById('usage-history-modal');
    if (existingModal) {
      existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'usage-history-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Usage History</h3>
          <button class="modal-close" data-action="close-modal">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="usage-history-table">
            <table>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Plan</th>
                  <th>Used</th>
                  <th>Limit</th>
                  <th>Utilization</th>
                </tr>
              </thead>
              <tbody>
                ${history.map(record => `
                  <tr>
                    <td>${new Date(record.periodStart).toLocaleDateString()} - ${new Date(record.periodEnd).toLocaleDateString()}</td>
                    <td><span class="plan-badge ${record.planName.toLowerCase()}">${record.planName}</span></td>
                    <td>${record.conversionsUsed}</td>
                    <td>${record.conversionsLimit}</td>
                    <td>
                      <div class="utilization-cell">
                        <span>${record.utilizationPercent}%</span>
                        <div class="mini-progress">
                          <div class="mini-progress-fill" style="width: ${record.utilizationPercent}%"></div>
                        </div>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    modal.querySelector('[data-action="close-modal"]').addEventListener('click', () => {
      modal.remove();
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  /**
   * Show notification
   * @param {string} message - Notification message
   * @param {string} type - Notification type
   */
  showNotification(message, type = 'info') {
    if (window.showNotification) {
      window.showNotification(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Update display options
   * @param {Object} newOptions - New options to merge
   */
  updateOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
    
    // Re-render with current state
    const currentState = {
      usage: this.usage.getCurrentUsage(),
      loading: this.usage.isLoading(),
      error: this.usage.getError()
    };
    
    this.render(currentState);
  }

  /**
   * Destroy the component and clean up resources
   */
  destroy() {
    this.isDestroyed = true;
    
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    
    this.usage.stopAutoRefresh();
    
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

// Make available globally
window.UsageDisplay = UsageDisplay;