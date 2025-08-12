/**
 * Data Export Manager Component
 * Handles GDPR-compliant data export requests
 */

class DataExportManager {
  constructor() {
    this.supabase = window.supabase
    this.exportRequests = []
    this.isLoading = false
    this.init()
  }

  async init() {
    await this.loadExportRequests()
    this.render()
    this.attachEventListeners()
  }

  async loadExportRequests() {
    try {
      this.isLoading = true
      this.render()

      const { data: { session } } = await this.supabase.auth.getSession()
      if (!session) {
        throw new Error('Authentication required')
      }

      const response = await fetch('/supabase/functions/v1/data-export', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to load export requests')
      }

      this.exportRequests = result.data.requests || []
    } catch (error) {
      console.error('Failed to load export requests:', error)
      this.showError('Failed to load export requests: ' + error.message)
    } finally {
      this.isLoading = false
      this.render()
    }
  }

  async requestDataExport(format = 'json') {
    try {
      this.isLoading = true
      this.render()

      const { data: { session } } = await this.supabase.auth.getSession()
      if (!session) {
        throw new Error('Authentication required')
      }

      const response = await fetch('/supabase/functions/v1/data-export', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ format })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to request data export')
      }

      this.showSuccess('Data export request created successfully. You will receive an email when the export is ready.')
      await this.loadExportRequests()

    } catch (error) {
      console.error('Failed to request data export:', error)
      this.showError('Failed to request data export: ' + error.message)
    } finally {
      this.isLoading = false
      this.render()
    }
  }

  async downloadExport(request) {
    if (!request.download_url) {
      this.showError('Download URL not available')
      return
    }

    if (new Date(request.download_expires_at) < new Date()) {
      this.showError('Download link has expired. Please request a new export.')
      return
    }

    try {
      // Create a temporary link to download the file
      const link = document.createElement('a')
      link.href = request.download_url
      link.download = `user-data-export-${request.id}.${request.export_format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      this.showSuccess('Download started')
    } catch (error) {
      console.error('Failed to download export:', error)
      this.showError('Failed to download export: ' + error.message)
    }
  }

  render() {
    const container = document.getElementById('data-export-manager')
    if (!container) return

    container.innerHTML = `
      <div class="data-export-manager">
        <div class="export-header">
          <h3>Data Export</h3>
          <p class="text-sm text-gray-600">
            Request a complete export of your personal data. We'll provide all your data within 30 days as required by GDPR.
          </p>
        </div>

        <div class="export-actions">
          <div class="export-request-section">
            <h4>Request New Export</h4>
            <div class="format-selection">
              <label class="radio-option">
                <input type="radio" name="export-format" value="json" checked>
                <span>JSON Format</span>
                <small>Machine-readable format, includes all data structure</small>
              </label>
              <label class="radio-option">
                <input type="radio" name="export-format" value="csv">
                <span>CSV Format</span>
                <small>Spreadsheet-friendly format, flattened data structure</small>
              </label>
            </div>
            <button 
              id="request-export-btn" 
              class="btn btn-primary"
              ${this.isLoading ? 'disabled' : ''}
            >
              ${this.isLoading ? 'Processing...' : 'Request Data Export'}
            </button>
          </div>
        </div>

        <div class="export-requests">
          <h4>Export Requests</h4>
          ${this.renderExportRequests()}
        </div>

        <div id="export-messages" class="messages"></div>
      </div>
    `
  }

  renderExportRequests() {
    if (this.isLoading) {
      return '<div class="loading">Loading export requests...</div>'
    }

    if (this.exportRequests.length === 0) {
      return '<div class="no-requests">No export requests found.</div>'
    }

    return `
      <div class="requests-list">
        ${this.exportRequests.map(request => this.renderExportRequest(request)).join('')}
      </div>
    `
  }

  renderExportRequest(request) {
    const statusClass = this.getStatusClass(request.status)
    const isExpired = request.download_expires_at && new Date(request.download_expires_at) < new Date()
    const canDownload = request.status === 'completed' && request.download_url && !isExpired

    return `
      <div class="export-request ${statusClass}">
        <div class="request-header">
          <div class="request-info">
            <span class="request-id">Request #${request.id.slice(0, 8)}</span>
            <span class="request-format">${request.export_format.toUpperCase()}</span>
            <span class="request-status status-${request.status}">${this.formatStatus(request.status)}</span>
          </div>
          <div class="request-date">
            ${this.formatDate(request.created_at)}
          </div>
        </div>

        <div class="request-details">
          ${request.status === 'pending' ? `
            <p class="status-message">
              Your export request is queued for processing. 
              SLA deadline: ${this.formatDate(request.sla_deadline)}
            </p>
          ` : ''}

          ${request.status === 'processing' ? `
            <p class="status-message">
              Your export is being processed. This may take a few minutes.
              Started: ${this.formatDate(request.processing_started_at)}
            </p>
          ` : ''}

          ${request.status === 'completed' ? `
            <div class="completed-details">
              <p class="status-message">
                Export completed on ${this.formatDate(request.processing_completed_at)}
              </p>
              <div class="file-info">
                <span class="file-size">Size: ${this.formatFileSize(request.file_size_bytes)}</span>
                ${request.download_expires_at ? `
                  <span class="expires-at">
                    Expires: ${this.formatDate(request.download_expires_at)}
                    ${isExpired ? '(Expired)' : ''}
                  </span>
                ` : ''}
              </div>
              ${canDownload ? `
                <button 
                  class="btn btn-secondary download-btn" 
                  data-request-id="${request.id}"
                >
                  Download Export
                </button>
              ` : ''}
              ${isExpired ? `
                <p class="expired-message">
                  This download link has expired. Please request a new export.
                </p>
              ` : ''}
            </div>
          ` : ''}

          ${request.status === 'failed' ? `
            <div class="failed-details">
              <p class="status-message error">
                Export failed: ${request.error_message || 'Unknown error'}
              </p>
              <p class="retry-message">
                You can request a new export using the form above.
              </p>
            </div>
          ` : ''}
        </div>
      </div>
    `
  }

  attachEventListeners() {
    // Request export button
    const requestBtn = document.getElementById('request-export-btn')
    if (requestBtn) {
      requestBtn.addEventListener('click', () => {
        const selectedFormat = document.querySelector('input[name="export-format"]:checked')?.value || 'json'
        this.requestDataExport(selectedFormat)
      })
    }

    // Download buttons
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('download-btn')) {
        const requestId = e.target.dataset.requestId
        const request = this.exportRequests.find(r => r.id === requestId)
        if (request) {
          this.downloadExport(request)
        }
      }
    })
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
      'failed': 'Failed'
    }
    return statusMap[status] || status
  }

  formatDate(dateString) {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString()
  }

  formatFileSize(bytes) {
    if (!bytes) return 'N/A'
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  showSuccess(message) {
    this.showMessage(message, 'success')
  }

  showError(message) {
    this.showMessage(message, 'error')
  }

  showMessage(message, type) {
    const messagesContainer = document.getElementById('export-messages')
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
  if (document.getElementById('data-export-manager')) {
    new DataExportManager()
  }
})

// Export for manual initialization
window.DataExportManager = DataExportManager