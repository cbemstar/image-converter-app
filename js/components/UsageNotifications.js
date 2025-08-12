/**
 * Usage Notifications Component
 * 
 * Handles usage limit warning notifications and upgrade prompts
 * Requirements: 5.1, 5.6, 2.4
 */

import { useUsage } from '../hooks/useUsage.js';

export class UsageNotifications {
  constructor(options = {}) {
    this.options = {
      position: 'top-right', // top-right, top-left, bottom-right, bottom-left
      autoHide: true,
      hideDelay: 5000,
      showUpgradePrompts: true,
      thresholds: {
        warning: 75,    // Show warning at 75% usage
        critical: 90,   // Show critical warning at 90% usage
        exceeded: 100   // Show exceeded message at 100% usage
      },
      ...options
    };
    
    this.usage = useUsage();
    this.unsubscribe = null;
    this.lastNotificationLevel = null;
    this.notificationContainer = null;
    this.activeNotifications = new Map();
    
    this.init();
  }

  /**
   * Initialize the notification system
   */
  init() {
    this.createNotificationContainer();
    
    // Subscribe to usage updates
    this.unsubscribe = this.usage.subscribe((state) => {
      this.handleUsageUpdate(state);
    });
  }

  /**
   * Create the notification container
   */
  createNotificationContainer() {
    // Remove existing container if present
    const existing = document.getElementById('usage-notifications');
    if (existing) {
      existing.remove();
    }
    
    this.notificationContainer = document.createElement('div');
    this.notificationContainer.id = 'usage-notifications';
    this.notificationContainer.className = `notification-container ${this.options.position}`;
    
    document.body.appendChild(this.notificationContainer);
  }

  /**
   * Handle usage updates and show appropriate notifications
   * @param {Object} state - Current usage state
   */
  handleUsageUpdate(state) {
    const { usage, loading, error } = state;
    
    if (loading || error || !usage) {
      return;
    }
    
    const { conversionsUsed, conversionsLimit, remainingConversions, isGuest } = usage;
    const utilizationPercent = (conversionsUsed / conversionsLimit) * 100;
    
    // Determine notification level
    let currentLevel = null;
    if (utilizationPercent >= this.options.thresholds.exceeded) {
      currentLevel = 'exceeded';
    } else if (utilizationPercent >= this.options.thresholds.critical) {
      currentLevel = 'critical';
    } else if (utilizationPercent >= this.options.thresholds.warning) {
      currentLevel = 'warning';
    }
    
    // Only show notification if level has changed or is new
    if (currentLevel && currentLevel !== this.lastNotificationLevel) {
      this.showUsageNotification(usage, currentLevel);
      this.lastNotificationLevel = currentLevel;
    }
    
    // Show guest upgrade prompt if applicable
    if (isGuest && conversionsUsed > 0 && !this.activeNotifications.has('guest-upgrade')) {
      this.showGuestUpgradePrompt();
    }
  }

  /**
   * Show usage notification based on level
   * @param {Object} usage - Usage data
   * @param {string} level - Notification level (warning, critical, exceeded)
   */
  showUsageNotification(usage, level) {
    const { conversionsUsed, conversionsLimit, remainingConversions, planName } = usage;
    
    let message, type, actions = [];
    
    switch (level) {
      case 'exceeded':
        message = `You've reached your ${conversionsLimit} conversion limit for this month.`;
        type = 'error';
        if (this.options.showUpgradePrompts) {
          actions = [
            { text: 'Upgrade Plan', action: 'upgrade', primary: true },
            { text: 'Dismiss', action: 'dismiss' }
          ];
        }
        break;
        
      case 'critical':
        message = `You're running low on conversions! ${remainingConversions} remaining out of ${conversionsLimit}.`;
        type = 'warning';
        if (this.options.showUpgradePrompts) {
          actions = [
            { text: 'Upgrade Plan', action: 'upgrade', primary: true },
            { text: 'Dismiss', action: 'dismiss' }
          ];
        }
        break;
        
      case 'warning':
        message = `You've used ${conversionsUsed} of ${conversionsLimit} conversions this month.`;
        type = 'info';
        if (this.options.showUpgradePrompts && planName === 'Free') {
          actions = [
            { text: 'View Plans', action: 'upgrade' },
            { text: 'Dismiss', action: 'dismiss' }
          ];
        }
        break;
    }
    
    this.showNotification({
      id: `usage-${level}`,
      message,
      type,
      actions,
      persistent: level === 'exceeded'
    });
  }

