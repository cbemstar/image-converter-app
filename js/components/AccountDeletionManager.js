/**
 * Account Deletion Manager Component
 * Handles GDPR-compliant account deletion requests
 */

class AccountDeletionManager {
  constructor() {
    this.supabase = window.supabase
    this.deletionRequests = []
    this.isLoading = false
    this.showConfirmation = false
    this.init()
  }

  async init() {
    await this.loadDeletionRequests()
    this.render()
    this.attachEventListeners()
  }

  async loadDeletionRequests() {
    try {
      this.isLoading = true
      this.render()

      const { data: { session } } = await this.supabase.auth.getSession()
      if (!session) {
        throw new Error('Authentication required')
      }

      const response = await fetch('/supabase/functions/v1/account-deletion', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to load deletion requests')
      }

      this.deletionRequests = result.data.requests || []
      this.hasPendingDeletion = result.data.has_pending_deletion || false
    } catch (error) {
      console.error('Failed to load deletion requests:', error)
      this.showError('Failed to load deletion requests: ' + error.message)
    } finally {
      this.isLoading = false
      this.render()
    }
  }

  async requestAccountDeletion() {
    try {
      this.isLoading = true
      this.render()

      const { data: { session } } = await this.supabase.auth.getSession()
      if (!session) {
        throw new Error('Authentication required')
      }

      const response = await fetch('/supabase/functions/v1/account-deletion', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ confirm: true })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to request account deletion')
      }

