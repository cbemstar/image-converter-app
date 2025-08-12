/**
 * Quota System Initialization
 * 
 * Initializes and coordinates all quota and usage tracking components
 * Requirements: 5.1, 5.6, 2.4, 2.3, 13.5, 13.6
 */

import { ConversionUIIntegration } from './components/ConversionUIIntegration.js';
import { QuotaManagementUI } from './components/QuotaManagementUI.js';
import { UsageNotifications } from './components/UsageNotifications.js';

class QuotaSystemManager {
  constructor() {
    this.components = {};
    this.isInitialized = false;
    this.options = {
      enableConversionIntegration: true,
      enableQuotaManagement: true,
      enableNotifications: true,
      autoInit: true
    };
    
    // Bind methods
    this.init = this.init.bind(this);
    this.initializeComponents = this.initializeComponents.bind(this);
    this.setupGlobalHandlers = this.setupGlobalHandlers.bind(this);
  }

  /**
   * Initialize the quota system
   * @param {Object} options - Initialization options
   */
  async init(options = {}) {
    if (this.isInitialized) {
      console.warn('Quota system already initialized');
      return;
    }
    
    this.options = { ...this.options, ...options };
    
    try {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve);
        });
      }
      
      // Initialize components
      await this.initializeComponents();
      
      // Setup global handlers
      this.setupGlobalHandlers();
      
      // Setup page-specific integrations
      this.setupPageIntegrations();
      
      this.isInitialized = true;
      console.log('Quota system initialized successfully');
      
      // Dispatch initialization event
      document.dispatchEvent(new CustomEvent('quotaSystemReady', {
        detail: { manager: this }
      }));
      
    } catch (error) {
      console.error('Error initializing quota system:', error);
      throw error;
    }
  }

  /**
   * Initialize all components
   */
  async initializeComponents() {
    // Initialize conversion UI integration (always needed for image converter)
    if (this.options.enableConversionIntegration) {
      this.components.conversionUI = new ConversionUIIntegration({
        enableQuotaChecking: true,
        showQuotaFeedback: true,
        enableBatchAwareness: true,
        showUpgradePrompts: true
      });
    }
    
    // Initialize quota management UI (if container exists)
    if (this.options.enableQuotaManagement) {
      const managementContainer = this.findQuotaManagementContainer();
      if (managementContainer) {
        this.components.quotaManagement = new QuotaManagementUI(managementContainer.id, {
          showQuotaProgress: true,
          showPlanComparison: true,
          showUsageAnalytics: true,
          layout: managementContainer.dataset.layout || 'tabs',
          compactMode: managementContainer.dataset.compact === 'true'
        });
      }
    }
    
    // Initialize usage notifications
    if (this.options.enableNotifications) {
      this.components.notifications = new UsageNotifications({
        position: 'top-right',
        autoHide: true,
        hideDelay: 8000,
        showUpgradePrompts: true
      });
    }
  }

  /**
   * Find quota management container
   * @returns {HTMLElement|null} Container element or null
   */
  findQuotaManagementContainer() {
    const selectors = [
      '#quota-management',
      '#billing-dashboard',
      '#usage-dashboard',
      '.quota-management-container'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element;
      }
    }
    
    return null;
  }

  /**
   * Setup global event handlers
   */
  setupGlobalHandlers() {
    // Handle auth state changes
    if (window.supabase) {
      window.supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
          // Refresh all components when auth state changes
          await this.refreshAllComponents();
        }
      });
    }
    
    // Handle visibility changes (refresh when tab becomes active)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isInitialized) {
        this.refreshAllComponents();
      }
    });
    
    // Handle quota system events
    document.addEventListener('quotaExceeded', (e) => {
      this.handleQuotaExceeded(e.detail);
    });
    
    document.addEventListener('planUpgraded', (e) => {
      this.handlePlanUpgraded(e.detail);
    });
    
    // Handle conversion events
    document.addEventListener('conversionStart', (e) => {
      this.handleConversionStart(e.detail);
    });
    
    document.addEventListener('conversionComplete', (e) => {
      this.handleConversionComplete(e.detail);
    });
    
    document.addEventListener('conversionError', (e) => {
      this.handleConversionError(e.detail);
    });
  }

  /**
   * Setup page-specific integrations
   */
  setupPageIntegrations() {
    const currentPage = this.getCurrentPage();
    
    switch (currentPage) {
      case 'image-converter':
        this.setupImageConverterIntegration();
        break;
        
      case 'dashboard':
        this.setupDashboardIntegration();
        break;
        
      case 'pricing':
        this.setupPricingIntegration();
        break;
        
      case 'profile':
        this.setupProfileIntegration();
        break;
        
      default:
        this.setupGeneralIntegration();
    }
  }

  /**
   * Get current page identifier
   * @returns {string} Page identifier
   */
  getCurrentPage() {
    const path = window.location.pathname;
    
    if (path.includes('image-converter')) return 'image-converter';
    if (path.includes('dashboard')) return 'dashboard';
    if (path.includes('pricing')) return 'pricing';
    if (path.includes('profile')) return 'profile';
    
    return 'general';
  }

  /**
   * Setup image converter specific integration
   */
  setupImageConverterIntegration() {
    // Enhanced integration for image converter page
    if (this.components.conversionUI) {
      // Add conversion success feedback
      document.addEventListener('conversionComplete', () => {
        this.showConversionSuccessFeedback();
      });
      
      // Monitor file selection changes
      this.monitorFileSelection();
      
      // Setup batch conversion helpers
      this.setupBatchConversionHelpers();
    }
  }

  /**
   * Setup dashboard integration
   */
  setupDashboardIntegration() {
    // Dashboard-specific quota management
    if (!this.components.quotaManagement) {
      // Create dashboard quota widget
      this.createDashboardQuotaWidget();
    }
  }

  /**
   * Setup pricing page integration
   */
  setupPricingIntegration() {
    // Highlight current plan on pricing page
    this.highlightCurrentPlan();
    
    // Add usage context to plan comparisons
    this.addUsageContextToPricing();
  }

  /**
   * Setup profile page integration
   */
  setupProfileIntegration() {
    // Add usage summary to profile
    this.addUsageSummaryToProfile();
  }

  /**
   * Setup general integration for other pages
   */
  setupGeneralIntegration() {
    // Add minimal quota indicator to navigation if user is authenticated
    this.addNavigationQuotaIndicator();
  }

  /**
   * Show conversion success feedback
   */
  showConversionSuccessFeedback() {
    if (this.components.notifications) {
      // The notifications component will handle this automatically
      return;
    }
    
    // Fallback notification
    if (window.showNotification) {
      window.showNotification('Image converted successfully!', 'success');
    }
  }

  /**
   * Monitor file selection changes
   */
  monitorFileSelection() {
    let fileSelectionTimeout;
    
    document.addEventListener('change', (e) => {
      if (e.target.matches('.select-image, #fileElem')) {
        // Debounce file selection updates
        clearTimeout(fileSelectionTimeout);
        fileSelectionTimeout = setTimeout(() => {
          this.updateFileSelectionFeedback();
        }, 300);
      }
    });
  }

  /**
   * Update file selection feedback
   */
  updateFileSelectionFeedback() {
    const selectedFiles = document.querySelectorAll('.select-image:checked').length ||
                         document.querySelectorAll('.select-image').length ||
                         0;
    
    if (selectedFiles > 0 && this.components.conversionUI) {
      // The conversion UI component handles this automatically
      return;
    }
  }

  /**
   * Setup batch conversion helpers
   */
  setupBatchConversionHelpers() {
    // Add keyboard shortcuts for batch operations
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'a':
            // Ctrl+A to select all images
            if (document.querySelector('.select-image')) {
              e.preventDefault();
              this.selectAllImages();
            }
            break;
            
          case 'Enter':
            // Ctrl+Enter to start conversion
            if (document.querySelector('.select-image:checked')) {
              e.preventDefault();
              this.startBatchConversion();
            }
            break;
        }
      }
    });
  }

  /**
   * Select all images
   */
  selectAllImages() {
    const selectAllCheckbox = document.getElementById('select-all');
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = true;
      selectAllCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      // Fallback: select all individual checkboxes
      document.querySelectorAll('.select-image').forEach(checkbox => {
        checkbox.checked = true;
      });
    }
  }

  /**
   * Start batch conversion
   */
  startBatchConversion() {
    const convertBtn = document.getElementById('convert-images-btn');
    if (convertBtn && !convertBtn.disabled) {
      convertBtn.click();
    }
  }

  /**
   * Create dashboard quota widget
   */
  createDashboardQuotaWidget() {
    const dashboard = document.querySelector('.dashboard-content, main');
    if (!dashboard) return;
    
    const widget = document.createElement('div');
    widget.id = 'dashboard-quota-widget';
    widget.className = 'dashboard-quota-widget';
    
    // Insert at the beginning of dashboard
    dashboard.insertBefore(widget, dashboard.firstChild);
    
    // Initialize quota management UI in the widget
    this.components.quotaManagement = new QuotaManagementUI('dashboard-quota-widget', {
      layout: 'stacked',
      compactMode: true,
      showQuotaProgress: true,
      showPlanComparison: false,
      showUsageAnalytics: true
    });
  }

  /**
   * Highlight current plan on pricing page
   */
  highlightCurrentPlan() {
    // This would be implemented based on the specific pricing page structure
    console.log('Highlighting current plan on pricing page');
  }

  /**
   * Add usage context to pricing
   */
  addUsageContextToPricing() {
    // This would add usage-based recommendations to the pricing page
    console.log('Adding usage context to pricing page');
  }

  /**
   * Add usage summary to profile
   */
  addUsageSummaryToProfile() {
    // This would add a usage summary section to the profile page
    console.log('Adding usage summary to profile page');
  }

  /**
   * Add navigation quota indicator
   */
  addNavigationQuotaIndicator() {
    const nav = document.querySelector('nav, .navbar, .header');
    if (!nav) return;
    
    // Add a small quota indicator to the navigation
    const indicator = document.createElement('div');
    indicator.id = 'nav-quota-indicator';
    indicator.className = 'nav-quota-indicator';
    
    // Find a good spot in the navigation
    const userMenu = nav.querySelector('.user-menu, [data-auth-required]');
    if (userMenu) {
      userMenu.parentNode.insertBefore(indicator, userMenu);
    } else {
      nav.appendChild(indicator);
    }
    
    // Initialize with minimal quota display
    this.updateNavigationIndicator(indicator);
  }

  /**
   * Update navigation indicator
   * @param {HTMLElement} indicator - Indicator element
   */
  updateNavigationIndicator(indicator) {
    // This would be updated by the usage tracking system
    indicator.innerHTML = `
      <div class="nav-quota-mini">
        <i class="fas fa-chart-pie"></i>
        <span class="quota-mini-text">Loading...</span>
      </div>
    `;
  }

  /**
   * Handle quota exceeded event
   * @param {Object} detail - Event detail
   */
  handleQuotaExceeded(detail) {
    console.log('Quota exceeded:', detail);
    
    // Show upgrade prompt if not already shown
    if (this.components.notifications) {
      // Notifications component handles this
      return;
    }
    
    // Fallback handling
    this.showUpgradePrompt();
  }

  /**
   * Handle plan upgraded event
   * @param {Object} detail - Event detail
   */
  handlePlanUpgraded(detail) {
    console.log('Plan upgraded:', detail);
    
    // Refresh all components to reflect new plan
    this.refreshAllComponents();
    
    // Show success message
    if (window.showNotification) {
      window.showNotification('Plan upgraded successfully!', 'success');
    }
  }

  /**
   * Handle conversion start event
   * @param {Object} detail - Event detail
   */
  handleConversionStart(detail) {
    console.log('Conversion started:', detail);
    
    // Update UI to show conversion in progress
    this.updateConversionStatus('in-progress');
  }

  /**
   * Handle conversion complete event
   * @param {Object} detail - Event detail
   */
  handleConversionComplete(detail) {
    console.log('Conversion completed:', detail);
    
    // Update UI to show completion
    this.updateConversionStatus('complete');
    
    // Refresh usage data
    this.refreshAllComponents();
  }

  /**
   * Handle conversion error event
   * @param {Object} detail - Event detail
   */
  handleConversionError(detail) {
    console.error('Conversion error:', detail);
    
    // Update UI to show error
    this.updateConversionStatus('error');
  }

  /**
   * Update conversion status across components
   * @param {string} status - Conversion status
   */
  updateConversionStatus(status) {
    // This would update various UI elements based on conversion status
    const statusMap = {
      'in-progress': 'Converting images...',
      'complete': 'Conversion complete',
      'error': 'Conversion failed'
    };
    
    const message = statusMap[status] || status;
    
    // Update progress indicators
    const progressElements = document.querySelectorAll('#progress-status, .conversion-status');
    progressElements.forEach(element => {
      element.textContent = message;
    });
  }

  /**
   * Show upgrade prompt
   */
  showUpgradePrompt() {
    if (window.showUpgradeModal) {
      window.showUpgradeModal();
    } else if (window.toggleStripeAccordion) {
      window.toggleStripeAccordion(true);
    } else {
      window.location.href = '/pricing.html';
    }
  }

  /**
   * Refresh all components
   */
  async refreshAllComponents() {
    try {
      // Refresh each component that has a refresh method
      const refreshPromises = Object.values(this.components).map(component => {
        if (component && typeof component.refreshUsage === 'function') {
          return component.refreshUsage();
        } else if (component && typeof component.refresh === 'function') {
          return component.refresh();
        }
        return Promise.resolve();
      });
      
      await Promise.all(refreshPromises);
      
    } catch (error) {
      console.error('Error refreshing components:', error);
    }
  }

  /**
   * Get component by name
   * @param {string} name - Component name
   * @returns {Object|null} Component instance or null
   */
  getComponent(name) {
    return this.components[name] || null;
  }

  /**
   * Update system options
   * @param {Object} newOptions - New options to merge
   */
  updateOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
    
    // Update component options if they support it
    Object.values(this.components).forEach(component => {
      if (component && typeof component.updateOptions === 'function') {
        component.updateOptions(newOptions);
      }
    });
  }

  /**
   * Destroy the quota system and clean up resources
   */
  destroy() {
    // Destroy all components
    Object.values(this.components).forEach(component => {
      if (component && typeof component.destroy === 'function') {
        component.destroy();
      }
    });
    
    this.components = {};
    this.isInitialized = false;
    
    // Remove added elements
    const elementsToRemove = [
      '#dashboard-quota-widget',
      '#nav-quota-indicator'
    ];
    
    elementsToRemove.forEach(selector => {
      const element = document.querySelector(selector);
      if (element) {
        element.remove();
      }
    });
    
    console.log('Quota system destroyed');
  }
}