  /**
   * Show guest upgrade prompt
   */
  showGuestUpgradePrompt() {
    this.showNotification({
      id: 'guest-upgrade',
      message: 'Sign up for a free account to get more conversions and save your work!',
      type: 'info',
      actions: [
        { text: 'Sign Up Free', action: 'sign-up', primary: true },
        { text: 'Maybe Later', action: 'dismiss' }
      ],
      persistent: false
    });
  }

  /**
   * Show a notification
   * @param {Object} options - Notification options
   */
  showNotification(options) {
    const {
      id,
      message,
      type = 'info',
      actions = [],
      persistent = false
    } = options;
    
    // Remove existing notification with same ID
    if (this.activeNotifications.has(id)) {
      this.removeNotification(id);
    }
    
    const notification = document.createElement('div');
    notification.className = `usage-notification ${type}`;
    notification.dataset.id = id;
    
    notification.innerHTML = `
      <div class="notification-content">
        <div class="notification-icon">
          ${this.getNotificationIcon(type)}
        </div>
        <div class="notification-message">
          ${message}
        </div>
        <div class="notification-actions">
          ${actions.map(action => `
            <button class="notification-btn ${action.primary ? 'primary' : 'secondary'}" 
                    data-action="${action.action}">
              ${action.text}
            </button>
          `).join('')}
          ${!persistent ? '<button class="notification-close" data-action="dismiss" aria-label="Close">&times;</button>' : ''}
        </div>
      </div>
    `;
    
    // Add event listeners
    notification.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      if (action) {
        this.handleNotificationAction(action, id);
      }
    });
    
    // Add to container
    this.notificationContainer.appendChild(notification);
    this.activeNotifications.set(id, notification);
    
    // Auto-hide if not persistent
    if (!persistent && this.options.autoHide) {
      setTimeout(() => {
        this.removeNotification(id);
      }, this.options.hideDelay);
    }
    
    // Animate in
    requestAnimationFrame(() => {
      notification.classList.add('show');
    });
  }

  /**
   * Get notification icon based on type
   * @param {string} type - Notification type
   * @returns {string} HTML for icon
   */
  getNotificationIcon(type) {
    const icons = {
      info: '<i class="fas fa-info-circle"></i>',
      warning: '<i class="fas fa-exclamation-triangle"></i>',
      error: '<i class="fas fa-exclamation-circle"></i>',
      success: '<i class="fas fa-check-circle"></i>'
    };
    
    return icons[type] || icons.info;
  }

  /**
   * Handle notification action clicks
   * @param {string} action - Action to perform
   * @param {string} notificationId - ID of the notification
   */
  handleNotificationAction(action, notificationId) {
    switch (action) {
      case 'upgrade':
        this.showUpgradeModal();
        this.removeNotification(notificationId);
        break;
        
      case 'sign-up':
        this.showSignUpModal();
        this.removeNotification(notificationId);
        break;
        
      case 'dismiss':
        this.removeNotification(notificationId);
        break;
        
      default:
        console.warn(`Unknown notification action: ${action}`);
    }
  }

  /**
   * Remove a notification
   * @param {string} id - Notification ID
   */
  removeNotification(id) {
    const notification = this.activeNotifications.get(id);
    if (notification) {
      notification.classList.add('hide');
      
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
        this.activeNotifications.delete(id);
      }, 300);
    }
  }

  /**
   * Clear all notifications
   */
  clearAllNotifications() {
    this.activeNotifications.forEach((notification, id) => {
      this.removeNotification(id);
    });
    this.lastNotificationLevel = null;
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
   * Update notification options
   * @param {Object} newOptions - New options to merge
   */
  updateOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
    
    // Update container position if changed
    if (newOptions.position) {
      this.notificationContainer.className = `notification-container ${this.options.position}`;
    }
  }

  /**
   * Destroy the notification system
   */
  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    
    this.clearAllNotifications();
    
    if (this.notificationContainer) {
      this.notificationContainer.remove();
      this.notificationContainer = null;
    }
    
    this.activeNotifications.clear();
  }
}

