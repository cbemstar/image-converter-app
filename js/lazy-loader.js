/**
 * LazyLoader - Intelligent lazy loading system for dashboard components
 * Implements intersection observer and dynamic imports for optimal performance
 */

class LazyLoader {
  constructor(options = {}) {
    this.threshold = options.threshold || 0.1;
    this.rootMargin = options.rootMargin || '50px';
    this.loadingClass = options.loadingClass || 'lazy-loading';
    this.loadedClass = options.loadedClass || 'lazy-loaded';
    this.errorClass = options.errorClass || 'lazy-error';
    
    // Component registry for dynamic loading
    this.componentRegistry = new Map();
    this.loadedComponents = new Set();
    this.loadingComponents = new Set();
    
    // Performance tracking
    this.loadTimes = new Map();
    this.stats = {
      componentsLoaded: 0,
      totalLoadTime: 0,
      errors: 0
    };
    
    // Initialize intersection observer
    this.initializeObserver();
    
    console.log('LazyLoader initialized');
  }

  /**
   * Initialize intersection observer for viewport-based loading
   */
  initializeObserver() {
    if (!('IntersectionObserver' in window)) {
      console.warn('IntersectionObserver not supported, falling back to immediate loading');
      this.fallbackToImmediateLoading();
      return;
    }

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.loadComponent(entry.target);
        }
      });
    }, {
      threshold: this.threshold,
      rootMargin: this.rootMargin
    });
  }

  /**
   * Register a component for lazy loading
   */
  registerComponent(selector, loader, options = {}) {
    const config = {
      loader,
      priority: options.priority || 'normal', // high, normal, low
      dependencies: options.dependencies || [],
      retryCount: options.retryCount || 3,
      timeout: options.timeout || 10000,
      cache: options.cache !== false,
      ...options
    };

    this.componentRegistry.set(selector, config);
    
    // Start observing elements immediately if they exist
    const elements = document.querySelectorAll(selector);
    elements.forEach(element => {
      if (!element.dataset.lazyRegistered) {
        this.observeElement(element, selector);
        element.dataset.lazyRegistered = 'true';
      }
    });

    return this;
  }

  /**
   * Observe element for lazy loading
   */
  observeElement(element, selector) {
    element.dataset.lazySelector = selector;
    element.classList.add('lazy-component');
    
    // Add loading placeholder if not present
    if (!element.querySelector('.lazy-placeholder')) {
      this.addLoadingPlaceholder(element);
    }
    
    if (this.observer) {
      this.observer.observe(element);
    } else {
      // Fallback for browsers without IntersectionObserver
      this.loadComponent(element);
    }
  }

  /**
   * Add loading placeholder to element
   */
  addLoadingPlaceholder(element) {
    const placeholder = document.createElement('div');
    placeholder.className = 'lazy-placeholder';
    placeholder.innerHTML = `
      <div class="lazy-skeleton">
        <div class="lazy-skeleton-header"></div>
        <div class="lazy-skeleton-content">
          <div class="lazy-skeleton-line"></div>
          <div class="lazy-skeleton-line"></div>
          <div class="lazy-skeleton-line short"></div>
        </div>
      </div>
    `;
    
    // Add skeleton styles if not present
    this.addSkeletonStyles();
    
    element.appendChild(placeholder);
  }

  /**
   * Add skeleton loading styles
   */
  addSkeletonStyles() {
    if (document.getElementById('lazySkeletonStyles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'lazySkeletonStyles';
    styles.textContent = `
      .lazy-component {
        min-height: 100px;
        position: relative;
      }
      
      .lazy-placeholder {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.8);
        backdrop-filter: blur(2px);
      }
      
      .lazy-skeleton {
        width: 100%;
        max-width: 300px;
        padding: 20px;
      }
      
      .lazy-skeleton-header {
        height: 24px;
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: lazy-shimmer 1.5s infinite;
        border-radius: 4px;
        margin-bottom: 16px;
      }
      
      .lazy-skeleton-content {
        space-y: 8px;
      }
      
      .lazy-skeleton-line {
        height: 16px;
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: lazy-shimmer 1.5s infinite;
        border-radius: 4px;
        margin-bottom: 8px;
      }
      
      .lazy-skeleton-line.short {
        width: 60%;
      }
      
      @keyframes lazy-shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      
      .lazy-loading {
        opacity: 0.7;
        pointer-events: none;
      }
      
      .lazy-loaded {
        opacity: 1;
        transition: opacity 0.3s ease;
      }
      
      .lazy-error {
        background: #fee2e2;
        border: 1px solid #fecaca;
        color: #dc2626;
        padding: 16px;
        border-radius: 8px;
        text-align: center;
      }
    `;
    
    document.head.appendChild(styles);
  }

  /**
   * Load component when it becomes visible
   */
  async loadComponent(element) {
    const selector = element.dataset.lazySelector;
    const config = this.componentRegistry.get(selector);
    
    if (!config || this.loadingComponents.has(element) || this.loadedComponents.has(element)) {
      return;
    }

    this.loadingComponents.add(element);
    element.classList.add(this.loadingClass);
    
    const startTime = performance.now();
    
    try {
      // Check dependencies first
      await this.loadDependencies(config.dependencies);
      
      // Load component with timeout
      const result = await this.loadWithTimeout(config.loader, element, config.timeout);
      
      // Remove placeholder
      const placeholder = element.querySelector('.lazy-placeholder');
      if (placeholder) {
        placeholder.remove();
      }
      
      // Mark as loaded
      this.loadedComponents.add(element);
      element.classList.remove(this.loadingClass);
      element.classList.add(this.loadedClass);
      
      // Stop observing
      if (this.observer) {
        this.observer.unobserve(element);
      }
      
      // Track performance
      const loadTime = performance.now() - startTime;
      this.loadTimes.set(selector, loadTime);
      this.stats.componentsLoaded++;
      this.stats.totalLoadTime += loadTime;
      
      console.log(`Lazy loaded component ${selector} in ${loadTime.toFixed(2)}ms`);
      
      // Dispatch loaded event
      element.dispatchEvent(new CustomEvent('lazyLoaded', {
        detail: { selector, loadTime, result }
      }));
      
    } catch (error) {
      console.error(`Failed to lazy load component ${selector}:`, error);
      
      this.handleLoadError(element, error, config);
      this.stats.errors++;
      
    } finally {
      this.loadingComponents.delete(element);
    }
  }

  /**
   * Load component with timeout
   */
  loadWithTimeout(loader, element, timeout) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Component load timeout after ${timeout}ms`));
      }, timeout);
      
      Promise.resolve(loader(element))
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Load component dependencies
   */
  async loadDependencies(dependencies) {
    if (!dependencies || dependencies.length === 0) return;
    
    const loadPromises = dependencies.map(dep => {
      if (typeof dep === 'string') {
        // Load script dependency
        return this.loadScript(dep);
      } else if (typeof dep === 'function') {
        // Execute function dependency
        return Promise.resolve(dep());
      } else if (dep.type === 'css') {
        // Load CSS dependency
        return this.loadCSS(dep.url);
      } else if (dep.type === 'module') {
        // Load ES module
        return import(dep.url);
      }
      return Promise.resolve();
    });
    
    await Promise.all(loadPromises);
  }

  /**
   * Load external script
   */
  loadScript(src) {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Load external CSS
   */
  loadCSS(href) {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (document.querySelector(`link[href="${href}"]`)) {
        resolve();
        return;
      }
      
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = resolve;
      link.onerror = reject;
      document.head.appendChild(link);
    });
  }

  /**
   * Handle component load error
   */
  handleLoadError(element, error, config) {
    // Remove loading state
    element.classList.remove(this.loadingClass);
    element.classList.add(this.errorClass);
    
    // Show error message
    const placeholder = element.querySelector('.lazy-placeholder');
    if (placeholder) {
      placeholder.innerHTML = `
        <div class="lazy-error-content">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Failed to load component</p>
          <button class="lazy-retry-btn" onclick="window.lazyLoader.retryComponent('${element.dataset.lazySelector}', this.closest('.lazy-component'))">
            Retry
          </button>
        </div>
      `;
    }
    
    // Dispatch error event
    element.dispatchEvent(new CustomEvent('lazyLoadError', {
      detail: { error, config }
    }));
  }

  /**
   * Retry loading a failed component
   */
  async retryComponent(selector, element) {
    element.classList.remove(this.errorClass);
    this.loadedComponents.delete(element);
    await this.loadComponent(element);
  }

  /**
   * Preload high-priority components
   */
  preloadHighPriority() {
    const highPriorityComponents = Array.from(this.componentRegistry.entries())
      .filter(([_, config]) => config.priority === 'high');
    
    highPriorityComponents.forEach(([selector, _]) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        if (!this.loadedComponents.has(element) && !this.loadingComponents.has(element)) {
          this.loadComponent(element);
        }
      });
    });
  }

  /**
   * Load all visible components immediately
   */
  loadAllVisible() {
    const visibleElements = document.querySelectorAll('.lazy-component');
    visibleElements.forEach(element => {
      const rect = element.getBoundingClientRect();
      const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
      
      if (isVisible && !this.loadedComponents.has(element) && !this.loadingComponents.has(element)) {
        this.loadComponent(element);
      }
    });
  }

  /**
   * Fallback for browsers without IntersectionObserver
   */
  fallbackToImmediateLoading() {
    // Load all components immediately
    setTimeout(() => {
      const lazyElements = document.querySelectorAll('.lazy-component');
      lazyElements.forEach(element => {
        this.loadComponent(element);
      });
    }, 100);
  }

  /**
   * Get loading statistics
   */
  getStats() {
    const avgLoadTime = this.stats.componentsLoaded > 0 
      ? (this.stats.totalLoadTime / this.stats.componentsLoaded).toFixed(2)
      : 0;
    
    return {
      ...this.stats,
      averageLoadTime: `${avgLoadTime}ms`,
      loadedComponents: this.loadedComponents.size,
      registeredComponents: this.componentRegistry.size,
      successRate: this.stats.componentsLoaded > 0 
        ? `${((this.stats.componentsLoaded / (this.stats.componentsLoaded + this.stats.errors)) * 100).toFixed(2)}%`
        : '0%'
    };
  }

  /**
   * Destroy lazy loader
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    
    this.componentRegistry.clear();
    this.loadedComponents.clear();
    this.loadingComponents.clear();
    this.loadTimes.clear();
  }
}

/**
 * Dashboard-specific lazy loading configurations
 */
class DashboardLazyLoader extends LazyLoader {
  constructor() {
    super({
      threshold: 0.1,
      rootMargin: '100px' // Load dashboard components a bit earlier
    });
    
    this.registerDashboardComponents();
  }

  /**
   * Register dashboard-specific components
   */
  registerDashboardComponents() {
    // Usage meters - high priority
    this.registerComponent('.usage-meters', async (element) => {
      if (window.quotaManager) {
        const usage = window.quotaManager.getCurrentUsage();
        this.renderUsageMeters(element, usage);
      }
    }, { priority: 'high' });

    // Recent activity - normal priority
    this.registerComponent('.recent-activity', async (element) => {
      await this.loadRecentActivity(element);
    }, { priority: 'normal' });

    // Quick actions - low priority
    this.registerComponent('.quick-actions', async (element) => {
      this.enhanceQuickActions(element);
    }, { priority: 'low' });

    // File manager - load on demand
    this.registerComponent('.file-manager', async (element) => {
      await this.loadFileManager(element);
    }, { 
      priority: 'low',
      dependencies: ['/js/file-manager.js']
    });

    // Analytics charts - load on demand
    this.registerComponent('.analytics-charts', async (element) => {
      await this.loadAnalyticsCharts(element);
    }, { 
      priority: 'low',
      dependencies: [
        { type: 'css', url: 'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.css' },
        'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js'
      ]
    });
  }

  /**
   * Render usage meters
   */
  renderUsageMeters(element, usage) {
    const metersHTML = `
      <div class="usage-meter-grid">
        ${this.createUsageMeter('storage', usage.storage)}
        ${this.createUsageMeter('conversions', usage.conversions)}
        ${this.createUsageMeter('apiCalls', usage.apiCalls)}
      </div>
    `;
    
    element.innerHTML = metersHTML;
  }

  /**
   * Create individual usage meter
   */
  createUsageMeter(type, data) {
    if (!data) return '';
    
    const percentage = Math.min(100, data.percentage || 0);
    const colorClass = percentage >= 95 ? 'danger' : percentage >= 85 ? 'warning' : 'success';
    
    return `
      <div class="usage-meter" data-type="${type}">
        <div class="usage-meter-header">
          <h4>${this.formatMeterTitle(type)}</h4>
          <span class="usage-percentage">${percentage.toFixed(1)}%</span>
        </div>
        <div class="usage-meter-bar">
          <div class="usage-meter-fill usage-meter-${colorClass}" style="width: ${percentage}%"></div>
        </div>
        <div class="usage-meter-details">
          <span class="usage-current">${this.formatUsageValue(type, data.current)}</span>
          <span class="usage-limit">/ ${this.formatUsageValue(type, data.limit)}</span>
        </div>
      </div>
    `;
  }

  /**
   * Format meter title
   */
  formatMeterTitle(type) {
    const titles = {
      storage: 'Storage Used',
      conversions: 'Conversions',
      apiCalls: 'API Calls'
    };
    return titles[type] || type;
  }

  /**
   * Format usage value for display
   */
  formatUsageValue(type, value) {
    if (type === 'storage') {
      return this.formatBytes(value);
    }
    return new Intl.NumberFormat().format(value);
  }

  /**
   * Format bytes for display
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Load recent activity
   */
  async loadRecentActivity(element) {
    try {
      // Simulate loading recent activity
      // In real implementation, this would fetch from the database
      const activities = [
        {
          type: 'conversion',
          tool: 'Image Converter',
          time: new Date(Date.now() - 5 * 60 * 1000),
          status: 'success'
        },
        {
          type: 'upload',
          tool: 'PDF Merger',
          time: new Date(Date.now() - 15 * 60 * 1000),
          status: 'success'
        }
      ];
      
      const activitiesHTML = activities.map(activity => `
        <div class="activity-item">
          <div class="activity-icon activity-${activity.status}">
            <i class="fas fa-${this.getActivityIcon(activity.type)}"></i>
          </div>
          <div class="activity-content">
            <div class="activity-title">${activity.tool}</div>
            <div class="activity-time">${this.formatRelativeTime(activity.time)}</div>
          </div>
        </div>
      `).join('');
      
      element.innerHTML = `
        <div class="recent-activity-list">
          ${activitiesHTML}
        </div>
      `;
      
    } catch (error) {
      console.error('Error loading recent activity:', error);
      element.innerHTML = '<p class="error-message">Failed to load recent activity</p>';
    }
  }

  /**
   * Get activity icon
   */
  getActivityIcon(type) {
    const icons = {
      conversion: 'exchange-alt',
      upload: 'upload',
      download: 'download',
      share: 'share'
    };
    return icons[type] || 'circle';
  }

  /**
   * Format relative time
   */
  formatRelativeTime(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  /**
   * Enhance quick actions
   */
  enhanceQuickActions(element) {
    const actions = element.querySelectorAll('.quick-action');
    actions.forEach(action => {
      // Add click tracking
      action.addEventListener('click', (e) => {
        if (window.analyticsManager) {
          const toolName = action.href.split('/').pop().replace('.html', '');
          window.analyticsManager.trackInteraction('quick_action', 'click', {
            tool: toolName,
            source: 'dashboard_lazy'
          });
        }
      });
      
      // Add hover effects
      action.addEventListener('mouseenter', () => {
        action.style.transform = 'translateY(-2px)';
      });
      
      action.addEventListener('mouseleave', () => {
        action.style.transform = 'translateY(0)';
      });
    });
  }

  /**
   * Load file manager component
   */
  async loadFileManager(element) {
    if (!window.fileManager) {
      throw new Error('FileManager not available');
    }
    
    const files = await window.fileManager.listUserFiles();
    
    const filesHTML = files.map(file => `
      <div class="file-item">
        <div class="file-icon">
          <i class="fas fa-${this.getFileIcon(file.file_type)}"></i>
        </div>
        <div class="file-info">
          <div class="file-name">${file.filename}</div>
          <div class="file-size">${this.formatBytes(file.file_size)}</div>
        </div>
        <div class="file-actions">
          <button onclick="window.fileManager.downloadFile('${file.id}')">
            <i class="fas fa-download"></i>
          </button>
        </div>
      </div>
    `).join('');
    
    element.innerHTML = `
      <div class="file-manager-content">
        <div class="file-list">
          ${filesHTML}
        </div>
      </div>
    `;
  }

  /**
   * Get file icon based on type
   */
  getFileIcon(fileType) {
    const icons = {
      'image/': 'image',
      'application/pdf': 'file-pdf',
      'text/': 'file-text',
      'application/zip': 'file-archive'
    };
    
    for (const [type, icon] of Object.entries(icons)) {
      if (fileType.startsWith(type)) {
        return icon;
      }
    }
    
    return 'file';
  }

  /**
   * Load analytics charts
   */
  async loadAnalyticsCharts(element) {
    if (typeof Chart === 'undefined') {
      throw new Error('Chart.js not loaded');
    }
    
    // Create canvas for chart
    const canvas = document.createElement('canvas');
    canvas.id = 'usageChart';
    element.appendChild(canvas);
    
    // Sample data - in real implementation, fetch from analytics
    const data = {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{
        label: 'Conversions',
        data: [12, 19, 3, 5, 2, 3, 9],
        borderColor: '#3b82f6',
        backgroundColor: '#3b82f633'
      }]
    };
    
    new Chart(canvas, {
      type: 'line',
      data: data,
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Weekly Usage'
          }
        }
      }
    });
  }
}

// Create global lazy loader instance
if (typeof window !== 'undefined') {
  window.lazyLoader = new DashboardLazyLoader();
  
  // Auto-preload high priority components when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.lazyLoader.preloadHighPriority();
    });
  } else {
    window.lazyLoader.preloadHighPriority();
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LazyLoader, DashboardLazyLoader };
}