// Create singleton instance
const quotaSystemManager = new QuotaSystemManager();

// Auto-initialize if enabled
if (quotaSystemManager.options.autoInit) {
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      quotaSystemManager.init();
    });
  } else {
    quotaSystemManager.init();
  }
}

// Export for manual control
export { quotaSystemManager, QuotaSystemManager };

// Make available globally
window.quotaSystemManager = quotaSystemManager;
window.QuotaSystemManager = QuotaSystemManager;

// Add CSS for additional UI elements
const quotaSystemStyles = `
  /* Dashboard Quota Widget */
  .dashboard-quota-widget {
    margin-bottom: 2rem;
  }
  
  /* Navigation Quota Indicator */
  .nav-quota-indicator {
    display: flex;
    align-items: center;
    margin-right: 1rem;
  }
  
  .nav-quota-mini {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background: var(--muted);
    border-radius: 4px;
    font-size: 0.8125rem;
    color: var(--muted-foreground);
    transition: all 0.2s ease;
  }
  
  .nav-quota-mini:hover {
    background: var(--muted-hover, var(--muted));
    color: var(--foreground);
  }
  
  .quota-mini-text {
    font-weight: 500;
  }
  
  /* Responsive adjustments */
  @media (max-width: 768px) {
    .nav-quota-indicator {
      margin-right: 0.5rem;
    }
    
    .nav-quota-mini {
      padding: 0.25rem 0.5rem;
    }
    
    .quota-mini-text {
      display: none;
    }
  }
`;

// Inject styles if not already present
if (!document.getElementById('quota-system-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'quota-system-styles';
  styleSheet.textContent = quotaSystemStyles;
  document.head.appendChild(styleSheet);
}