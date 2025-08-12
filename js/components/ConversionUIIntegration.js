/**
 * Conversion UI Integration Component
 * 
 * Integrates quota checking and feedback into the image converter UI
 * Requirements: 2.3, 2.4, 13.5, 13.6
 */

import { useUsage } from '../hooks/useUsage.js';

export class ConversionUIIntegration {
  constructor(options = {}) {
    this.options = {
      enableQuotaChecking: true,
      showQuotaFeedback: true,
      enableBatchAwareness: true,
      showUpgradePrompts: true,
      maxBatchSize: 100,
      ...options
    };
    
    this.usage = useUsage();
    this.currentUsage = null;
    this.unsubscribe = null;
    this.conversionInProgress = false;
    this.batchQueue = [];
    
    this.init();
  }

  /**
   * Initialize the integration
   */
  async init() {
    // Subscribe to usage updates
    this.unsubscribe = this.usage.subscribe((state) => {
      this.handleUsageUpdate(state);
    });
    
    // Fetch initial usage data
    await this.usage.fetchUsage();
    
    // Integrate with existing UI
    this.integrateWithUI();
    
    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Handle usage updates
   * @param {Object} state - Usage state
   */
  handleUsageUpdate(state) {
    const { usage, loading, error } = state;
    
    if (usage) {
      this.currentUsage = usage;
      this.updateUIState();
    }
    
    if (error) {
      this.showError(`Usage tracking error: ${error}`);
    }
  }

  /**
   * Integrate with existing UI elements
   */
  integrateWithUI() {
    // Add quota display to the UI
    this.addQuotaDisplay();
    
    // Enhance file drop area
    this.enhanceDropArea();
    
    // Enhance conversion buttons
    this.enhanceConversionButtons();
    
    // Add batch conversion controls
    this.addBatchControls();
    
    // Update existing progress indicators
    this.enhanceProgressIndicators();
  }

  /**
   * Add quota display to the UI
   */
  addQuotaDisplay() {
    // Find a good place to insert quota display
    const insertionPoints = [
      '#quota-status',
      '#usage-counter',
      '#controls',
      '#format-controls'
    ];
    
    for (const selector of insertionPoints) {
      const element = document.querySelector(selector);
      if (element) {
        // Create or update quota display
        let quotaDisplay = document.getElementById('quota-display-widget');
        
        if (!quotaDisplay) {
          quotaDisplay = document.createElement('div');
          quotaDisplay.id = 'quota-display-widget';
          quotaDisplay.className = 'quota-display-widget';
          
          if (selector === '#controls' || selector === '#format-controls') {
            element.parentNode.insertBefore(quotaDisplay, element.nextSibling);
          } else {
            element.parentNode.replaceChild(quotaDisplay, element);
          }
        }
        
        this.renderQuotaDisplay(quotaDisplay);
        break;
      }
    }
  }

  /**
   * Render quota display widget
   * @param {HTMLElement} container - Container element
   */
  renderQuotaDisplay(container) {
    if (!this.currentUsage) {
      container.innerHTML = `
        <div class="quota-widget loading">
          <i class="fas fa-spinner fa-spin"></i>
          <span>Loading usage...</span>
        </div>
      `;
      return;
    }
    
    const { conversionsUsed, conversionsLimit, remainingConversions, planName, isGuest } = this.currentUsage;
    const utilizationPercent = (conversionsUsed / conversionsLimit) * 100;
    const progressColor = this.getProgressColor(utilizationPercent);
    
    container.innerHTML = `
      <div class="quota-widget">
        <div class="quota-header">
          <div class="quota-info">
            <span class="plan-badge ${planName?.toLowerCase() || 'free'}">${planName || 'Free'}</span>
            <span class="quota-text">
              ${conversionsUsed}/${conversionsLimit === -1 ? '∞' : conversionsLimit} conversions
            </span>
          </div>
          <div class="quota-remaining ${remainingConversions === 0 ? 'depleted' : ''}">
            ${remainingConversions === 0 ? 'Limit reached' : `${remainingConversions} left`}
          </div>
        </div>
        
        <div class="quota-progress">
          <div class="quota-progress-bar">
            <div class="quota-progress-fill" 
                 style="width: ${Math.min(100, utilizationPercent)}%; background-color: ${progressColor};">
            </div>
          </div>
          <div class="quota-percentage" style="color: ${progressColor}">
            ${Math.round(utilizationPercent)}%
          </div>
        </div>
        
        ${this.renderQuotaActions(isGuest, remainingConversions)}
      </div>
    `;
  }

  /**
   * Render quota actions
   * @param {boolean} isGuest - Whether user is guest
   * @param {number} remainingConversions - Remaining conversions
   * @returns {string} HTML for quota actions
   */
  renderQuotaActions(isGuest, remainingConversions) {
    if (isGuest) {
      return `
        <div class="quota-actions">
          <button class="btn btn-primary btn-sm" data-action="sign-up">
            <i class="fas fa-user-plus"></i>
            Sign Up for More
          </button>
        </div>
      `;
    }
    
    if (remainingConversions === 0) {
      return `
        <div class="quota-actions">
          <button class="btn btn-primary btn-sm" data-action="upgrade">
            <i class="fas fa-arrow-up"></i>
            Upgrade Plan
          </button>
        </div>
      `;
    }
    
    if (remainingConversions <= 5) {
      return `
        <div class="quota-actions">
          <button class="btn btn-secondary btn-sm" data-action="upgrade">
            <i class="fas fa-info-circle"></i>
            View Plans
          </button>
        </div>
      `;
    }
    
    return '';
  }

  /**
   * Enhance file drop area with quota checking
   */
  enhanceDropArea() {
    const dropArea = document.getElementById('drop-area');
    if (!dropArea) return;
    
    // Store original handlers
    const originalHandlers = {
      dragover: dropArea.ondragover,
      drop: dropArea.ondrop
    };
    
    // Enhance drop handler
    dropArea.addEventListener('drop', (e) => {
      if (!this.checkQuotaBeforeDrop(e)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }, true); // Use capture phase to intercept before original handler
    
    // Add quota warning to drop area
    this.addDropAreaQuotaWarning(dropArea);
  }

  /**
   * Add quota warning to drop area
   * @param {HTMLElement} dropArea - Drop area element
   */
  addDropAreaQuotaWarning(dropArea) {
    if (!this.currentUsage) return;
    
    const { remainingConversions, isGuest } = this.currentUsage;
    
    let warningElement = dropArea.querySelector('.quota-warning');
    
    if (remainingConversions === 0) {
      if (!warningElement) {
        warningElement = document.createElement('div');
        warningElement.className = 'quota-warning error';
        dropArea.appendChild(warningElement);
      }
      
      warningElement.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        <span>Conversion limit reached. ${isGuest ? 'Sign up' : 'Upgrade'} to continue.</span>
      `;
      
      dropArea.classList.add('quota-exceeded');
    } else if (remainingConversions <= 5) {
      if (!warningElement) {
        warningElement = document.createElement('div');
        warningElement.className = 'quota-warning warning';
        dropArea.appendChild(warningElement);
      }
      
      warningElement.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <span>Only ${remainingConversions} conversions remaining this month.</span>
      `;
      
      dropArea.classList.remove('quota-exceeded');
    } else {
      if (warningElement) {
        warningElement.remove();
      }
      dropArea.classList.remove('quota-exceeded');
    }
  }

  /**
   * Check quota before file drop
   * @param {Event} e - Drop event
   * @returns {boolean} True if drop should proceed
   */
  checkQuotaBeforeDrop(e) {
    if (!this.options.enableQuotaChecking || !this.currentUsage) {
      return true;
    }
    
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(f => 
      f.type.startsWith('image/') || 
      this.isRawFile(f) || 
      this.isHeicFile(f)
    );
    
    return this.checkQuotaForFiles(imageFiles);
  }

  /**
   * Enhance conversion buttons with quota checking
   */
  enhanceConversionButtons() {
    // Enhance convert all button
    const convertAllBtn = document.getElementById('convert-images-btn');
    if (convertAllBtn) {
      this.enhanceButton(convertAllBtn, 'convert-all');
    }
    
    // Enhance individual convert buttons (delegated event handling)
    document.addEventListener('click', (e) => {
      if (e.target.matches('.convert-single-btn')) {
        if (!this.checkQuotaBeforeConversion(1)) {
          e.preventDefault();
          e.stopPropagation();
          this.showQuotaExceededModal();
        }
      }
    }, true);
  }

  /**
   * Enhance a button with quota checking
   * @param {HTMLElement} button - Button element
   * @param {string} type - Button type
   */
  enhanceButton(button, type) {
    // Store original click handler
    const originalHandler = button.onclick;
    
    // Replace with quota-aware handler
    button.onclick = (e) => {
      const fileCount = this.getConversionFileCount(type);
      
      if (!this.checkQuotaBeforeConversion(fileCount)) {
        e.preventDefault();
        this.showQuotaExceededModal();
        return false;
      }
      
      // Call original handler if quota check passes
      if (originalHandler) {
        return originalHandler.call(button, e);
      }
    };
    
    // Update button state based on quota
    this.updateButtonState(button, type);
  }

  /**
   * Get file count for conversion type
   * @param {string} type - Conversion type
   * @returns {number} File count
   */
  getConversionFileCount(type) {
    if (type === 'convert-all') {
      const selectedCheckboxes = document.querySelectorAll('.select-image:checked');
      return selectedCheckboxes.length || document.querySelectorAll('.select-image').length || 1;
    }
    
    return 1;
  }

  /**
   * Update button state based on quota
   * @param {HTMLElement} button - Button element
   * @param {string} type - Button type
   */
  updateButtonState(button, type) {
    if (!this.currentUsage) return;
    
    const fileCount = this.getConversionFileCount(type);
    const canConvert = this.checkQuotaBeforeConversion(fileCount);
    
    if (!canConvert) {
      button.disabled = true;
      button.classList.add('quota-disabled');
      
      const originalText = button.textContent;
      if (!originalText.includes('Limit Reached')) {
        button.dataset.originalText = originalText;
        button.innerHTML = `
          <i class="fas fa-ban"></i>
          Limit Reached
        `;
      }
    } else {
      button.disabled = false;
      button.classList.remove('quota-disabled');
      
      if (button.dataset.originalText) {
        button.textContent = button.dataset.originalText;
        delete button.dataset.originalText;
      }
    }
  }

  /**
   * Add batch conversion controls
   */
  addBatchControls() {
    if (!this.options.enableBatchAwareness) return;
    
    const controlsContainer = document.getElementById('controls');
    if (!controlsContainer) return;
    
    // Add batch size indicator
    let batchIndicator = document.getElementById('batch-quota-indicator');
    if (!batchIndicator) {
      batchIndicator = document.createElement('div');
      batchIndicator.id = 'batch-quota-indicator';
      batchIndicator.className = 'batch-quota-indicator';
      controlsContainer.appendChild(batchIndicator);
    }
    
    this.updateBatchIndicator(batchIndicator);
  }

  /**
   * Update batch indicator
   * @param {HTMLElement} indicator - Batch indicator element
   */
  updateBatchIndicator(indicator) {
    if (!this.currentUsage) {
      indicator.style.display = 'none';
      return;
    }
    
    const selectedFiles = document.querySelectorAll('.select-image:checked').length || 
                         document.querySelectorAll('.select-image').length || 0;
    
    if (selectedFiles === 0) {
      indicator.style.display = 'none';
      return;
    }
    
    const { remainingConversions } = this.currentUsage;
    const canProcessAll = selectedFiles <= remainingConversions;
    const maxProcessable = Math.min(selectedFiles, remainingConversions);
    
    indicator.style.display = 'block';
    indicator.innerHTML = `
      <div class="batch-info ${canProcessAll ? 'can-process-all' : 'limited'}">
        <div class="batch-text">
          <i class="fas fa-images"></i>
          <span>
            ${canProcessAll 
              ? `Can process all ${selectedFiles} images` 
              : `Can process ${maxProcessable} of ${selectedFiles} images`
            }
          </span>
        </div>
        ${!canProcessAll ? `
          <div class="batch-warning">
            <i class="fas fa-exclamation-triangle"></i>
            <span>Upgrade to process all images</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Enhance progress indicators
   */
  enhanceProgressIndicators() {
    // Enhance progress status
    const progressStatus = document.getElementById('progress-status');
    if (progressStatus) {
      this.enhanceProgressStatus(progressStatus);
    }
    
    // Enhance progress bar
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
      this.enhanceProgressBar(progressBar);
    }
  }

  /**
   * Enhance progress status with quota feedback
   * @param {HTMLElement} statusElement - Progress status element
   */
  enhanceProgressStatus(statusElement) {
    // Store original update function if it exists
    if (window.updateProgressStatus) {
      const originalUpdate = window.updateProgressStatus;
      
      window.updateProgressStatus = (message, type = 'info') => {
        // Call original function
        originalUpdate(message, type);
        
        // Add quota context if relevant
        if (this.currentUsage && (message.includes('Converting') || message.includes('Complete'))) {
          this.addQuotaContextToProgress(statusElement, message, type);
        }
      };
    }
  }

  /**
   * Add quota context to progress display
   * @param {HTMLElement} statusElement - Status element
   * @param {string} message - Progress message
   * @param {string} type - Message type
   */
  addQuotaContextToProgress(statusElement, message, type) {
    const { remainingConversions } = this.currentUsage;
    
    if (type === 'success' && message.includes('Complete')) {
      // Add remaining quota info to completion message
      const quotaInfo = document.createElement('div');
      quotaInfo.className = 'quota-context';
      quotaInfo.innerHTML = `
        <span class="quota-remaining-text">
          ${remainingConversions} conversions remaining this month
        </span>
      `;
      
      statusElement.appendChild(quotaInfo);
      
      // Auto-remove after 5 seconds
      setTimeout(() => {
        if (quotaInfo.parentNode) {
          quotaInfo.remove();
        }
      }, 5000);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Listen for file selection changes
    document.addEventListener('change', (e) => {
      if (e.target.matches('.select-image')) {
        this.updateUIState();
      }
    });
    
    // Listen for quota action clicks
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-action]')) {
        const action = e.target.dataset.action;
        this.handleQuotaAction(action);
      }
    });
    
