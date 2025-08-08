/**
 * QuotaNotifications - User-friendly quota notification system
 * Provides visual feedback for quota usage and warnings
 */

class QuotaNotifications {
  constructor(quotaManager) {
    this.quotaManager = quotaManager || window.quotaManager;
    this.notifications = new Map();
    this.isInitialized = false;
    
    this.init();
  }

  /**
   * Initialize the notification system
   */
  init() {
    // Add CSS styles
    this.addStyles();
    
    // Listen for quota events
    if (this.quotaManager) {
      this.quotaManager.addQuotaListener((event, data) => {
        this.handleQuotaEvent(event, data);
      });
    }
    
    this.isInitialized = true;
  }

  /**
   * Add CSS styles for notifications
   */
  addStyles() {
    if (document.getElementById('quotaNotificationStyles')) {
      return;
    }

    const styles = document.createElement('style');
    styles.id = 'quotaNotificationStyles';
    styles.textContent = `
      .quota-notification-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        pointer-events: none;
      }

      .quota-notification {
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
        padding: 16px 20px;
        margin-bottom: 12px;
        max-width: 400px;
        border-left: 4px solid #3b82f6;
        pointer-events: auto;
        transform: translateX(100%);
        transition: transform 0.3s ease, opacity 0.3s ease;
        opacity: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .quota-notification.show {
        transform: translateX(0);
        opacity: 1;
      }

      .quota-notification.warning {
        border-left-color: #f59e0b;
      }

      .quota-notification.critical {
        border-left-color: #ef4444;
      }

      .quota-notification.exceeded {
        border-left-color: #dc2626;
        background: #fef2f2;
      }

      .quota-notification-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
      }

      .quota-notification-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        color: #1f2937;
        font-size: 14px;
      }

      .quota-notification-close {
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        color: #6b7280;
        font-size: 16px;
        line-height: 1;
        transition: all 0.2s;
      }

      .quota-notification-close:hover {
        background: #f3f4f6;
        color: #374151;
      }

      .quota-notification-message {
        color: #4b5563;
        font-size: 13px;
        line-height: 1.4;
        margin-bottom: 12px;
      }

      .quota-notification-progress {
        background: #e5e7eb;
        border-radius: 4px;
        height: 6px;
        overflow: hidden;
        margin-bottom: 12px;
      }

      .quota-notification-progress-fill {
        height: 100%;
        border-radius: 4px;
        transition: width 0.3s ease;
        background: #3b82f6;
      }

      .quota-notification.warning .quota-notification-progress-fill {
        background: #f59e0b;
      }

      .quota-notification.critical .quota-notification-progress-fill,
      .quota-notification.exceeded .quota-notification-progress-fill {
        background: #ef4444;
      }

      .quota-notification-actions {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .quota-notification-btn {
        padding: 6px 12px;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .quota-notification-btn-primary {
        background: #3b82f6;
        color: white;
      }

      .quota-notification-btn-primary:hover {
        background: #2563eb;
      }

      .quota-notification-btn-secondary {
        background: #f3f4f6;
        color: #374151;
      }

      .quota-notification-btn-secondary:hover {
        background: #e5e7eb;
      }

      .quota-notification-stats {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: #6b7280;
        margin-top: 8px;
      }

      /* Mobile responsive */
      @media (max-width: 480px) {
        .quota-notification-container {
          left: 10px;
          right: 10px;
          top: 10px;
        }

        .quota-notification {
          max-width: none;
          margin-bottom: 8px;
        }

        .quota-notification-actions {
          flex-direction: column;
          align-items: stretch;
        }

        .quota-notification-btn {
          justify-content: center;
        }
      }

      /* Animation for removal */
      .quota-notification.removing {
        transform: translateX(100%);
        opacity: 0;
      }
    `;

    document.head.appendChild(styles);
  }

