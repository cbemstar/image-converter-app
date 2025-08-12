/**
 * Quota Management UI Component
 * 
 * Integrated UI that combines quota display, plan comparison, and usage analytics
 * Requirements: 5.1, 5.5, 5.6
 */

import { useUsage } from '../hooks/useUsage.js';
import { QuotaProgressIndicator } from './QuotaProgressIndicator.js';
import { PlanComparisonUI } from './PlanComparisonUI.js';
import { UsageAnalytics } from './UsageAnalytics.js';

export class QuotaManagementUI {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      showQuotaProgress: true,
      showPlanComparison: true,
      showUsageAnalytics: true,
      showUpgradePrompts: true,
      layout: 'tabs', // 'tabs', 'accordion', 'stacked'
      defaultTab: 'overview',
      compactMode: false,
      ...options
    };
    
    if (!this.container) {
      console.error(`QuotaManagementUI: Container with id "${containerId}" not found`);
      return;
    }
    
    this.usage = useUsage();
    this.components = {};
    this.currentUsage = null;
    this.usageHistory = [];
    this.unsubscribe = null;
    this.activeTab = this.options.defaultTab;
    
    this.init();
  }

  /**
   * Initialize the component
   */
  async init() {
    // Subscribe to usage updates
    this.unsubscribe = this.usage.subscribe((state) => {
      this.handleUsageUpdate(state);
    });
    
    // Initial render
    this.render();
    
    // Fetch initial data
    await this.usage.fetchUsage();
    
    // Load usage history if analytics are enabled
    if (this.options.showUsageAnalytics) {
      await this.loadUsageHistory();
    }
  }

  /**
   * Handle usage updates
   * @param {Object} state - Usage state
   */
  handleUsageUpdate(state) {
    const { usage, loading, error } = state;
    
    if (usage) {
      this.currentUsage = usage;
      this.updateComponents();
    }
    
    if (error) {
      this.showError(error);
    }
  }

  /**
   * Load usage history
   */
  async loadUsageHistory() {
    try {
      this.usageHistory = await this.usage.getUsageHistory(12);
      this.updateComponents();
    } catch (error) {
      console.error('Error loading usage history:', error);
    }
  }

  /**
   * Render the main UI
   */
  render() {
    if (this.options.layout === 'tabs') {
      this.renderTabs();
    } else if (this.options.layout === 'accordion') {
      this.renderAccordion();
    } else {
      this.renderStacked();
    }
    
    this.attachEventListeners();
  }

  /**
   * Render tabs layout
   */
  renderTabs() {
    this.container.innerHTML = `
      <div class="quota-management-ui tabs-layout">
        <div class="quota-tabs">
          <button class="quota-tab ${this.activeTab === 'overview' ? 'active' : ''}" 
                  data-tab="overview">
            <i class="fas fa-tachometer-alt"></i>
            <span>Overview</span>
          </button>
          ${this.options.showPlanComparison ? `
            <button class="quota-tab ${this.activeTab === 'plans' ? 'active' : ''}" 
                    data-tab="plans">
              <i class="fas fa-layer-group"></i>
              <span>Plans</span>
            </button>
          ` : ''}
          ${this.options.showUsageAnalytics ? `
            <button class="quota-tab ${this.activeTab === 'analytics' ? 'active' : ''}" 
                    data-tab="analytics">
              <i class="fas fa-chart-line"></i>
              <span>Analytics</span>
            </button>
          ` : ''}
        </div>
        
        <div class="quota-tab-content">
          <div class="quota-tab-panel ${this.activeTab === 'overview' ? 'active' : ''}" 
               data-panel="overview">
            ${this.renderOverviewPanel()}
          </div>
          ${this.options.showPlanComparison ? `
            <div class="quota-tab-panel ${this.activeTab === 'plans' ? 'active' : ''}" 
                 data-panel="plans">
              <div id="plan-comparison-container"></div>
            </div>
          ` : ''}
          ${this.options.showUsageAnalytics ? `
            <div class="quota-tab-panel ${this.activeTab === 'analytics' ? 'active' : ''}" 
                 data-panel="analytics">
              <div id="usage-analytics-container"></div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Render accordion layout
   */
  renderAccordion() {
    this.container.innerHTML = `
      <div class="quota-management-ui accordion-layout">
        <div class="quota-accordion">
          <div class="accordion-section ${this.activeTab === 'overview' ? 'active' : ''}">
            <button class="accordion-header" data-section="overview">
              <i class="fas fa-tachometer-alt"></i>
              <span>Usage Overview</span>
              <i class="fas fa-chevron-down accordion-chevron"></i>
            </button>
            <div class="accordion-content">
              ${this.renderOverviewPanel()}
            </div>
          </div>
          
          ${this.options.showPlanComparison ? `
            <div class="accordion-section ${this.activeTab === 'plans' ? 'active' : ''}">
              <button class="accordion-header" data-section="plans">
                <i class="fas fa-layer-group"></i>
                <span>Plan Comparison</span>
                <i class="fas fa-chevron-down accordion-chevron"></i>
              </button>
              <div class="accordion-content">
                <div id="plan-comparison-container"></div>
              </div>
            </div>
          ` : ''}
          
          ${this.options.showUsageAnalytics ? `
            <div class="accordion-section ${this.activeTab === 'analytics' ? 'active' : ''}">
              <button class="accordion-header" data-section="analytics">
                <i class="fas fa-chart-line"></i>
                <span>Usage Analytics</span>
                <i class="fas fa-chevron-down accordion-chevron"></i>
              </button>
              <div class="accordion-content">
                <div id="usage-analytics-container"></div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Render stacked layout
   */
  renderStacked() {
    this.container.innerHTML = `
      <div class="quota-management-ui stacked-layout">
        <div class="quota-section overview-section">
          ${this.renderOverviewPanel()}
        </div>
        
        ${this.options.showPlanComparison ? `
          <div class="quota-section plans-section">
            <h3>Plan Options</h3>
            <div id="plan-comparison-container"></div>
          </div>
        ` : ''}
        
        ${this.options.showUsageAnalytics ? `
          <div class="quota-section analytics-section">
            <div id="usage-analytics-container"></div>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render overview panel
   * @returns {string} HTML for overview panel
   */
  renderOverviewPanel() {
    return `
      <div class="overview-panel">
        <div class="overview-grid">
          <div class="overview-main">
            <div id="quota-progress-container"></div>
            ${this.renderQuickActions()}
          </div>
          <div class="overview-sidebar">
            ${this.renderQuickStats()}
            ${this.renderUpgradePrompt()}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render quick actions
   * @returns {string} HTML for quick actions
   */
  renderQuickActions() {
    return `
      <div class="quick-actions">
        <h4>Quick Actions</h4>
        <div class="action-buttons">
          <button class="btn btn-primary" data-action="upgrade">
            <i class="fas fa-arrow-up"></i>
            Upgrade Plan
          </button>
          <button class="btn btn-secondary" data-action="refresh">
            <i class="fas fa-sync-alt"></i>
            Refresh Usage
          </button>
          <button class="btn btn-secondary" data-action="view-history">
            <i class="fas fa-history"></i>
            View History
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render quick stats
   * @returns {string} HTML for quick stats
   */
  renderQuickStats() {
    if (!this.currentUsage) {
      return `
        <div class="quick-stats">
          <h4>Usage Stats</h4>
          <div class="stats-loading">
            <i class="fas fa-spinner fa-spin"></i>
            Loading...
          </div>
        </div>
      `;
    }
    
    const { conversionsUsed, conversionsLimit, remainingConversions, planName } = this.currentUsage;
    const utilizationPercent = (conversionsUsed / conversionsLimit) * 100;
    
    return `
      <div class="quick-stats">
        <h4>Usage Stats</h4>
        <div class="stat-items">
          <div class="stat-item">
            <div class="stat-label">Current Plan</div>
            <div class="stat-value">
              <span class="plan-badge ${planName?.toLowerCase() || 'free'}">${planName || 'Free'}</span>
            </div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Used This Month</div>
            <div class="stat-value">${conversionsUsed.toLocaleString()}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Remaining</div>
            <div class="stat-value ${remainingConversions === 0 ? 'text-destructive' : 'text-success'}">
              ${remainingConversions.toLocaleString()}
            </div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Utilization</div>
            <div class="stat-value">${Math.round(utilizationPercent)}%</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render upgrade prompt
   * @returns {string} HTML for upgrade prompt
   */
  renderUpgradePrompt() {
    if (!this.options.showUpgradePrompts || !this.currentUsage) {
      return '';
    }
    
    const { remainingConversions, planName, conversionsUsed, conversionsLimit } = this.currentUsage;
    const utilizationPercent = (conversionsUsed / conversionsLimit) * 100;
    
    // Show upgrade prompt based on usage
    let showPrompt = false;
    let promptMessage = '';
    let promptType = 'info';
    
    if (remainingConversions === 0) {
      showPrompt = true;
      promptMessage = 'You\'ve reached your monthly limit. Upgrade to continue converting images.';
      promptType = 'error';
    } else if (utilizationPercent >= 90) {
      showPrompt = true;
      promptMessage = 'You\'re running low on conversions. Consider upgrading to avoid interruptions.';
      promptType = 'warning';
    } else if (planName === 'Free' && utilizationPercent >= 50) {
      showPrompt = true;
      promptMessage = 'Upgrade to Pro for more conversions and advanced features.';
      promptType = 'info';
    }
    
    if (!showPrompt) {
      return '';
    }
    
    return `
      <div class="upgrade-prompt ${promptType}">
        <div class="prompt-icon">
          <i class="fas fa-${promptType === 'error' ? 'exclamation-circle' : promptType === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        </div>
        <div class="prompt-content">
          <div class="prompt-message">${promptMessage}</div>
          <button class="btn btn-primary btn-sm" data-action="upgrade">
            View Plans
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Initialize child components
   */
  initializeComponents() {
    // Initialize quota progress indicator
    if (this.options.showQuotaProgress) {
      const progressContainer = this.container.querySelector('#quota-progress-container');
      if (progressContainer) {
        progressContainer.innerHTML = '<div id="quota-progress-indicator"></div>';
        this.components.quotaProgress = new QuotaProgressIndicator('quota-progress-indicator', {
          style: this.options.compactMode ? 'mini' : 'card',
          animated: true
        });
      }
    }
    
    // Initialize plan comparison
    if (this.options.showPlanComparison) {
      const planContainer = this.container.querySelector('#plan-comparison-container');
      if (planContainer) {
        this.components.planComparison = new PlanComparisonUI('plan-comparison-container', {
          compactMode: this.options.compactMode,
          currentPlan: this.currentUsage?.planName?.toLowerCase()
        });
      }
    }
    
    // Initialize usage analytics
    if (this.options.showUsageAnalytics) {
      const analyticsContainer = this.container.querySelector('#usage-analytics-container');
      if (analyticsContainer) {
        this.components.usageAnalytics = new UsageAnalytics('usage-analytics-container', {
          showChart: true,
          showInsights: true,
          showTrends: true
        });
      }
    }
  }

  /**
   * Update all child components
   */
  updateComponents() {
    // Update quota progress
    if (this.components.quotaProgress && this.currentUsage) {
      this.components.quotaProgress.update(this.currentUsage);
    }
    
    // Update plan comparison
    if (this.components.planComparison && this.currentUsage) {
      this.components.planComparison.updateUsage(this.currentUsage);
    }
    
    // Update usage analytics
    if (this.components.usageAnalytics && this.currentUsage) {
      this.components.usageAnalytics.update(this.currentUsage, this.usageHistory);
    }
    
    // Re-render overview panel to update stats
    if (this.options.layout === 'tabs' || this.options.layout === 'accordion') {
      const overviewPanel = this.container.querySelector('[data-panel="overview"], .accordion-content');
      if (overviewPanel) {
        overviewPanel.innerHTML = this.renderOverviewPanel();
        
        // Re-initialize quota progress if needed
        if (this.options.showQuotaProgress) {
          const progressContainer = overviewPanel.querySelector('#quota-progress-container');
          if (progressContainer) {
            progressContainer.innerHTML = '<div id="quota-progress-indicator"></div>';
            this.components.quotaProgress = new QuotaProgressIndicator('quota-progress-indicator', {
              style: this.options.compactMode ? 'mini' : 'card',
              animated: true
            });
            if (this.currentUsage) {
              this.components.quotaProgress.update(this.currentUsage);
            }
          }
        }
      }
    }
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Tab navigation
    this.container.addEventListener('click', (e) => {
      if (e.target.matches('.quota-tab')) {
        const tab = e.target.dataset.tab;
        this.switchTab(tab);
      } else if (e.target.matches('.accordion-header')) {
        const section = e.target.dataset.section;
        this.toggleAccordionSection(section);
      } else if (e.target.matches('[data-action]')) {
        const action = e.target.dataset.action;
        this.handleAction(action);
      }
    });
    
    // Listen for plan upgrade events
    this.container.addEventListener('planUpgrade', (e) => {
      this.handlePlanUpgrade(e.detail);
    });
    
    // Listen for analytics time range changes
    this.container.addEventListener('timeRangeChange', async (e) => {
      await this.loadUsageHistory();
    });
    
    // Initialize components after DOM is ready
    setTimeout(() => {
      this.initializeComponents();
      this.updateComponents();
    }, 100);
  }

  /**
   * Switch active tab
   * @param {string} tabName - Tab to switch to
   */
  switchTab(tabName) {
    this.activeTab = tabName;
    
    // Update tab buttons
    this.container.querySelectorAll('.quota-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Update tab panels
    this.container.querySelectorAll('.quota-tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.dataset.panel === tabName);
    });
  }

  /**
   * Toggle accordion section
   * @param {string} sectionName - Section to toggle
   */
  toggleAccordionSection(sectionName) {
    const section = this.container.querySelector(`[data-section="${sectionName}"]`).closest('.accordion-section');
    const isActive = section.classList.contains('active');
    
    // Close all sections
    this.container.querySelectorAll('.accordion-section').forEach(s => {
      s.classList.remove('active');
    });
    
    // Open clicked section if it wasn't active
    if (!isActive) {
      section.classList.add('active');
      this.activeTab = sectionName;
    }
  }

  /**
   * Handle action button clicks
   * @param {string} action - Action to perform
   */
  async handleAction(action) {
    switch (action) {
      case 'upgrade':
        this.showUpgradeModal();
        break;
        
      case 'refresh':
        await this.refreshUsage();
        break;
        
      case 'view-history':
        this.switchToAnalytics();
        break;
        
      default:
        console.warn(`Unknown action: ${action}`);
    }
  }

  /**
   * Handle plan upgrade
   * @param {Object} detail - Upgrade detail
   */
  handlePlanUpgrade(detail) {
    console.log('Plan upgrade requested:', detail);
    this.showUpgradeModal(detail.planId);
  }

  /**
   * Show upgrade modal
   * @param {string} planId - Optional plan ID to pre-select
   */
  showUpgradeModal(planId = null) {
    if (window.showUpgradeModal) {
      window.showUpgradeModal(planId);
    } else if (window.toggleStripeAccordion) {
      window.toggleStripeAccordion(true);
    } else {
      window.location.href = planId ? `/pricing.html?plan=${planId}` : '/pricing.html';
    }
  }

  /**
   * Refresh usage data
   */
  async refreshUsage() {
    try {
      await this.usage.refreshUsage();
      
      if (this.options.showUsageAnalytics) {
        await this.loadUsageHistory();
      }
      
      this.showNotification('Usage data refreshed', 'success');
    } catch (error) {
      console.error('Error refreshing usage:', error);
      this.showNotification('Failed to refresh usage data', 'error');
    }
  }

  /**
   * Switch to analytics tab
   */
  switchToAnalytics() {
    if (this.options.showUsageAnalytics) {
      if (this.options.layout === 'tabs') {
        this.switchTab('analytics');
      } else if (this.options.layout === 'accordion') {
        this.toggleAccordionSection('analytics');
      }
    }
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
   * Show error message
   * @param {string} error - Error message
   */
  showError(error) {
    this.showNotification(`Error: ${error}`, 'error');
  }

  /**
   * Update options and re-render
   * @param {Object} newOptions - New options to merge
   */
  updateOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
    this.render();
    
    setTimeout(() => {
      this.initializeComponents();
      this.updateComponents();
    }, 100);
  }

  /**
   * Get current usage data
   * @returns {Object|null} Current usage data
   */
  getCurrentUsage() {
    return this.currentUsage;
  }

  /**
   * Destroy the component and clean up resources
   */
  destroy() {
    // Unsubscribe from usage updates
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    
    // Destroy child components
    Object.values(this.components).forEach(component => {
      if (component && typeof component.destroy === 'function') {
        component.destroy();
      }
    });
    
    this.components = {};
    
    // Clear container
    if (this.container) {
      this.container.innerHTML = '';
    }
    
    this.currentUsage = null;
    this.usageHistory = [];
  }
}

// Add CSS styles for quota management UI
const quotaManagementStyles = `
  /* Quota Management UI Base Styles */
  .quota-management-ui {
    font-family: inherit;
    color: var(--foreground);
  }
  
  /* Tabs Layout */
  .tabs-layout .quota-tabs {
    display: flex;
    border-bottom: 1px solid var(--border);
    margin-bottom: 2rem;
  }
  
  .quota-tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 1.5rem;
    background: none;
    border: none;
    color: var(--muted-foreground);
    cursor: pointer;
    transition: all 0.2s ease;
    border-bottom: 2px solid transparent;
  }
  
  .quota-tab:hover {
    color: var(--foreground);
    background: var(--muted);
  }
  
  .quota-tab.active {
    color: var(--primary);
    border-bottom-color: var(--primary);
  }
  
  .quota-tab-content {
    position: relative;
  }
  
  .quota-tab-panel {
    display: none;
  }
  
  .quota-tab-panel.active {
    display: block;
  }
  
  /* Accordion Layout */
  .accordion-layout .quota-accordion {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .accordion-section {
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }
  
  .accordion-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    width: 100%;
    padding: 1rem 1.5rem;
    background: none;
    border: none;
    color: var(--foreground);
    cursor: pointer;
    transition: all 0.2s ease;
    font-weight: 500;
  }
  
  .accordion-header:hover {
    background: var(--muted);
  }
  
  .accordion-chevron {
    margin-left: auto;
    transition: transform 0.2s ease;
  }
  
  .accordion-section.active .accordion-chevron {
    transform: rotate(180deg);
  }
  
  .accordion-content {
    display: none;
    padding: 0 1.5rem 1.5rem 1.5rem;
  }
  
  .accordion-section.active .accordion-content {
    display: block;
  }
  
  /* Stacked Layout */
  .stacked-layout .quota-section {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 8px;
  }
  
  .stacked-layout .quota-section h3 {
    margin: 0 0 1rem 0;
    font-size: 1.25rem;
    font-weight: 600;
  }
  
  /* Overview Panel */
  .overview-panel {
    width: 100%;
  }
  
  .overview-grid {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 2rem;
  }
  
  .overview-main {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  
  .overview-sidebar {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  
  /* Quick Actions */
  .quick-actions {
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1.5rem;
  }
  
  .quick-actions h4 {
    margin: 0 0 1rem 0;
    font-size: 1.125rem;
    font-weight: 600;
  }
  
  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .action-buttons .btn {
    justify-content: flex-start;
    gap: 0.5rem;
  }
  
  /* Quick Stats */
  .quick-stats {
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1.5rem;
  }
  
  .quick-stats h4 {
    margin: 0 0 1rem 0;
    font-size: 1.125rem;
    font-weight: 600;
  }
  
  .stats-loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--muted-foreground);
  }
  
  .stat-items {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .stat-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .stat-label {
    font-size: 0.875rem;
    color: var(--muted-foreground);
  }
  
  .stat-value {
    font-weight: 600;
    color: var(--foreground);
  }
  
  .stat-value.text-destructive {
    color: var(--destructive);
  }
  
  .stat-value.text-success {
    color: var(--success);
  }
  
  /* Upgrade Prompt */
  .upgrade-prompt {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem;
    border-radius: 8px;
    border: 1px solid;
  }
  
  .upgrade-prompt.info {
    background: var(--info-background, #eff6ff);
    border-color: var(--info, #3b82f6);
    color: var(--info-foreground, #1e40af);
  }
  
  .upgrade-prompt.warning {
    background: var(--warning-background, #fef3c7);
    border-color: var(--warning, #f59e0b);
    color: var(--warning-foreground, #92400e);
  }
  
  .upgrade-prompt.error {
    background: var(--destructive-background, #fef2f2);
    border-color: var(--destructive, #ef4444);
    color: var(--destructive-foreground, #991b1b);
  }
  
  .prompt-icon {
    font-size: 1.25rem;
    margin-top: 0.125rem;
  }
  
  .prompt-content {
    flex: 1;
  }
  
  .prompt-message {
    font-size: 0.875rem;
    margin-bottom: 0.75rem;
    line-height: 1.4;
  }
  
  /* Button Styles */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    font-weight: 500;
    text-decoration: none;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.2s ease;
    font-size: 0.875rem;
    gap: 0.5rem;
  }
  
  .btn-primary {
    background: var(--primary);
    color: var(--primary-foreground);
    border-color: var(--primary);
  }
  
  .btn-primary:hover {
    background: var(--primary-hover, var(--primary));
    transform: translateY(-1px);
  }
  
  .btn-secondary {
    background: var(--secondary);
    color: var(--secondary-foreground);
    border-color: var(--border);
  }
  
  .btn-secondary:hover {
    background: var(--secondary-hover, var(--secondary));
    border-color: var(--primary);
  }
  
  .btn-sm {
    padding: 0.5rem 0.75rem;
    font-size: 0.8125rem;
  }
  
  /* Plan Badge */
  .plan-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }
  
  .plan-badge.free,
  .plan-badge.guest {
    background: var(--muted);
    color: var(--muted-foreground);
  }
  
  .plan-badge.pro {
    background: var(--primary-background, #dbeafe);
    color: var(--primary-foreground, #1e40af);
  }
  
  .plan-badge.unlimited {
    background: var(--success-background, #ecfdf5);
    color: var(--success-foreground, #065f46);
  }
  
  /* Responsive Design */
  @media (max-width: 768px) {
    .overview-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }
    
    .quota-tabs {
      flex-direction: column;
    }
    
    .quota-tab {
      padding: 0.75rem 1rem;
      border-bottom: none;
      border-left: 2px solid transparent;
    }
    
    .quota-tab.active {
      border-left-color: var(--primary);
      border-bottom-color: transparent;
    }
    
    .action-buttons {
      flex-direction: column;
    }
    
    .upgrade-prompt {
      flex-direction: column;
      gap: 0.75rem;
    }
    
    .prompt-icon {
      align-self: flex-start;
    }
  }
  
  /* Dark Mode Adjustments */
  @media (prefers-color-scheme: dark) {
    .upgrade-prompt.info {
      background: rgba(59, 130, 246, 0.1);
      color: #93c5fd;
      border-color: rgba(59, 130, 246, 0.3);
    }
    
    .upgrade-prompt.warning {
      background: rgba(245, 158, 11, 0.1);
      color: #fcd34d;
      border-color: rgba(245, 158, 11, 0.3);
    }
    
    .upgrade-prompt.error {
      background: rgba(239, 68, 68, 0.1);
      color: #fca5a5;
      border-color: rgba(239, 68, 68, 0.3);
    }
  }
`;

// Inject styles if not already present
if (!document.getElementById('quota-management-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'quota-management-styles';
  styleSheet.textContent = quotaManagementStyles;
  document.head.appendChild(styleSheet);
}

// Make available globally
window.QuotaManagementUI = QuotaManagementUI;