      this.showSuccess('Account deletion request created successfully. You have 7 days to cancel this request.')
      this.showConfirmation = false
      await this.loadDeletionRequests()

    } catch (error) {
      console.error('Failed to request account deletion:', error)
      this.showError('Failed to request account deletion: ' + error.message)
    } finally {
      this.isLoading = false
      this.render()
    }
  }

  async cancelDeletion(requestId) {
    try {
      this.isLoading = true
      this.render()

      const { data: { session } } = await this.supabase.auth.getSession()
      if (!session) {
        throw new Error('Authentication required')
      }

      const response = await fetch('/supabase/functions/v1/account-deletion', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ request_id: requestId })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to cancel deletion request')
      }

      this.showSuccess('Account deletion request cancelled successfully.')
      await this.loadDeletionRequests()

    } catch (error) {
      console.error('Failed to cancel deletion:', error)
      this.showError('Failed to cancel deletion: ' + error.message)
    } finally {
      this.isLoading = false
      this.render()
    }
  }

  render() {
    const container = document.getElementById('account-deletion-manager')
    if (!container) return

    container.innerHTML = `
      <div class="account-deletion-manager">
        <div class="deletion-header">
          <h3>Account Deletion</h3>
          <p class="text-sm text-gray-600">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
        </div>

        ${this.renderDeletionWarning()}
        ${this.renderDeletionActions()}
        ${this.renderDeletionRequests()}
        ${this.renderConfirmationModal()}

        <div id="deletion-messages" class="messages"></div>
      </div>
    `
  }

  renderDeletionWarning() {
    return `
      <div class="deletion-warning">
        <div class="warning-icon">⚠️</div>
        <div class="warning-content">
          <h4>What happens when you delete your account?</h4>
          <ul>
            <li>All your personal data will be permanently deleted</li>
            <li>Your conversion history will be removed</li>
            <li>Active subscriptions will be cancelled</li>
            <li>You will lose access to all paid features</li>
            <li>This action cannot be undone</li>
          </ul>
          <p class="grace-period-info">
            <strong>Grace Period:</strong> You have 7 days to cancel the deletion request after submitting it.
          </p>
        </div>
      </div>
    `
  }

  renderDeletionActions() {
    if (this.hasPendingDeletion) {
      return `
        <div class="deletion-actions">
          <div class="pending-deletion-notice">
            <h4>Account Deletion Pending</h4>
            <p>You have a pending account deletion request. Check the status below.</p>
          </div>
        </div>
      `
    }

    return `
      <div class="deletion-actions">
        <div class="deletion-request-section">
          <h4>Delete My Account</h4>
          <p class="deletion-description">
            Before deleting your account, you may want to 
            <a href="#" id="export-data-link">export your data</a> first.
          </p>
          <button 
            id="request-deletion-btn" 
            class="btn btn-danger"
            ${this.isLoading ? 'disabled' : ''}
          >
            ${this.isLoading ? 'Processing...' : 'Delete My Account'}
          </button>
        </div>
      </div>
    `
  }

  renderDeletionRequests() {
    if (this.isLoading) {
      return '<div class="loading">Loading deletion requests...</div>'
    }

    if (this.deletionRequests.length === 0) {
      return ''
    }

    return `
      <div class="deletion-requests">
        <h4>Deletion Requests</h4>
        <div class="requests-list">
          ${this.deletionRequests.map(request => this.renderDeletionRequest(request)).join('')}
        </div>
      </div>
    `
  }

  renderDeletionRequest(request) {
    const statusClass = this.getStatusClass(request.status)
    const gracePeriodEnd = new Date(request.grace_period_end)
    const isGracePeriodActive = request.can_cancel && new Date() < gracePeriodEnd

    return `
      <div class="deletion-request ${statusClass}">
        <div class="request-header">
          <div class="request-info">
            <span class="request-id">Request #${request.id.slice(0, 8)}</span>
            <span class="request-status status-${request.status}">${this.formatStatus(request.status)}</span>
          </div>
          <div class="request-date">
            ${this.formatDate(request.created_at)}
          </div>
        </div>

        <div class="request-details">
          ${request.status === 'pending' ? `
            <div class="pending-details">
              <p class="status-message">
                Your account deletion request is pending. 
                ${isGracePeriodActive ? `You can cancel this request until ${this.formatDate(request.grace_period_end)}.` : 'The grace period has expired and your account will be deleted soon.'}
              </p>
              <div class="timeline">
                <div class="timeline-item completed">
                  <span class="timeline-date">${this.formatDate(request.created_at)}</span>
                  <span class="timeline-label">Deletion requested</span>
                </div>
                <div class="timeline-item ${isGracePeriodActive ? 'current' : 'completed'}">
                  <span class="timeline-date">${this.formatDate(request.grace_period_end)}</span>
                  <span class="timeline-label">Grace period ends</span>
                </div>
                <div class="timeline-item">
                  <span class="timeline-date">${this.formatDate(request.sla_deadline)}</span>
                  <span class="timeline-label">Account deleted (SLA deadline)</span>
                </div>
              </div>
              ${isGracePeriodActive ? `
                <button 
                  class="btn btn-secondary cancel-deletion-btn" 
                  data-request-id="${request.id}"
                >
                  Cancel Deletion Request
                </button>
              ` : ''}
            </div>
          ` : ''}

          ${request.status === 'processing' ? `
            <div class="processing-details">
              <p class="status-message">
                Your account is being deleted. This process may take some time.
                Started: ${this.formatDate(request.processing_started_at)}
              </p>
            </div>
          ` : ''}

          ${request.status === 'completed' ? `
            <div class="completed-details">
              <p class="status-message">
                Your account has been successfully deleted on ${this.formatDate(request.processing_completed_at)}.
              </p>
            </div>
          ` : ''}

          ${request.status === 'failed' ? `
            <div class="failed-details">
              <p class="status-message error">
                ${request.error_message === 'Cancelled by user' ? 
                  'Deletion request was cancelled.' : 
                  `Deletion failed: ${request.error_message || 'Unknown error'}`
                }
              </p>
            </div>
          ` : ''}
        </div>
      </div>
    `
  }

  renderConfirmationModal() {
    if (!this.showConfirmation) return ''

    return `
      <div class="modal-overlay">
        <div class="confirmation-modal">
          <div class="modal-header">
            <h3>Confirm Account Deletion</h3>
          </div>
          <div class="modal-content">
            <div class="confirmation-warning">
              <div class="warning-icon">⚠️</div>
              <p><strong>This action cannot be undone!</strong></p>
            </div>
            <p>Are you absolutely sure you want to delete your account? This will:</p>
            <ul>
              <li>Permanently delete all your personal data</li>
              <li>Cancel any active subscriptions</li>
              <li>Remove all conversion history</li>
              <li>Delete your profile and preferences</li>
            </ul>
            <p>You will have 7 days to cancel this request after confirmation.</p>
            <div class="confirmation-input">
              <label for="confirm-text">
                Type <strong>DELETE</strong> to confirm:
              </label>
              <input 
                type="text" 
                id="confirm-text" 
                placeholder="Type DELETE here"
                autocomplete="off"
              >
            </div>
          </div>
          <div class="modal-actions">
            <button 
              id="cancel-confirmation-btn" 
              class="btn btn-secondary"
            >
              Cancel
            </button>
            <button 
              id="confirm-deletion-btn" 
              class="btn btn-danger"
              disabled
            >
              Delete My Account
            </button>
          </div>
        </div>
      </div>
    `
  }

  attachEventListeners() {
    // Request deletion button
    const requestBtn = document.getElementById('request-deletion-btn')
    if (requestBtn) {
      requestBtn.addEventListener('click', () => {
        this.showConfirmation = true
        this.render()
        this.attachEventListeners()
      })
    }

    // Export data link
    const exportLink = document.getElementById('export-data-link')
    if (exportLink) {
      exportLink.addEventListener('click', (e) => {
        e.preventDefault()
        // Navigate to data export section or trigger export
        if (window.DataExportManager) {
          // If data export manager exists, trigger it
          const exportManager = new window.DataExportManager()
        } else {
          this.showError('Data export functionality not available')
        }
      })
    }

    // Cancel deletion buttons
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('cancel-deletion-btn')) {
        const requestId = e.target.dataset.requestId
        if (requestId) {
          this.cancelDeletion(requestId)
        }
      }
    })

    // Confirmation modal handlers
    const confirmText = document.getElementById('confirm-text')
    const confirmBtn = document.getElementById('confirm-deletion-btn')
    const cancelBtn = document.getElementById('cancel-confirmation-btn')

    if (confirmText && confirmBtn) {
      confirmText.addEventListener('input', () => {
        confirmBtn.disabled = confirmText.value !== 'DELETE'
      })

      confirmBtn.addEventListener('click', () => {
        this.requestAccountDeletion()
      })
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.showConfirmation = false
        this.render()
        this.attachEventListeners()
      })
    }

    // Close modal on overlay click
    const modalOverlay = document.querySelector('.modal-overlay')
    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
          this.showConfirmation = false
          this.render()
          this.attachEventListeners()
        }
      })
    }
  }

  getStatusClass(status) {
    const classes = {
      'pending': 'status-pending',
      'processing': 'status-processing',
      'completed': 'status-completed',
      'failed': 'status-failed'
    }
    return classes[status] || ''
  }

  formatStatus(status) {
    const statusMap = {
      'pending': 'Pending',
      'processing': 'Processing',
      'completed': 'Completed',
      'failed': 'Cancelled/Failed'
    }
    return statusMap[status] || status
  }

  formatDate(dateString) {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString()
  }

  showSuccess(message) {
    this.showMessage(message, 'success')
  }

  showError(message) {
    this.showMessage(message, 'error')
  }

  showMessage(message, type) {
    const messagesContainer = document.getElementById('deletion-messages')
    if (!messagesContainer) return

    const messageEl = document.createElement('div')
    messageEl.className = `message message-${type}`
    messageEl.textContent = message

    messagesContainer.appendChild(messageEl)

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.parentNode.removeChild(messageEl)
      }
    }, 5000)
  }
}

// Auto-initialize if container exists
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('account-deletion-manager')) {
    new AccountDeletionManager()
  }
})

// Export for manual initialization
window.AccountDeletionManager = AccountDeletionManager