  /**
   * Handle quota events
   */
  handleQuotaEvent(event, data) {
    switch (event) {
      case 'quota_warning':
        this.showQuotaWarning(data);
        break;
      case 'usage_updated':
        this.updateProgressBars(data);
        break;
      case 'monthly_reset':
        this.showMonthlyReset();
        break;
    }
  }

  /**
   * Show quota warning notification
   */
  showQuotaWarning(warningData) {
    const { quotaType, level, percentage } = warningData;
    
    // Don't show duplicate warnings
    const notificationId = `${quotaType}_${level}`;
    if (this.notifications.has(notificationId)) {
      return;
    }

    const notification = this.createNotification({
      id: notificationId,
      type: level,
      title: this.getWarningTitle(quotaType, level),
      message: this.getWarningMessage(quotaType, level, percentage),
      progress: percentage,
      actions: this.getWarningActions(quotaType, level),
      autoClose: level === 'warning' ? 8000 : false
    });

    this.notifications.set(notificationId, notification);
  }

  /**
   * Get warning title based on quota type and level
   */
  getWarningTitle(quotaType, level) {
    const quotaLabels = {
      storage: 'Storage',
      conversions: 'Conversions',
      apiCalls: 'API Calls'
    };

    const levelLabels = {
      warning: 'Usage Warning',
      critical: 'Critical Usage',
      exceeded: 'Quota Exceeded'
    };

    return `${quotaLabels[quotaType]} ${levelLabels[level]}`;
  }

  /**
   * Get warning message based on quota type and level
   */
  getWarningMessage(quotaType, level, percentage) {
    const quotaLabels = {
      storage: 'storage space',
      conversions: 'monthly conversions',
      apiCalls: 'monthly API calls'
    };

    const messages = {
      warning: `You've used ${percentage}% of your ${quotaLabels[quotaType]}. Consider upgrading to avoid interruptions.`,
      critical: `You've used ${percentage}% of your ${quotaLabels[quotaType]}. Upgrade now to continue using all features.`,
      exceeded: `You've exceeded your ${quotaLabels[quotaType]} limit. Please upgrade to continue.`
    };

    return messages[level];
  }

  /**
   * Get warning actions based on quota type and level
   */
  getWarningActions(quotaType, level) {
    const actions = [];

    if (level === 'critical' || level === 'exceeded') {
      actions.push({
        text: 'Upgrade Now',
        icon: 'fas fa-crown',
        class: 'quota-notification-btn-primary',
        action: () => this.handleUpgrade()
      });
    }

    if (level === 'warning') {
      actions.push({
        text: 'View Usage',
        icon: 'fas fa-chart-bar',
        class: 'quota-notification-btn-secondary',
        action: () => this.handleViewUsage()
      });
    }

    return actions;
  }

