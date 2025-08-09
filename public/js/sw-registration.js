/**
 * Service Worker Registration
 * Handles service worker registration and updates
 */

class ServiceWorkerManager {
  constructor() {
    this.registration = null;
    this.isUpdateAvailable = false;
    
    this.initialize();
  }

  /**
   * Initialize service worker registration
   */
  async initialize() {
    if (!('serviceWorker' in navigator)) {
      console.log('Service Worker not supported');
      return;
    }

    try {
      // Register service worker
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('Service Worker registered successfully');

      // Listen for updates
      this.registration.addEventListener('updatefound', () => {
        this.handleUpdateFound();
      });

      // Check for existing service worker
      if (this.registration.active) {
        console.log('Service Worker is active');
      }

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.handleServiceWorkerMessage(event);
      });

      // Check for updates periodically
      this.checkForUpdates();

    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }

  /**
   * Handle service worker update found
   */
  handleUpdateFound() {
    const newWorker = this.registration.installing;
    
    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        // New service worker installed, show update notification
        this.isUpdateAvailable = true;
        this.showUpdateNotification();
      }
    });
  }

  /**
   * Handle messages from service worker
   */
  handleServiceWorkerMessage(event) {
    const { type, data } = event.data;
    
    switch (type) {
      case 'CACHE_UPDATED':
        console.log('Cache updated:', data);
        break;
      case 'OFFLINE_READY':
        this.showOfflineReadyNotification();
        break;
      case 'UPDATE_AVAILABLE':
        this.showUpdateNotification();
        break;
    }
  }

  /**
   * Show update notification
   */
  showUpdateNotification() {
    // Try to use existing notification system
    if (window.showToast) {
      window.showToast(
        'A new version is available. Refresh to update.',
        'info',
        {
          duration: 0, // Don't auto-dismiss
          action: {
            text: 'Refresh',
            callback: () => this.applyUpdate()
          }
        }
      );
    } else {
      // Fallback notification
      this.showUpdateBanner();
    }
  }

  /**
   * Show update banner (fallback)
   */
  showUpdateBanner() {
    // Remove existing banner
    const existingBanner = document.getElementById('sw-update-banner');
    if (existingBanner) {
      existingBanner.remove();
    }

    const banner = document.createElement('div');
    banner.id = 'sw-update-banner';
    banner.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #3b82f6;
        color: white;
        padding: 12px;
        text-align: center;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      ">
        <span>A new version is available!</span>
        <button onclick="window.swManager.applyUpdate()" style="
          background: white;
          color: #3b82f6;
          border: none;
          padding: 6px 12px;
          margin-left: 12px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
        ">
          Refresh Now
        </button>
        <button onclick="this.parentElement.parentElement.remove()" style="
          background: transparent;
          color: white;
          border: 1px solid rgba(255,255,255,0.3);
          padding: 6px 12px;
          margin-left: 8px;
          border-radius: 4px;
          cursor: pointer;
        ">
          Later
        </button>
      </div>
    `;

    document.body.appendChild(banner);
  }

  /**
   * Show offline ready notification
   */
  showOfflineReadyNotification() {
    if (window.showToast) {
      window.showToast(
        'App is ready to work offline!',
        'success',
        { duration: 3000 }
      );
    } else {
      console.log('App is ready to work offline!');
    }
  }

  /**
   * Apply service worker update
   */
  async applyUpdate() {
    if (!this.registration || !this.registration.waiting) {
      // No update waiting, just reload
      window.location.reload();
      return;
    }

    // Tell the waiting service worker to skip waiting
    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    // Reload the page when the new service worker takes control
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }

  /**
   * Check for service worker updates
   */
  async checkForUpdates() {
    if (!this.registration) return;

    try {
      await this.registration.update();
    } catch (error) {
      console.error('Failed to check for service worker updates:', error);
    }

    // Check again in 1 hour
    setTimeout(() => {
      this.checkForUpdates();
    }, 60 * 60 * 1000);
  }

  /**
   * Get service worker status
   */
  getStatus() {
    if (!('serviceWorker' in navigator)) {
      return 'not_supported';
    }

    if (!this.registration) {
      return 'not_registered';
    }

    if (this.registration.active) {
      return this.isUpdateAvailable ? 'update_available' : 'active';
    }

    if (this.registration.installing) {
      return 'installing';
    }

    return 'registered';
  }

  /**
   * Unregister service worker (for debugging)
   */
  async unregister() {
    if (!this.registration) return false;

    try {
      const result = await this.registration.unregister();
      console.log('Service Worker unregistered:', result);
      return result;
    } catch (error) {
      console.error('Failed to unregister service worker:', error);
      return false;
    }
  }
}

// Initialize service worker manager
if (typeof window !== 'undefined') {
  window.swManager = new ServiceWorkerManager();
  
  // Add online/offline event listeners
  window.addEventListener('online', () => {
    console.log('Connection restored');
    
    // Remove offline indicator if present
    const offlineIndicator = document.querySelector('.offline-indicator');
    if (offlineIndicator) {
      offlineIndicator.remove();
    }
    
    // Show online notification
    if (window.showToast) {
      window.showToast('Connection restored', 'success', { duration: 2000 });
    }
  });

  window.addEventListener('offline', () => {
    console.log('Connection lost');
    
    // Show offline indicator
    const indicator = document.createElement('div');
    indicator.className = 'offline-indicator';
    indicator.innerHTML = `
      <i class="fas fa-wifi" style="margin-right: 8px;"></i>
      You're offline - Some features may be limited
    `;
    indicator.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #f59e0b;
      color: white;
      text-align: center;
      padding: 8px;
      font-size: 14px;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    document.body.appendChild(indicator);
    
    // Show offline notification
    if (window.showToast) {
      window.showToast('You are now offline', 'warning', { duration: 3000 });
    }
  });
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ServiceWorkerManager;
}