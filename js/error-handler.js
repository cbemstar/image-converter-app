/**
 * ErrorHandler - Comprehensive error handling and user feedback system
 * Provides consistent error management, user-friendly messages, and toast notifications
 */

class ErrorHandler {
  constructor() {
    this.errorQueue = [];
    this.isInitialized = false;
    this.retryAttempts = new Map();
    this.maxRetries = 3;
    
    this.initialize();
  }

  /**
   * Initialize the error handler
   */
  initialize() {
    try {
      // Create toast container
      this.createToastContainer();
      
      // Set up global error handlers
      this.setupGlobalErrorHandlers();
      
      // Set up network error detection
      this.setupNetworkErrorHandling();
      
      this.isInitialized = true;
      console.log('ErrorHandler initialized successfully');
      
    } catch (error) {
      console.error('ErrorHandler initialization error:', error);
    }
  }

  /**
   * Create toast notification container
   */
  createToastContainer() {
    if (document.getElementById('toast-container')) return;

    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    container.innerHTML = '';
    
    // Add styles
    const styles = `
      <style id="toast-styles">
        .toast-container {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 10000;
          max-width: 400px;
          pointer-events: none;
        }

        .toast {
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          margin-bottom: 12px;
          padding: 16px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          transform: translateX(100%);
          transition: all 0.3s ease;
          pointer-events: auto;
          border-left: 4px solid #6b7280;
        }

        .toast.show {
          transform: translateX(0);
        }

        .toast.success {
          border-left-color: #10b981;
        }

        .toast.error {
          border-left-color: #ef4444;
        }

        .toast.warning {
          border-left-color: #f59e0b;
        }

        .toast.info {
          border-left-color: #3b82f6;
        }

        .toast-icon {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          color: white;
          flex-shrink: 0;
        }

        .toast.success .toast-icon {
          background: #10b981;
        }

        .toast.error .toast-icon {
          background: #ef4444;
        }

        .toast.warning .toast-icon {
          background: #f59e0b;
        }

        .toast.info .toast-icon {
          background: #3b82f6;
        }

        .toast-content {
          flex: 1;
        }

        .toast-title {
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 4px;
          font-size: 14px;
        }

        .toast-message {
          color: #6b7280;
          font-size: 13px;
          line-height: 1.4;
        }

        .toast-actions {
          display: flex;
          gap: 8px;
          margin-top: 8px;
        }

        .toast-btn {
          padding: 4px 12px;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .toast-btn-primary {
          background: #3b82f6;
          color: white;
        }

        .toast-btn-primary:hover {
          background: #2563eb;
        }

        .toast-btn-secondary {
          background: #f3f4f6;
          color: #374151;
        }

        .toast-btn-secondary:hover {
          background: #e5e7eb;
        }

        .toast-close {
          background: none;
          border: none;
          color: #9ca3af;
          cursor: pointer;
          font-size: 16px;
          padding: 0;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .toast-close:hover {
          background: #f3f4f6;
          color: #6b7280;
        }

        @media (max-width: 480px) {
          .toast-container {
            left: 10px;
            right: 10px;
            max-width: none;
          }
        }
      </style>
    `;

    if (!document.getElementById('toast-styles')) {
      document.head.insertAdjacentHTML('beforeend', styles);
    }

    document.body.appendChild(container);
  }

