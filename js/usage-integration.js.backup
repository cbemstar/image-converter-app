/**
 * Usage Tracking Integration
 * 
 * Integrates usage tracking hooks with the image converter application
 * Requirements: 5.1, 5.6, 2.4
 */

import { useUsage } from './hooks/useUsage.js';
import { UsageDisplay } from './components/UsageDisplay.js';
import { UsageNotifications } from './components/UsageNotifications.js';

class UsageIntegration {
  constructor() {
    this.usage = useUsage();
    this.usageDisplay = null;
    this.usageNotifications = null;
    this.isInitialized = false;
    
    // Bind methods
    this.init = this.init.bind(this);
    this.setupUsageDisplay = this.setupUsageDisplay.bind(this);
    this.setupNotifications = this.setupNotifications.bind(this);
    this.handleConversionStart = this.handleConversionStart.bind(this);
    this.handleConversionComplete = this.handleConversionComplete.bind(this);
    this.handleConversionError = this.handleConversionError.bind(this);
    this.checkQuotaBeforeConversion = this.checkQuotaBeforeConversion.bind(this);
  }

  /**
   * Initialize usage tracking integration
   */
  async init() {
    if (this.isInitialized) {
      return;
    }
    
    try {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve);
        });
      }
      
      // Initialize usage tracking
      await this.usage.fetchUsage();
      
      // Setup UI components
      this.setupUsageDisplay();
      this.setupNotifications();
      
      // Integrate with existing conversion functions
      this.integrateWithConverter();
      
      // Setup real-time updates
      this.setupRealTimeUpdates();
      
      this.isInitialized = true;
      console.log('Usage tracking integration initialized');
      
    } catch (error) {
      console.error('Error initializing usage tracking:', error);
    }
  }

  /**
   * Setup usage display component
   */
  setupUsageDisplay() {
    // Look for usage display containers
    const containers = [
      'usage-counter',
      'quota-status', 
      'usage-display',
      'billing-widget'
    ];
    
    for (const containerId of containers) {
      const container = document.getElementById(containerId);
      if (container) {
        // Determine display options based on container
        const options = this.getDisplayOptions(containerId);
        
        this.usageDisplay = new UsageDisplay(containerId, options);
        break;
      }
    }
    
    // If no container found, create one
    if (!this.usageDisplay) {
      this.createUsageDisplayContainer();
    }
  }

  /**
   * Get display options based on container ID
   * @param {string} containerId - Container element ID
   * @returns {Object} Display options
   */
  getDisplayOptions(containerId) {
    const optionsMap = {
      'usage-counter': { compact: true, showUpgradeButton: false },
      'quota-status': { compact: true, showUpgradeButton: true },
      'usage-display': { compact: false, showHistory: true },
      'billing-widget': { compact: true, showUpgradeButton: true }
    };
    
    return optionsMap[containerId] || {};
  }

  /**
   * Create usage display container if none exists
   */
  createUsageDisplayContainer() {
    // Find a good place to insert the usage display
    const insertionPoints = [
      '#controls',
      '#format-controls', 
      '#drop-area',
      'main'
    ];
    
    for (const selector of insertionPoints) {
      const element = document.querySelector(selector);
      if (element) {
        const container = document.createElement('div');
        container.id = 'usage-display';
        container.className = 'usage-display-container';
        
        // Insert before the element
        element.parentNode.insertBefore(container, element);
        
        this.usageDisplay = new UsageDisplay('usage-display', {
          compact: true,
          showUpgradeButton: true
        });
        break;
      }
    }
  }

  /**
   * Setup usage notifications
   */
  setupNotifications() {
    this.usageNotifications = new UsageNotifications({
      position: 'top-right',
      autoHide: true,
      hideDelay: 8000,
      showUpgradePrompts: true,
      thresholds: {
        warning: 75,
        critical: 90,
        exceeded: 100
      }
    });
  }

  /**
   * Integrate with existing image converter functions
   */
  integrateWithConverter() {
    // Override existing conversion functions to include quota checking
    this.overrideConversionFunctions();
    
    // Setup event listeners for conversion events
    this.setupConversionEventListeners();
    
    // Integrate with file upload handlers
    this.integrateWithFileHandlers();
  }

  /**
   * Override existing conversion functions
   */
  overrideConversionFunctions() {
    // Store original functions
    const originalProcessImages = window.processImages;
    const originalHybridConvert = window.hybridConvert;
    
    // Override processImages function
    if (originalProcessImages) {
      window.processImages = async (...args) => {
        if (!await this.checkQuotaBeforeConversion(args[0]?.length || 1)) {
          return;
        }
        
        this.handleConversionStart();
        
        try {
          const result = await originalProcessImages.apply(this, args);
          this.handleConversionComplete();
          return result;
        } catch (error) {
          this.handleConversionError(error);
          throw error;
        }
      };
    }
    
    // Override hybridConvert function
    if (originalHybridConvert) {
      window.hybridConvert = async (...args) => {
        if (!await this.checkQuotaBeforeConversion(1)) {
          throw new Error('Quota exceeded');
        }
        
        try {
          const result = await originalHybridConvert.apply(this, args);
          await this.usage.recordConversion();
          return result;
        } catch (error) {
          this.handleConversionError(error);
          throw error;
        }
      };
    }
  }

  /**
   * Setup event listeners for conversion events
   */
  setupConversionEventListeners() {
    // Listen for custom conversion events
    document.addEventListener('conversionStart', this.handleConversionStart);
    document.addEventListener('conversionComplete', this.handleConversionComplete);
    document.addEventListener('conversionError', this.handleConversionError);
    
    // Listen for button clicks
    document.addEventListener('click', (e) => {
      if (e.target.matches('.convert-single-btn, #convert-images-btn')) {
        this.handleConversionButtonClick(e);
      }
    });
  }

  /**
   * Integrate with file upload handlers
   */
  integrateWithFileHandlers() {
    // Override handleFiles function if it exists
    const originalHandleFiles = window.handleFiles;
    
    if (originalHandleFiles) {
      window.handleFiles = async (files) => {
        // Check quota before processing files
        const imageFiles = Array.from(files).filter(f => 
          f.type.startsWith('image/') || 
          window.isRaw?.(f) || 
          window.isHeic?.(f)
        );
        
        if (imageFiles.length > 0) {
          const canProcess = await this.checkQuotaBeforeConversion(imageFiles.length);
          if (!canProcess) {
            return;
          }
        }
        
        return originalHandleFiles.call(this, files);
      };
    }
  }

  /**
   * Setup real-time updates
   */
  setupRealTimeUpdates() {
    // Start auto-refresh for usage data
    this.usage.startAutoRefresh(30000); // 30 seconds
    
    // Listen for auth state changes
    if (window.supabase) {
      window.supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
          // Refresh usage data when auth state changes
          await this.usage.refreshUsage();
        }
      });
    }
    
    // Listen for visibility changes to refresh when tab becomes active
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.usage.refreshUsage();
      }
    });
  }

  /**
   * Check quota before starting conversion
   * @param {number} count - Number of conversions to check for
   * @returns {Promise<boolean>} True if quota is available
   */
  async checkQuotaBeforeConversion(count = 1) {
    // Ensure we have current usage data
    await this.usage.fetchUsage();
    
    const hasQuota = this.usage.checkQuotaAvailable(count);
    
    if (!hasQuota) {
      // Show quota exceeded notification
      this.showQuotaExceededModal();
      return false;
    }
    
    return true;
  }

  /**
   * Handle conversion start
   */
  handleConversionStart() {
    // Update UI to show conversion in progress
    this.updateConversionStatus('Converting...');
  }

  /**
   * Handle successful conversion completion
   */
  async handleConversionComplete() {
    // Record the conversion
    await this.usage.recordConversion();
    
    // Update UI
    this.updateConversionStatus('Conversion complete');
    
    // Dispatch custom event
    document.dispatchEvent(new CustomEvent('usageUpdated', {
      detail: { usage: this.usage.getCurrentUsage() }
    }));
  }

  /**
   * Handle conversion error
   * @param {Error} error - Conversion error
   */
  handleConversionError(error) {
    console.error('Conversion error:', error);
    this.updateConversionStatus('Conversion failed');
    
    // Show error notification if it's quota-related
    if (error.message.includes('quota') || error.message.includes('limit')) {
      this.showQuotaExceededModal();
    }
  }

  /**
   * Handle conversion button clicks
   * @param {Event} e - Click event
   */
  async handleConversionButtonClick(e) {
    const button = e.target;
    const isMultiple = button.id === 'convert-images-btn';
    const count = isMultiple ? this.getSelectedImageCount() : 1;
    
    if (!await this.checkQuotaBeforeConversion(count)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  /**
   * Get count of selected images
   * @returns {number} Number of selected images
   */
  getSelectedImageCount() {
    const checkboxes = document.querySelectorAll('.select-image:checked');
    return checkboxes.length || document.querySelectorAll('.select-image').length || 1;
  }

  /**
   * Update conversion status display
   * @param {string} status - Status message
   */
  updateConversionStatus(status) {
    const statusElements = [
      '#progress-status',
      '#quota-status',
      '.conversion-status'
    ];
    
    statusElements.forEach(selector => {
      const element = document.querySelector(selector);
      if (element) {
        element.textContent = status;
      }
    });
  }

  /**
   * Show quota exceeded modal
   */
  showQuotaExceededModal() {
    const usage = this.usage.getCurrentUsage();
    
    if (!usage) return;
    
    const { isGuest, planName, conversionsLimit } = usage;
    
    let message, actions;
    
    if (isGuest) {
      message = 'You\'ve reached the guest conversion limit. Sign up for a free account to get more conversions!';
      actions = [
        { text: 'Sign Up Free', action: 'sign-up', primary: true },
        { text: 'Maybe Later', action: 'dismiss' }
      ];
    } else if (planName === 'Free') {
      message = `You've used all ${conversionsLimit} conversions in your free plan. Upgrade to continue converting images.`;
      actions = [
        { text: 'Upgrade Plan', action: 'upgrade', primary: true },
        { text: 'View Plans', action: 'view-plans' },
        { text: 'Close', action: 'dismiss' }
      ];
    } else {
      message = `You've reached your monthly limit of ${conversionsLimit} conversions. Your quota will reset next month.`;
      actions = [
        { text: 'Upgrade Plan', action: 'upgrade', primary: true },
        { text: 'Close', action: 'dismiss' }
      ];
    }
    
    this.showModal({
      title: 'Conversion Limit Reached',
      message,
      actions,
      type: 'warning'
    });
  }

  /**
   * Show modal dialog
   * @param {Object} options - Modal options
   */
  showModal(options) {
    const { title, message, actions = [], type = 'info' } = options;
    
    // Use existing modal system if available
    if (window.showModal) {
      window.showModal(options);
      return;
    }
    
    // Create simple modal
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close" data-action="dismiss">&times;</button>
        </div>
        <div class="modal-body">
          <div class="modal-icon ${type}">
            ${type === 'warning' ? '<i class="fas fa-exclamation-triangle"></i>' : '<i class="fas fa-info-circle"></i>'}
          </div>
          <p>${message}</p>
        </div>
        <div class="modal-footer">
          ${actions.map(action => `
            <button class="btn ${action.primary ? 'btn-primary' : 'btn-secondary'}" 
                    data-action="${action.action}">
              ${action.text}
            </button>
          `).join('')}
        </div>
      </div>
    `;
    
    // Add event listeners
    modal.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      if (action) {
        this.handleModalAction(action);
        modal.remove();
      } else if (e.target === modal) {
        modal.remove();
      }
    });
    
    document.body.appendChild(modal);
  }

  /**
   * Handle modal action clicks
   * @param {string} action - Action to perform
   */
  handleModalAction(action) {
    switch (action) {
      case 'upgrade':
      case 'view-plans':
        if (window.showUpgradeModal) {
          window.showUpgradeModal();
        } else if (window.toggleStripeAccordion) {
          window.toggleStripeAccordion(true);
        } else {
          window.location.href = '/pricing.html';
        }
        break;
        
      case 'sign-up':
        if (window.showAuthModal) {
          window.showAuthModal();
        } else {
          window.location.href = '/auth.html';
        }
        break;
        
      case 'dismiss':
        // Just close the modal
        break;
        
      default:
        console.warn(`Unknown modal action: ${action}`);
    }
  }

  /**
   * Get current usage data
   * @returns {Object|null} Current usage data
   */
  getCurrentUsage() {
    return this.usage.getCurrentUsage();
  }

  /**
   * Refresh usage data
   * @returns {Promise<Object|null>} Updated usage data
   */
  async refreshUsage() {
    return await this.usage.refreshUsage();
  }

  /**
   * Destroy the integration and clean up resources
   */
  destroy() {
    // Stop auto-refresh
    this.usage.stopAutoRefresh();
    
    // Destroy components
    if (this.usageDisplay) {
      this.usageDisplay.destroy();
      this.usageDisplay = null;
    }
    
    if (this.usageNotifications) {
      this.usageNotifications.destroy();
      this.usageNotifications = null;
    }
    
    // Remove event listeners
    document.removeEventListener('conversionStart', this.handleConversionStart);
    document.removeEventListener('conversionComplete', this.handleConversionComplete);
    document.removeEventListener('conversionError', this.handleConversionError);
    
    this.isInitialized = false;
  }
}

// Create singleton instance
const usageIntegration = new UsageIntegration();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    usageIntegration.init();
  });
} else {
  usageIntegration.init();
}

// Export for manual control
export { usageIntegration, UsageIntegration };

// Make available globally
window.usageIntegration = usageIntegration;
window.UsageIntegration = UsageIntegration;