  /**
   * Create notification element
   */
  createNotification(options) {
    const {
      id,
      type = 'info',
      title,
      message,
      progress = null,
      actions = [],
      autoClose = false
    } = options;

    // Create container if it doesn't exist
    let container = document.getElementById('quotaNotificationContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'quotaNotificationContainer';
      container.className = 'quota-notification-container';
      document.body.appendChild(container);
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `quota-notification ${type}`;
    notification.dataset.id = id;

    // Build notification HTML
    let html = `
      <div class="quota-notification-header">
        <div class="quota-notification-title">
          <i class="fas fa-${this.getTypeIcon(type)}"></i>
          ${title}
        </div>
        <button class="quota-notification-close" onclick="quotaNotifications.closeNotification('${id}')">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="quota-notification-message">${message}</div>
    `;

    // Add progress bar if provided
    if (progress !== null) {
      html += `
        <div class="quota-notification-progress">
          <div class="quota-notification-progress-fill" style="width: ${Math.min(100, progress)}%"></div>
        </div>
        <div class="quota-notification-stats">
          <span>Usage: ${Math.round(progress)}%</span>
          <span>Remaining: ${Math.round(100 - progress)}%</span>
        </div>
      `;
    }

    // Add actions if provided
    if (actions.length > 0) {
      html += '<div class="quota-notification-actions">';
      actions.forEach(action => {
        const actionId = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        html += `
          <button class="quota-notification-btn ${action.class}" onclick="quotaNotifications.handleAction('${actionId}')">
            <i class="${action.icon}"></i>
            ${action.text}
          </button>
        `;
        // Store action handler
        this[`action_${actionId}`] = action.action;
      });
      html += '</div>';
    }

    notification.innerHTML = html;
    container.appendChild(notification);

    // Animate in
    requestAnimationFrame(() => {
      notification.classList.add('show');
    });

    // Auto-close if specified
    if (autoClose) {
      setTimeout(() => {
        this.closeNotification(id);
      }, autoClose);
    }

    return notification;
  }

  /**
   * Get icon for notification type
   */
  getTypeIcon(type) {
    const icons = {
      info: 'info-circle',
      warning: 'exclamation-triangle',
      critical: 'exclamation-triangle',
      exceeded: 'ban',
      success: 'check-circle'
    };
    return icons[type] || 'info-circle';
  }

  /**
   * Close notification
   */
  closeNotification(id) {
    const notification = document.querySelector(`[data-id="${id}"]`);
    if (notification) {
      notification.classList.add('removing');
      setTimeout(() => {
        notification.remove();
        this.notifications.delete(id);
      }, 300);
    }
  }

  /**
   * Handle action button clicks
   */
  handleAction(actionId) {
    const handler = this[`action_${actionId}`];
    if (handler && typeof handler === 'function') {
      handler();
    }
  }

  /**
   * Handle upgrade action
   */
  handleUpgrade() {
    // Redirect to pricing or show upgrade modal
    window.location.href = '/pricing.html';
  }

  /**
   * Handle view usage action
   */
  handleViewUsage() {
    // Redirect to dashboard
    window.location.href = '/dashboard.html';
  }

  /**
   * Update progress bars in existing notifications
   */
  updateProgressBars(data) {
    // Update any visible progress bars with new data
    const progressBars = document.querySelectorAll('.quota-notification-progress-fill');
    progressBars.forEach(bar => {
      const notification = bar.closest('.quota-notification');
      const quotaType = notification?.dataset.quotaType;
      
      if (quotaType && data[quotaType]) {
        const percentage = data[quotaType].percentage;
        bar.style.width = `${Math.min(100, percentage)}%`;
        
        // Update stats
        const stats = notification.querySelector('.quota-notification-stats');
        if (stats) {
          stats.innerHTML = `
            <span>Usage: ${Math.round(percentage)}%</span>
            <span>Remaining: ${Math.round(100 - percentage)}%</span>
          `;
        }
      }
    });
  }

  /**
   * Show monthly reset notification
   */
  showMonthlyReset() {
    this.createNotification({
      id: 'monthly_reset',
      type: 'success',
      title: 'Monthly Quota Reset',
      message: 'Your monthly conversion and API call quotas have been reset. Happy converting!',
      autoClose: 5000
    });
  }

  /**
   * Show custom notification
   */
  showNotification(options) {
    const id = options.id || `notification_${Date.now()}`;
    return this.createNotification({ ...options, id });
  }

  /**
   * Clear all notifications
   */
  clearAll() {
    const container = document.getElementById('quotaNotificationContainer');
    if (container) {
      container.innerHTML = '';
    }
    this.notifications.clear();
  }

  /**
   * Get active notifications count
   */
  getActiveCount() {
    return this.notifications.size;
  }
}

// Create global instance
if (typeof window !== 'undefined') {
  window.addEventListener('supabase-auth-change', () => {
    if (window.quotaManager && !window.quotaNotifications) {
      window.quotaNotifications = new QuotaNotifications(window.quotaManager);
    }
  });

  // Initialize immediately if quota manager is already available
  if (window.quotaManager) {
    window.quotaNotifications = new QuotaNotifications(window.quotaManager);
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = QuotaNotifications;
}