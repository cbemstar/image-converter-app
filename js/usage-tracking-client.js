/**
 * Client-side Usage Tracking Utilities
 * Provides interface for interacting with server-side usage tracking
 * Requirements: 2.1, 2.2, 2.4, 2.5
 */

class UsageTrackingClient {
  constructor(supabaseUrl, supabaseAnonKey) {
    this.supabaseUrl = supabaseUrl
    this.supabaseAnonKey = supabaseAnonKey
    this.cache = new Map()
    this.cacheTimeout = 30000 // 30 seconds
  }

  /**
   * Get current user's usage information
   */
  async getUserUsage(useCache = true) {
    const cacheKey = 'user_usage'
    
    if (useCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data
      }
    }

    try {
      const response = await this.makeRequest('usage-tracking', {
        action: 'get_usage'
      })

      if (response.success) {
        this.cache.set(cacheKey, {
          data: response,
          timestamp: Date.now()
        })
      }

      return response
    } catch (error) {
      console.error('Error getting user usage:', error)
      return {
        success: false,
        error: 'Failed to get usage information'
      }
    }
  }

  /**
   * Check if user can perform a conversion
   */
  async checkQuota() {
    try {
      const response = await this.makeRequest('usage-tracking', {
        action: 'check_quota'
      })

      return response
    } catch (error) {
      console.error('Error checking quota:', error)
      return {
        success: false,
        error: 'Failed to check quota',
        can_convert: false
      }
    }
  }

  /**
   * Process image conversion with usage tracking
   */
  async convertImage(file, conversionParams) {
    try {
      // First check quota
      const quotaCheck = await this.checkQuota()
      if (!quotaCheck.success || !quotaCheck.can_convert) {
        return {
          success: false,
          error: quotaCheck.error || 'Quota exceeded',
          quota_exceeded: true,
          remaining_quota: quotaCheck.remaining_quota
        }
      }

      // Prepare form data
      const formData = new FormData()
      formData.append('file', file)
      formData.append('params', JSON.stringify(conversionParams))

      // Make conversion request
      const response = await fetch(`${this.supabaseUrl}/functions/v1/image-conversion`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: formData
      })

      const result = await response.json()

      // Clear usage cache to force refresh
      this.cache.delete('user_usage')

      return result
    } catch (error) {
      console.error('Error converting image:', error)
      return {
        success: false,
        error: 'Failed to convert image'
      }
    }
  }

  /**
   * Get usage analytics (for admin users)
   */
  async getUsageAnalytics(startDate, endDate) {
    try {
      const response = await this.makeRequest('usage-management', {
        action: 'get_usage_analytics',
        start_date: startDate,
        end_date: endDate
      })

      return response
    } catch (error) {
      console.error('Error getting usage analytics:', error)
      return {
        success: false,
        error: 'Failed to get usage analytics'
      }
    }
  }

  /**
   * Get period information
   */
  async getPeriodInfo() {
    const cacheKey = 'period_info'
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data
      }
    }

    try {
      const response = await this.makeRequest('usage-management', {
        action: 'get_period_info'
      })

      if (response.success) {
        this.cache.set(cacheKey, {
          data: response,
          timestamp: Date.now()
        })
      }

      return response
    } catch (error) {
      console.error('Error getting period info:', error)
      return {
        success: false,
        error: 'Failed to get period information'
      }
    }
  }

  /**
   * Make authenticated request to Edge Function
   */
  async makeRequest(functionName, body) {
    const authToken = await this.getAuthToken()
    if (!authToken) {
      throw new Error('Not authenticated')
    }

    const response = await fetch(`${this.supabaseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return await response.json()
  }

  /**
   * Get current auth token
   */
  async getAuthToken() {
    // This assumes Supabase client is available globally
    if (typeof window !== 'undefined' && window.supabase) {
      const { data: { session } } = await window.supabase.auth.getSession()
      return session?.access_token
    }
    return null
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear()
  }

  /**
   * Format remaining quota for display
   */
  formatQuota(remaining, limit) {
    if (limit === -1) {
      return 'Unlimited'
    }
    
    if (remaining <= 0) {
      return '0 remaining'
    }
    
    return `${remaining} of ${limit} remaining`
  }

  /**
   * Calculate usage percentage
   */
  getUsagePercentage(used, limit) {
    if (limit === -1) {
      return 0
    }
    
    return Math.min(Math.round((used / limit) * 100), 100)
  }

  /**
   * Get usage status color
   */
  getUsageStatusColor(percentage) {
    if (percentage >= 100) return 'red'
    if (percentage >= 80) return 'orange'
    if (percentage >= 60) return 'yellow'
    return 'green'
  }

  /**
   * Check if user needs to upgrade
   */
  shouldShowUpgrade(remaining, limit) {
    if (limit === -1) return false
    return remaining <= 0 || (remaining / limit) < 0.1
  }

  /**
   * Get days until reset
   */
  getDaysUntilReset() {
    const now = new Date()
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const diffTime = nextMonth.getTime() - now.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  /**
   * Subscribe to usage updates (using polling)
   */
  subscribeToUsageUpdates(callback, interval = 60000) {
    const pollUsage = async () => {
      try {
        const usage = await this.getUserUsage(false) // Don't use cache
        callback(usage)
      } catch (error) {
        console.error('Error polling usage:', error)
      }
    }

    // Initial call
    pollUsage()

    // Set up polling
    const intervalId = setInterval(pollUsage, interval)

    // Return cleanup function
    return () => clearInterval(intervalId)
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UsageTrackingClient
} else if (typeof window !== 'undefined') {
  window.UsageTrackingClient = UsageTrackingClient
}

/**
 * Usage Tracking UI Components
 */
class UsageTrackingUI {
  constructor(client) {
    this.client = client
    this.elements = {}
  }

  /**
   * Initialize usage display elements
   */
  init(containerSelector) {
    const container = document.querySelector(containerSelector)
    if (!container) {
      console.error('Usage tracking container not found:', containerSelector)
      return
    }

    container.innerHTML = `
      <div class="usage-tracking-widget">
        <div class="usage-header">
          <h3>Usage This Month</h3>
          <button class="refresh-btn" onclick="this.refreshUsage()">↻</button>
        </div>
        <div class="usage-content">
          <div class="usage-meter">
            <div class="usage-bar">
              <div class="usage-fill" style="width: 0%"></div>
            </div>
            <div class="usage-text">Loading...</div>
          </div>
          <div class="usage-details">
            <div class="usage-remaining"></div>
            <div class="usage-reset"></div>
          </div>
        </div>
        <div class="usage-actions" style="display: none;">
          <button class="upgrade-btn">Upgrade Plan</button>
        </div>
      </div>
    `

    // Store element references
    this.elements = {
      container,
      meter: container.querySelector('.usage-meter'),
      bar: container.querySelector('.usage-fill'),
      text: container.querySelector('.usage-text'),
      remaining: container.querySelector('.usage-remaining'),
      reset: container.querySelector('.usage-reset'),
      actions: container.querySelector('.usage-actions'),
      upgradeBtn: container.querySelector('.upgrade-btn')
    }

    // Set up event listeners
    this.setupEventListeners()

    // Initial load
    this.refreshUsage()
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    if (this.elements.upgradeBtn) {
      this.elements.upgradeBtn.addEventListener('click', () => {
        this.showUpgradeModal()
      })
    }
  }

  /**
   * Refresh usage display
   */
  async refreshUsage() {
    try {
      const usage = await this.client.getUserUsage(false)
      
      if (usage.success && usage.data) {
        this.updateDisplay(usage.data)
      } else {
        this.showError(usage.error || 'Failed to load usage')
      }
    } catch (error) {
      console.error('Error refreshing usage:', error)
      this.showError('Failed to refresh usage')
    }
  }

  /**
   * Update usage display
   */
  updateDisplay(usageData) {
    const { current_usage } = usageData
    const percentage = this.client.getUsagePercentage(
      current_usage.conversions_used, 
      current_usage.conversions_limit
    )
    const color = this.client.getUsageStatusColor(percentage)

    // Update progress bar
    this.elements.bar.style.width = `${percentage}%`
    this.elements.bar.className = `usage-fill ${color}`

    // Update text
    this.elements.text.textContent = this.client.formatQuota(
      usageData.remaining_quota,
      current_usage.conversions_limit
    )

    // Update details
    this.elements.remaining.textContent = `${current_usage.conversions_used} used`
    this.elements.reset.textContent = `Resets in ${this.client.getDaysUntilReset()} days`

    // Show upgrade button if needed
    if (this.client.shouldShowUpgrade(usageData.remaining_quota, current_usage.conversions_limit)) {
      this.elements.actions.style.display = 'block'
    } else {
      this.elements.actions.style.display = 'none'
    }
  }

  /**
   * Show error state
   */
  showError(message) {
    this.elements.text.textContent = message
    this.elements.bar.style.width = '0%'
    this.elements.remaining.textContent = ''
    this.elements.reset.textContent = ''
  }

  /**
   * Show upgrade modal
   */
  showUpgradeModal() {
    // This would integrate with your existing billing/upgrade flow
    if (typeof window.showUpgradeModal === 'function') {
      window.showUpgradeModal()
    } else {
      alert('Please upgrade your plan to continue converting images.')
    }
  }
}

// Export UI class
if (typeof module !== 'undefined' && module.exports) {
  module.exports.UsageTrackingUI = UsageTrackingUI
} else if (typeof window !== 'undefined') {
  window.UsageTrackingUI = UsageTrackingUI
}