    // Listen for conversion events
    document.addEventListener('conversionStart', () => {
      this.conversionInProgress = true;
      this.updateUIState();
    });
    
    document.addEventListener('conversionComplete', async () => {
      this.conversionInProgress = false;
      await this.usage.recordConversion();
      this.updateUIState();
    });
    
    document.addEventListener('conversionError', () => {
      this.conversionInProgress = false;
      this.updateUIState();
    });
  }

  /**
   * Check quota before conversion
   * @param {number} fileCount - Number of files to convert
   * @returns {boolean} True if conversion can proceed
   */
  checkQuotaBeforeConversion(fileCount = 1) {
    if (!this.options.enableQuotaChecking || !this.currentUsage) {
      return true;
    }
    
    return this.usage.checkQuotaAvailable(fileCount);
  }

  /**
   * Check quota for file array
   * @param {Array} files - Array of files
   * @returns {boolean} True if files can be processed
   */
  checkQuotaForFiles(files) {
    return this.checkQuotaBeforeConversion(files.length);
  }

  /**
   * Handle quota actions
   * @param {string} action - Action to perform
   */
  handleQuotaAction(action) {
    switch (action) {
      case 'upgrade':
        this.showUpgradeModal();
        break;
        
      case 'sign-up':
        this.showSignUpModal();
        break;
        
      case 'refresh':
        this.refreshUsage();
        break;
        
      default:
        console.warn(`Unknown quota action: ${action}`);
    }
  }

  /**
   * Show quota exceeded modal
   */
  showQuotaExceededModal() {
    if (!this.currentUsage) return;
    
    const { isGuest, planName, conversionsLimit, remainingConversions } = this.currentUsage;
    
    let title, message, actions;
    
    if (isGuest) {
      title = 'Guest Limit Reached';
      message = 'You\'ve reached the guest conversion limit. Sign up for a free account to get more conversions!';
      actions = [
        { text: 'Sign Up Free', action: 'sign-up', primary: true },
        { text: 'Maybe Later', action: 'dismiss' }
      ];
    } else if (remainingConversions === 0) {
      title = 'Monthly Limit Reached';
      message = `You've used all ${conversionsLimit} conversions in your ${planName} plan this month. Upgrade to continue converting images.`;
      actions = [
        { text: 'Upgrade Plan', action: 'upgrade', primary: true },
        { text: 'View Plans', action: 'view-plans' },
        { text: 'Close', action: 'dismiss' }
      ];
    } else {
      title = 'Insufficient Quota';
      message = `You don't have enough conversions remaining for this batch. You have ${remainingConversions} conversions left.`;
      actions = [
        { text: 'Upgrade Plan', action: 'upgrade', primary: true },
        { text: 'Process What I Can', action: 'process-partial' },
        { text: 'Close', action: 'dismiss' }
      ];
    }
    
    this.showModal({ title, message, actions, type: 'warning' });
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
    modal.className = 'quota-modal-overlay';
    modal.innerHTML = `
      <div class="quota-modal-content">
        <div class="quota-modal-header">
          <h3>${title}</h3>
          <button class="quota-modal-close" data-action="dismiss">&times;</button>
        </div>
        <div class="quota-modal-body">
          <div class="quota-modal-icon ${type}">
            ${this.getModalIcon(type)}
          </div>
          <p>${message}</p>
        </div>
        <div class="quota-modal-footer">
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
        this.handleModalAction(action, modal);
      } else if (e.target === modal) {
        modal.remove();
      }
    });
    
    document.body.appendChild(modal);
  }

  /**
   * Get modal icon for type
   * @param {string} type - Modal type
   * @returns {string} HTML for icon
   */
  getModalIcon(type) {
    const icons = {
      info: '<i class="fas fa-info-circle"></i>',
      warning: '<i class="fas fa-exclamation-triangle"></i>',
      error: '<i class="fas fa-exclamation-circle"></i>',
      success: '<i class="fas fa-check-circle"></i>'
    };
    
    return icons[type] || icons.info;
  }

  /**
   * Handle modal action
   * @param {string} action - Action to perform
   * @param {HTMLElement} modal - Modal element
   */
  handleModalAction(action, modal) {
    switch (action) {
      case 'upgrade':
      case 'view-plans':
        this.showUpgradeModal();
        modal.remove();
        break;
        
      case 'sign-up':
        this.showSignUpModal();
        modal.remove();
        break;
        
      case 'process-partial':
        this.processPartialBatch();
        modal.remove();
        break;
        
      case 'dismiss':
        modal.remove();
        break;
        
      default:
        console.warn(`Unknown modal action: ${action}`);
    }
  }

  /**
   * Process partial batch within quota limits
   */
  processPartialBatch() {
    if (!this.currentUsage) return;
    
    const { remainingConversions } = this.currentUsage;
    const checkboxes = document.querySelectorAll('.select-image');
    
    // Uncheck excess files
    checkboxes.forEach((checkbox, index) => {
      if (index >= remainingConversions) {
        checkbox.checked = false;
      } else {
        checkbox.checked = true;
      }
    });
    
    // Trigger conversion
    const convertBtn = document.getElementById('convert-images-btn');
    if (convertBtn) {
      convertBtn.click();
    }
    
    this.showNotification(`Processing ${remainingConversions} images within your quota limit`, 'info');
  }

  /**
   * Update UI state based on current usage
   */
  updateUIState() {
    // Update quota display
    const quotaWidget = document.getElementById('quota-display-widget');
    if (quotaWidget) {
      this.renderQuotaDisplay(quotaWidget);
    }
    
    // Update drop area
    const dropArea = document.getElementById('drop-area');
    if (dropArea) {
      this.addDropAreaQuotaWarning(dropArea);
    }
    
    // Update conversion buttons
    const convertAllBtn = document.getElementById('convert-images-btn');
    if (convertAllBtn) {
      this.updateButtonState(convertAllBtn, 'convert-all');
    }
    
    // Update batch indicator
    const batchIndicator = document.getElementById('batch-quota-indicator');
    if (batchIndicator) {
      this.updateBatchIndicator(batchIndicator);
    }
  }

  /**
   * Get progress color based on utilization
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
   * Check if file is RAW format
   * @param {File} file - File to check
   * @returns {boolean} True if RAW file
   */
  isRawFile(file) {
    const rawExtensions = ['cr2', 'nef', 'arw', 'dng', 'raf', 'orf', 'rw2', 'pef', 'srw'];
    const extension = file.name.split('.').pop().toLowerCase();
    return rawExtensions.includes(extension);
  }

  /**
   * Check if file is HEIC format
   * @param {File} file - File to check
   * @returns {boolean} True if HEIC file
   */
  isHeicFile(file) {
    return file.type === 'image/heic' || file.type === 'image/heif' || 
           file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');
  }

  /**
   * Show upgrade modal
   */
  showUpgradeModal() {
    if (window.showUpgradeModal) {
      window.showUpgradeModal();
    } else if (window.toggleStripeAccordion) {
      window.toggleStripeAccordion(true);
    } else {
      window.location.href = '/pricing.html';
    }
  }

  /**
   * Show sign up modal
   */
  showSignUpModal() {
    if (window.showAuthModal) {
      window.showAuthModal();
    } else {
      window.location.href = '/auth.html';
    }
  }

  /**
   * Refresh usage data
   */
  async refreshUsage() {
    try {
      await this.usage.refreshUsage();
      this.showNotification('Usage data refreshed', 'success');
    } catch (error) {
      console.error('Error refreshing usage:', error);
      this.showNotification('Failed to refresh usage data', 'error');
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
    this.showNotification(error, 'error');
  }

  /**
   * Update options and re-initialize
   * @param {Object} newOptions - New options to merge
   */
  updateOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
    this.updateUIState();
  }

  /**
   * Destroy the integration and clean up resources
   */
  destroy() {
    // Unsubscribe from usage updates
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    
    // Remove added UI elements
    const elementsToRemove = [
      '#quota-display-widget',
      '#batch-quota-indicator',
      '.quota-warning'
    ];
    
    elementsToRemove.forEach(selector => {
      const element = document.querySelector(selector);
      if (element) {
        element.remove();
      }
    });
    
    // Restore original button handlers (if we stored them)
    // This would require more complex state management in a real implementation
    
    this.currentUsage = null;
    this.batchQueue = [];
  }
}

// Add CSS styles for conversion UI integration
const conversionUIStyles = `
  /* Quota Display Widget */
  .quota-display-widget {
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1rem;
    margin: 1rem 0;
    font-size: 0.875rem;
  }
  
  .quota-widget.loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--muted-foreground);
    justify-content: center;
    padding: 0.75rem;
  }
  
  .quota-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }
  
  .quota-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .quota-text {
    font-weight: 500;
    color: var(--foreground);
  }
  
  .quota-remaining {
    font-weight: 600;
    color: var(--success);
  }
  
  .quota-remaining.depleted {
    color: var(--destructive);
  }
  
  .quota-progress {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }
  
  .quota-progress-bar {
    flex: 1;
    height: 6px;
    background: var(--muted);
    border-radius: 3px;
    overflow: hidden;
  }
  
  .quota-progress-fill {
    height: 100%;
    transition: width 0.3s ease;
    border-radius: 3px;
  }
  
  .quota-percentage {
    font-weight: 600;
    font-size: 0.8125rem;
    min-width: 35px;
    text-align: right;
  }
  
  .quota-actions {
    display: flex;
    justify-content: center;
  }
  
  /* Drop Area Enhancements */
  .quota-warning {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1rem;
    padding: 0.75rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
  }
  
  .quota-warning.error {
    background: var(--destructive-background, #fef2f2);
    color: var(--destructive-foreground, #991b1b);
    border: 1px solid var(--destructive, #ef4444);
  }
  
  .quota-warning.warning {
    background: var(--warning-background, #fef3c7);
    color: var(--warning-foreground, #92400e);
    border: 1px solid var(--warning, #f59e0b);
  }
  
  #drop-area.quota-exceeded {
    border-color: var(--destructive);
    background: var(--destructive-background, #fef2f2);
    opacity: 0.7;
    cursor: not-allowed;
  }
  
  /* Button Enhancements */
  .quota-disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .quota-disabled:hover {
    transform: none !important;
  }
  
  /* Batch Controls */
  .batch-quota-indicator {
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.75rem;
    margin: 0.5rem 0;
    font-size: 0.875rem;
  }
  
  .batch-info {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .batch-text {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 500;
    color: var(--foreground);
  }
  
  .batch-info.can-process-all .batch-text {
    color: var(--success);
  }
  
  .batch-info.limited .batch-text {
    color: var(--warning);
  }
  
  .batch-warning {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: var(--warning);
  }
  
  /* Progress Enhancements */
  .quota-context {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: var(--success-background, #ecfdf5);
    border: 1px solid var(--success, #10b981);
    border-radius: 4px;
    font-size: 0.8125rem;
  }
  
  .quota-remaining-text {
    color: var(--success-foreground, #065f46);
    font-weight: 500;
  }
  
  /* Modal Styles */
  .quota-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .quota-modal-content {
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 8px;
    max-width: 500px;
    width: 90%;
    max-height: 90vh;
    overflow: hidden;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  }
  
  .quota-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    border-bottom: 1px solid var(--border);
  }
  
  .quota-modal-header h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--foreground);
  }
  
  .quota-modal-close {
    background: none;
    border: none;
    color: var(--muted-foreground);
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 4px;
    font-size: 1.5rem;
    line-height: 1;
    transition: all 0.2s ease;
  }
  
  .quota-modal-close:hover {
    background: var(--muted);
    color: var(--foreground);
  }
  
  .quota-modal-body {
    padding: 1.5rem;
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .quota-modal-icon {
    font-size: 2rem;
    margin-top: 0.25rem;
  }
  
  .quota-modal-icon.info {
    color: var(--info, #3b82f6);
  }
  
  .quota-modal-icon.warning {
    color: var(--warning, #f59e0b);
  }
  
  .quota-modal-icon.error {
    color: var(--destructive, #ef4444);
  }
  
  .quota-modal-icon.success {
    color: var(--success, #10b981);
  }
  
  .quota-modal-body p {
    margin: 0;
    line-height: 1.5;
    color: var(--foreground);
  }
  
  .quota-modal-footer {
    display: flex;
    gap: 0.75rem;
    padding: 1rem;
    border-top: 1px solid var(--border);
    justify-content: flex-end;
  }
  
  /* Responsive Design */
  @media (max-width: 768px) {
    .quota-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }
    
    .quota-progress {
      flex-direction: column;
      gap: 0.5rem;
    }
    
    .quota-percentage {
      align-self: flex-end;
    }
    
    .batch-info {
      text-align: center;
    }
    
    .quota-modal-body {
      flex-direction: column;
      text-align: center;
    }
    
    .quota-modal-footer {
      flex-direction: column;
    }
  }
  
  /* Dark Mode Adjustments */
  @media (prefers-color-scheme: dark) {
    .quota-warning.error {
      background: rgba(239, 68, 68, 0.1);
      color: #fca5a5;
      border-color: rgba(239, 68, 68, 0.3);
    }
    
    .quota-warning.warning {
      background: rgba(245, 158, 11, 0.1);
      color: #fcd34d;
      border-color: rgba(245, 158, 11, 0.3);
    }
    
    .quota-context {
      background: rgba(16, 185, 129, 0.1);
      border-color: rgba(16, 185, 129, 0.3);
    }
    
    .quota-remaining-text {
      color: #6ee7b7;
    }
  }
`;

// Inject styles if not already present
if (!document.getElementById('conversion-ui-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'conversion-ui-styles';
  styleSheet.textContent = conversionUIStyles;
  document.head.appendChild(styleSheet);
}

// Make available globally
window.ConversionUIIntegration = ConversionUIIntegration;