// Add CSS styles for notifications
const notificationStyles = `
  .notification-container {
    position: fixed;
    z-index: 9999;
    pointer-events: none;
    max-width: 400px;
    width: 100%;
  }
  
  .notification-container.top-right {
    top: 20px;
    right: 20px;
  }
  
  .notification-container.top-left {
    top: 20px;
    left: 20px;
  }
  
  .notification-container.bottom-right {
    bottom: 20px;
    right: 20px;
  }
  
  .notification-container.bottom-left {
    bottom: 20px;
    left: 20px;
  }
  
  .usage-notification {
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    margin-bottom: 12px;
    pointer-events: auto;
    transform: translateX(100%);
    opacity: 0;
    transition: all 0.3s ease;
  }
  
  .usage-notification.show {
    transform: translateX(0);
    opacity: 1;
  }
  
  .usage-notification.hide {
    transform: translateX(100%);
    opacity: 0;
  }
  
  .usage-notification.info {
    border-left: 4px solid var(--info, #3b82f6);
  }
  
  .usage-notification.warning {
    border-left: 4px solid var(--warning, #f59e0b);
  }
  
  .usage-notification.error {
    border-left: 4px solid var(--destructive, #ef4444);
  }
  
  .usage-notification.success {
    border-left: 4px solid var(--success, #10b981);
  }
  
  .notification-content {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
  }
  
  .notification-icon {
    flex-shrink: 0;
    margin-top: 2px;
  }
  
  .notification-icon i {
    font-size: 18px;
  }
  
  .usage-notification.info .notification-icon i {
    color: var(--info, #3b82f6);
  }
  
  .usage-notification.warning .notification-icon i {
    color: var(--warning, #f59e0b);
  }
  
  .usage-notification.error .notification-icon i {
    color: var(--destructive, #ef4444);
  }
  
  .usage-notification.success .notification-icon i {
    color: var(--success, #10b981);
  }
  
  .notification-message {
    flex: 1;
    font-size: 14px;
    line-height: 1.4;
    color: var(--foreground);
  }
  
  .notification-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
  
  .notification-btn {
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid transparent;
  }
  
  .notification-btn.primary {
    background: var(--primary);
    color: var(--primary-foreground);
  }
  
  .notification-btn.primary:hover {
    background: var(--primary-hover, var(--primary));
    transform: translateY(-1px);
  }
  
  .notification-btn.secondary {
    background: var(--secondary);
    color: var(--secondary-foreground);
    border-color: var(--border);
  }
  
  .notification-btn.secondary:hover {
    background: var(--secondary-hover, var(--secondary));
  }
  
  .notification-close {
    background: none;
    border: none;
    color: var(--muted-foreground);
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s ease;
  }
  
  .notification-close:hover {
    background: var(--muted);
    color: var(--foreground);
  }
  
  @media (max-width: 768px) {
    .notification-container {
      left: 10px !important;
      right: 10px !important;
      max-width: none;
    }
    
    .notification-content {
      padding: 12px;
      gap: 8px;
    }
    
    .notification-actions {
      flex-direction: column;
      align-items: stretch;
      gap: 4px;
    }
    
    .notification-btn {
      width: 100%;
      text-align: center;
    }
  }
`;

// Inject styles if not already present
if (!document.getElementById('usage-notification-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'usage-notification-styles';
  styleSheet.textContent = notificationStyles;
  document.head.appendChild(styleSheet);
}

// Make available globally
window.UsageNotifications = UsageNotifications;