  /**
   * Set up global error handlers
   */
  setupGlobalErrorHandlers() {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      this.handleError(event.reason, {
        type: 'unhandled_promise',
        source: 'global'
      });
    });

    // Handle JavaScript errors
    window.addEventListener('error', (event) => {
      console.error('JavaScript error:', event.error);
      this.handleError(event.error, {
        type: 'javascript_error',
        source: 'global',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });
  }

  /**
   * Set up network error handling
   */
  setupNetworkErrorHandling() {
    // Monitor online/offline status
    window.addEventListener('online', () => {
      this.showToast('Connection restored', 'You are back online!', 'success');
    });

    window.addEventListener('offline', () => {
      this.showToast('Connection lost', 'You are currently offline. Some features may not work.', 'warning');
    });
  }

  /**
   * Handle different types of errors
   */
  handleError(error, context = {}) {
    const errorInfo = this.categorizeError(error, context);
    
    // Log error for debugging
    console.error('Error handled:', errorInfo);
    
    // Track error if analytics is available
    if (window.trackError) {
      window.trackError(error, context);
    }

    // Show appropriate user feedback
    this.showErrorFeedback(errorInfo);
    
    // Handle specific error types
    switch (errorInfo.category) {
      case 'quota_exceeded':
        this.handleQuotaError(errorInfo);
        break;
      case 'authentication':
        this.handleAuthError(errorInfo);
        break;
      case 'network':
        this.handleNetworkError(errorInfo);
        break;
      case 'file_upload':
        this.handleFileUploadError(errorInfo);
        break;
      case 'payment':
        this.handlePaymentError(errorInfo);
        break;
      default:
        this.handleGenericError(errorInfo);
    }
  }

  /**
   * Categorize error types
   */
  categorizeError(error, context) {
    const message = error?.message || error || 'Unknown error';
    const errorInfo = {
      original: error,
      message: message,
      context: context,
      category: 'generic',
      severity: 'medium',
      userMessage: 'An unexpected error occurred',
      actions: []
    };

    // Quota errors
    if (message.includes('quota') || message.includes('limit exceeded')) {
      errorInfo.category = 'quota_exceeded';
      errorInfo.severity = 'high';
      errorInfo.userMessage = 'You have reached your usage limit';
      errorInfo.actions = [
        { label: 'Upgrade Plan', action: () => window.location.href = '/pricing.html' }
      ];
    }
    // Authentication errors
    else if (message.includes('auth') || message.includes('unauthorized') || message.includes('token')) {
      errorInfo.category = 'authentication';
      errorInfo.severity = 'high';
      errorInfo.userMessage = 'Authentication required';
      errorInfo.actions = [
        { label: 'Sign In', action: () => window.location.href = '/auth.html' }
      ];
    }
    // Network errors
    else if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      errorInfo.category = 'network';
      errorInfo.severity = 'medium';
      errorInfo.userMessage = 'Connection problem detected';
      errorInfo.actions = [
        { label: 'Retry', action: () => this.retryLastAction(context) }
      ];
    }
    // File upload errors
    else if (message.includes('file') || message.includes('upload') || message.includes('size')) {
      errorInfo.category = 'file_upload';
      errorInfo.severity = 'medium';
      errorInfo.userMessage = 'File upload failed';
    }
    // Payment errors
    else if (message.includes('payment') || message.includes('stripe') || message.includes('billing')) {
      errorInfo.category = 'payment';
      errorInfo.severity = 'high';
      errorInfo.userMessage = 'Payment processing failed';
      errorInfo.actions = [
        { label: 'Try Again', action: () => this.retryLastAction(context) }
      ];
    }

    return errorInfo;
  }

  /**
   * Show error feedback to user
   */
  showErrorFeedback(errorInfo) {
    const title = this.getErrorTitle(errorInfo.category);
    
    this.showToast(
      title,
      errorInfo.userMessage,
      errorInfo.severity === 'high' ? 'error' : 'warning',
      {
        actions: errorInfo.actions,
        duration: errorInfo.severity === 'high' ? 0 : 5000 // Don't auto-hide critical errors
      }
    );
  }

  /**
   * Get error title based on category
   */
  getErrorTitle(category) {
    const titles = {
      quota_exceeded: 'Usage Limit Reached',
      authentication: 'Authentication Required',
      network: 'Connection Issue',
      file_upload: 'Upload Failed',
      payment: 'Payment Error',
      generic: 'Error Occurred'
    };
    
    return titles[category] || 'Error';
  }

  /**
   * Handle quota exceeded errors
   */
  handleQuotaError(errorInfo) {
    // Show upgrade prompt if quota manager is available
    if (window.quotaManager) {
      const suggestions = window.quotaManager.getUpgradeSuggestions();
      if (suggestions.suggestions.length > 0) {
        // Show upgrade modal or redirect to pricing
        setTimeout(() => {
          if (confirm('You have reached your usage limit. Would you like to upgrade your plan?')) {
            window.location.href = '/pricing.html';
          }
        }, 1000);
      }
    }
  }

  /**
   * Handle authentication errors
   */
  handleAuthError(errorInfo) {
    // Clear any cached auth data
    localStorage.removeItem('supabase.auth.token');
    sessionStorage.clear();
    
    // Redirect to auth page after a delay
    setTimeout(() => {
      sessionStorage.setItem('auth_redirect', window.location.href);
      window.location.href = '/auth.html';
    }, 2000);
  }

  /**
   * Handle network errors
   */
  handleNetworkError(errorInfo) {
    // Check if we're offline
    if (!navigator.onLine) {
      this.showToast(
        'Offline',
        'You are currently offline. Please check your internet connection.',
        'warning'
      );
      return;
    }

    // Implement exponential backoff for retries
    const retryKey = JSON.stringify(errorInfo.context);
    const attempts = this.retryAttempts.get(retryKey) || 0;
    
    if (attempts < this.maxRetries) {
      const delay = Math.pow(2, attempts) * 1000; // 1s, 2s, 4s
      setTimeout(() => {
        this.retryAttempts.set(retryKey, attempts + 1);
        this.retryLastAction(errorInfo.context);
      }, delay);
    } else {
      this.showToast(
        'Connection Failed',
        'Unable to connect after multiple attempts. Please try again later.',
        'error'
      );
    }
  }

  /**
   * Handle file upload errors
   */
  handleFileUploadError(errorInfo) {
    const message = errorInfo.original?.message || '';
    
    if (message.includes('size')) {
      this.showToast(
        'File Too Large',
        'The selected file exceeds the maximum size limit. Please choose a smaller file.',
        'warning'
      );
    } else if (message.includes('type')) {
      this.showToast(
        'Invalid File Type',
        'This file type is not supported. Please choose a different file.',
        'warning'
      );
    } else {
      this.showToast(
        'Upload Failed',
        'Failed to upload the file. Please try again.',
        'error',
        {
          actions: [
            { label: 'Retry', action: () => this.retryLastAction(errorInfo.context) }
          ]
        }
      );
    }
  }

  /**
   * Handle payment errors
   */
  handlePaymentError(errorInfo) {
    const message = errorInfo.original?.message || '';
    
    if (message.includes('card')) {
      this.showToast(
        'Payment Failed',
        'There was an issue with your payment method. Please check your card details.',
        'error'
      );
    } else if (message.includes('declined')) {
      this.showToast(
        'Payment Declined',
        'Your payment was declined. Please try a different payment method.',
        'error'
      );
    } else {
      this.showToast(
        'Payment Error',
        'Payment processing failed. Please try again or contact support.',
        'error',
        {
          actions: [
            { label: 'Contact Support', action: () => window.open('mailto:support@example.com') }
          ]
        }
      );
    }
  }

  /**
   * Handle generic errors
   */
  handleGenericError(errorInfo) {
    this.showToast(
      'Something went wrong',
      'An unexpected error occurred. Please try again.',
      'error',
      {
        actions: [
          { label: 'Retry', action: () => this.retryLastAction(errorInfo.context) }
        ]
      }
    );
  }

  /**
   * Show toast notification
   */
  showToast(title, message, type = 'info', options = {}) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };

    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || 'ℹ'}</div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
        ${options.actions ? `
          <div class="toast-actions">
            ${options.actions.map(action => 
              `<button class="toast-btn toast-btn-primary" onclick="this.closest('.toast').remove(); (${action.action.toString()})()">${action.label}</button>`
            ).join('')}
          </div>
        ` : ''}
      </div>
      <button class="toast-close" onclick="this.closest('.toast').remove()">×</button>
    `;

    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Auto-remove after duration (unless duration is 0)
    const duration = options.duration !== undefined ? options.duration : 5000;
    if (duration > 0) {
      setTimeout(() => {
        this.removeToast(toast);
      }, duration);
    }

    return toast;
  }

  /**
   * Remove toast with animation
   */
  removeToast(toast) {
    if (!toast || !toast.parentNode) return;
    
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  /**
   * Retry last action
   */
  retryLastAction(context) {
    // This would need to be implemented based on the specific context
    // For now, just reload the page as a fallback
    if (context?.retryFunction) {
      context.retryFunction();
    } else {
      window.location.reload();
    }
  }

  /**
   * Clear all toasts
   */
  clearAllToasts() {
    const container = document.getElementById('toast-container');
    if (container) {
      container.innerHTML = '';
    }
  }

  /**
   * Show success message
   */
  showSuccess(title, message, options = {}) {
    return this.showToast(title, message, 'success', options);
  }

  /**
   * Show error message
   */
  showError(title, message, options = {}) {
    return this.showToast(title, message, 'error', options);
  }

  /**
   * Show warning message
   */
  showWarning(title, message, options = {}) {
    return this.showToast(title, message, 'warning', options);
  }

  /**
   * Show info message
   */
  showInfo(title, message, options = {}) {
    return this.showToast(title, message, 'info', options);
  }

  /**
   * Handle form validation errors
   */
  handleFormErrors(errors, formElement) {
    // Clear existing errors
    const existingErrors = formElement.querySelectorAll('.field-error');
    existingErrors.forEach(error => error.remove());

    // Show new errors
    Object.keys(errors).forEach(fieldName => {
      const field = formElement.querySelector(`[name="${fieldName}"]`);
      if (field) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.style.cssText = 'color: #ef4444; font-size: 12px; margin-top: 4px;';
        errorDiv.textContent = errors[fieldName];
        
        field.parentNode.appendChild(errorDiv);
        field.style.borderColor = '#ef4444';
      }
    });
  }

  /**
   * Clear form errors
   */
  clearFormErrors(formElement) {
    const errors = formElement.querySelectorAll('.field-error');
    errors.forEach(error => error.remove());
    
    const fields = formElement.querySelectorAll('input, select, textarea');
    fields.forEach(field => {
      field.style.borderColor = '';
    });
  }
}

// Global utility functions
window.showToast = function(title, message, type = 'info', options = {}) {
  if (window.errorHandler) {
    return window.errorHandler.showToast(title, message, type, options);
  }
};

window.handleError = function(error, context = {}) {
  if (window.errorHandler) {
    window.errorHandler.handleError(error, context);
  } else {
    console.error('Error (no handler):', error);
  }
};

// Create global instance
if (typeof window !== 'undefined') {
  window.errorHandler = new ErrorHandler();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ErrorHandler;
}