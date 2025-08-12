/**
 * Client-side Rate Limiting Handler
 * Handles rate limit responses and implements exponential backoff
 * Requirements: 10.1, 10.2, 10.3
 */

class RateLimitHandler {
  constructor() {
    this.backoffTimers = new Map()
    this.rateLimitInfo = new Map()
  }

  /**
   * Handle a rate limit response from the server
   */
  handleRateLimitResponse(response, endpoint = 'general') {
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60')
      const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '0')
      const resetTime = response.headers.get('X-RateLimit-Reset')

      this.rateLimitInfo.set(endpoint, {
        retryAfter,
        remaining,
        resetTime: resetTime ? new Date(resetTime) : new Date(Date.now() + retryAfter * 1000),
        timestamp: Date.now()
      })

      // Show user-friendly error message
      this.showRateLimitError(endpoint, retryAfter)

      return {
        isRateLimited: true,
        retryAfter,
        remaining,
        resetTime
      }
    }

    // Clear any existing rate limit info for this endpoint
    this.rateLimitInfo.delete(endpoint)
    this.clearBackoffTimer(endpoint)

    return {
      isRateLimited: false
    }
  }

  /**
   * Check if an endpoint is currently rate limited
   */
  isRateLimited(endpoint = 'general') {
    const info = this.rateLimitInfo.get(endpoint)
    if (!info) return false

    const now = Date.now()
    const timeSinceLimit = (now - info.timestamp) / 1000

    // Check if enough time has passed
    if (timeSinceLimit >= info.retryAfter) {
      this.rateLimitInfo.delete(endpoint)
      return false
    }

    return true
  }

  /**
   * Get remaining time until rate limit resets
   */
  getTimeUntilReset(endpoint = 'general') {
    const info = this.rateLimitInfo.get(endpoint)
    if (!info) return 0

    const now = Date.now()
    const timeSinceLimit = (now - info.timestamp) / 1000
    return Math.max(0, info.retryAfter - timeSinceLimit)
  }

  /**
   * Show rate limit error to user
   */
  showRateLimitError(endpoint, retryAfter) {
    const message = this.getRateLimitMessage(endpoint, retryAfter)
    
    // Try to show in existing notification system
    if (window.showNotification) {
      window.showNotification(message, 'warning', retryAfter * 1000)
    } else if (window.showToast) {
      window.showToast(message, 'warning')
    } else {
      // Fallback to alert
      console.warn('Rate limit exceeded:', message)
      
      // Create a temporary notification element
      this.showTemporaryNotification(message, retryAfter)
    }
  }

  /**
   * Get user-friendly rate limit message
   */
  getRateLimitMessage(endpoint, retryAfter) {
    const minutes = Math.ceil(retryAfter / 60)
    
    switch (endpoint) {
      case 'conversion':
        return `You've reached the conversion limit. Please wait ${minutes} minute${minutes > 1 ? 's' : ''} before trying again, or upgrade your plan for higher limits.`
      case 'usage_tracking':
        return `Too many requests. Please wait ${minutes} minute${minutes > 1 ? 's' : ''} before trying again.`
      default:
        return `Rate limit exceeded. Please wait ${minutes} minute${minutes > 1 ? 's' : ''} before trying again.`
    }
  }

  /**
   * Show temporary notification element
   */
  showTemporaryNotification(message, duration) {
    // Remove any existing rate limit notification
    const existing = document.getElementById('rate-limit-notification')
    if (existing) {
      existing.remove()
    }

    // Create notification element
    const notification = document.createElement('div')
    notification.id = 'rate-limit-notification'
    notification.className = 'rate-limit-notification'
    notification.innerHTML = `
      <div class="rate-limit-content">
        <div class="rate-limit-icon">⚠️</div>
        <div class="rate-limit-message">${message}</div>
        <div class="rate-limit-countdown" id="rate-limit-countdown"></div>
        <button class="rate-limit-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `

    // Add styles
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      max-width: 400px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `

    const contentStyle = `
      display: flex;
      align-items: flex-start;
      gap: 12px;
    `

    const iconStyle = `
      font-size: 20px;
      flex-shrink: 0;
    `

    const messageStyle = `
      flex: 1;
      color: #856404;
      font-size: 14px;
      line-height: 1.4;
    `

    const countdownStyle = `
      color: #856404;
      font-size: 12px;
      margin-top: 8px;
      font-weight: 500;
    `

    const closeStyle = `
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      color: #856404;
      padding: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    `

    // Apply styles
    notification.querySelector('.rate-limit-content').style.cssText = contentStyle
    notification.querySelector('.rate-limit-icon').style.cssText = iconStyle
    notification.querySelector('.rate-limit-message').style.cssText = messageStyle
    notification.querySelector('.rate-limit-countdown').style.cssText = countdownStyle
    notification.querySelector('.rate-limit-close').style.cssText = closeStyle

    document.body.appendChild(notification)

    // Start countdown
    this.startCountdown(duration)

    // Auto-remove after duration
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove()
      }
    }, duration * 1000)
  }

  /**
   * Start countdown display
   */
  startCountdown(totalSeconds) {
    const countdownElement = document.getElementById('rate-limit-countdown')
    if (!countdownElement) return

    let remaining = totalSeconds

    const updateCountdown = () => {
      if (remaining <= 0) {
        countdownElement.textContent = 'You can try again now'
        return
      }

      const minutes = Math.floor(remaining / 60)
      const seconds = remaining % 60

      if (minutes > 0) {
        countdownElement.textContent = `Try again in ${minutes}:${seconds.toString().padStart(2, '0')}`
      } else {
        countdownElement.textContent = `Try again in ${seconds} seconds`
      }

      remaining--
      setTimeout(updateCountdown, 1000)
    }

    updateCountdown()
  }

  /**
   * Clear backoff timer for endpoint
   */
  clearBackoffTimer(endpoint) {
    const timer = this.backoffTimers.get(endpoint)
    if (timer) {
      clearTimeout(timer)
      this.backoffTimers.delete(endpoint)
    }
  }

  /**
   * Implement exponential backoff for retries
   */
  async retryWithBackoff(fn, endpoint = 'general', maxRetries = 3) {
    let attempt = 0
    let delay = 1000 // Start with 1 second

    while (attempt < maxRetries) {
      try {
        // Check if we're currently rate limited
        if (this.isRateLimited(endpoint)) {
          const waitTime = this.getTimeUntilReset(endpoint)
          if (waitTime > 0) {
            await this.sleep(waitTime * 1000)
          }
        }

        const result = await fn()
        
        // Handle rate limit response
        if (result && result.status === 429) {
          this.handleRateLimitResponse(result, endpoint)
          
          if (attempt === maxRetries - 1) {
            throw new Error('Max retries exceeded due to rate limiting')
          }
          
          // Wait for the specified retry-after time
          const retryAfter = parseInt(result.headers.get('Retry-After') || '60')
          await this.sleep(retryAfter * 1000)
        } else {
          return result
        }

      } catch (error) {
        if (attempt === maxRetries - 1) {
          throw error
        }

        // Exponential backoff
        await this.sleep(delay)
        delay *= 2
      }

      attempt++
    }

    throw new Error('Max retries exceeded')
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get rate limit info for debugging
   */
  getRateLimitInfo(endpoint = 'general') {
    return this.rateLimitInfo.get(endpoint)
  }

  /**
   * Clear all rate limit info
   */
  clearAll() {
    this.rateLimitInfo.clear()
    this.backoffTimers.forEach(timer => clearTimeout(timer))
    this.backoffTimers.clear()
  }
}

// Create global instance
window.rateLimitHandler = new RateLimitHandler()

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RateLimitHandler
}

console.log('Rate limit handler loaded')