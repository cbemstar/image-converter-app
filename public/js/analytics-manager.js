/**
 * AnalyticsManager - Comprehensive usage analytics and tracking system
 * Tracks user behavior, tool usage, and generates insights with privacy compliance
 */

class AnalyticsManager {
  constructor(authManager, supabaseClient) {
    this.authManager = authManager || window.authManager;
    this.supabase = supabaseClient?.getClient() || window.supabaseClient?.getClient();
    
    this.analyticsListeners = [];
    this.sessionData = {
      sessionId: this.generateSessionId(),
      startTime: Date.now(),
      events: [],
      toolsUsed: new Set(),
      filesProcessed: 0
    };
    
    this.batchQueue = [];
    this.batchSize = 10;
    this.batchTimeout = 30000; // 30 seconds
    this.batchTimer = null;
    
    this.isInitialized = false;
    this.privacySettings = {
      trackingEnabled: true,
      anonymizeData: false,
      retentionDays: 90
    };
    
    this.initialize();
  }

  /**
   * Initialize the analytics manager
   */
  async initialize() {
    try {
      if (!this.supabase) {
        console.error('AnalyticsManager: Supabase client not available');
        return;
      }

      // Load privacy settings
      await this.loadPrivacySettings();

      // Listen for auth state changes
      if (this.authManager) {
        this.authManager.addAuthStateListener((event, session) => {
          this.handleAuthStateChange(event, session);
        });
      }

      // Track page view
      this.trackPageView();
      
      // Set up periodic session updates
      this.setupSessionTracking();
      
      // Set up batch processing
      this.setupBatchProcessing();
      
      // Track page unload
      this.setupUnloadTracking();

      this.isInitialized = true;
      console.log('AnalyticsManager initialized successfully');
      
    } catch (error) {
      console.error('AnalyticsManager initialization error:', error);
    }
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load privacy settings
   */
  async loadPrivacySettings() {
    try {
      const user = this.authManager?.getCurrentUser();
      if (!user) return;

      const { data, error } = await this.supabase
        .from('user_preferences')
        .select('analytics_enabled, data_retention_days')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading privacy settings:', error);
        return;
      }

      if (data) {
        this.privacySettings.trackingEnabled = data.analytics_enabled !== false;
        this.privacySettings.retentionDays = data.data_retention_days || 90;
      }

    } catch (error) {
      console.error('Error loading privacy settings:', error);
    }
  }

  /**
   * Handle authentication state changes
   */
  handleAuthStateChange(event, session) {
    if (!this.privacySettings.trackingEnabled) return;

    switch (event) {
      case 'SIGNED_IN':
        this.trackEvent('user_signed_in', {
          user_id: session.user.id,
          provider: session.user.app_metadata?.provider || 'email'
        });
        break;
      case 'SIGNED_OUT':
        this.trackEvent('user_signed_out');
        this.flushBatch(); // Send any pending analytics before sign out
        break;
    }
  }

  /**
   * Track page view
   */
  trackPageView() {
    if (!this.privacySettings.trackingEnabled) return;

    const pageData = {
      url: this.privacySettings.anonymizeData ? this.anonymizeUrl(window.location.href) : window.location.href,
      path: window.location.pathname,
      title: document.title,
      referrer: this.privacySettings.anonymizeData ? '' : document.referrer,
      user_agent: this.privacySettings.anonymizeData ? this.anonymizeUserAgent(navigator.userAgent) : navigator.userAgent,
      screen_resolution: `${screen.width}x${screen.height}`,
      viewport_size: `${window.innerWidth}x${window.innerHeight}`,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };

    this.trackEvent('page_view', pageData);
  }

  /**
   * Track tool usage
   */
  trackToolUsage(toolType, action, metadata = {}) {
    if (!this.privacySettings.trackingEnabled) return;

    const eventData = {
      tool_type: toolType,
      action_type: action,
      metadata: {
        ...metadata,
        session_id: this.sessionData.sessionId,
        timestamp: Date.now()
      }
    };

    // Remove sensitive data if anonymization is enabled
    if (this.privacySettings.anonymizeData) {
      delete eventData.metadata.filename;
      delete eventData.metadata.file_path;
    }

    // Update session data
    this.sessionData.toolsUsed.add(toolType);
    if (action === 'conversion_completed') {
      this.sessionData.filesProcessed++;
    }

    this.trackEvent('tool_usage', eventData);
    
    // Also store in usage_analytics table for quota tracking
    this.storeUsageAnalytics(toolType, action, metadata.file_size);
  }

  /**
   * Track file operations
   */
  trackFileOperation(operation, fileData = {}) {
    if (!this.privacySettings.trackingEnabled) return;

    const eventData = {
      operation: operation, // 'upload', 'download', 'delete', 'share'
      file_type: fileData.file_type,
      file_size: fileData.file_size,
      tool_type: fileData.tool_type,
      metadata: {
        session_id: this.sessionData.sessionId
      }
    };

    // Add filename only if not anonymizing
    if (!this.privacySettings.anonymizeData && fileData.filename) {
      eventData.metadata.filename = fileData.filename;
    }

    this.trackEvent('file_operation', eventData);
  }

  /**
   * Track user interactions
   */
  trackInteraction(element, action, metadata = {}) {
    if (!this.privacySettings.trackingEnabled) return;

    const eventData = {
      element: element,
      action: action,
      metadata: {
        ...metadata,
        page: window.location.pathname,
        session_id: this.sessionData.sessionId
      }
    };

    this.trackEvent('user_interaction', eventData);
  }

  /**
   * Track errors with privacy compliance
   */
  trackError(error, context = {}) {
    if (!this.privacySettings.trackingEnabled) return;

    const eventData = {
      error_message: error.message || error,
      error_type: error.name || 'Error',
      context: {
        ...context,
        url: this.privacySettings.anonymizeData ? this.anonymizeUrl(window.location.href) : window.location.href,
        session_id: this.sessionData.sessionId
      }
    };

    // Don't include stack trace if anonymizing
    if (!this.privacySettings.anonymizeData && error.stack) {
      eventData.error_stack = error.stack;
    }

    this.trackEvent('error', eventData);
  }

  /**
   * Track performance metrics
   */
  trackPerformance(metric, value, metadata = {}) {
    if (!this.privacySettings.trackingEnabled) return;

    const eventData = {
      metric: metric,
      value: value,
      metadata: {
        ...metadata,
        session_id: this.sessionData.sessionId,
        timestamp: Date.now()
      }
    };

    this.trackEvent('performance', eventData);
  }

  /**
   * Track conversion funnel
   */
  trackFunnelStep(funnel, step, metadata = {}) {
    if (!this.privacySettings.trackingEnabled) return;

    const eventData = {
      funnel: funnel,
      step: step,
      metadata: {
        ...metadata,
        session_id: this.sessionData.sessionId
      }
    };

    this.trackEvent('funnel_step', eventData);
  }

  /**
   * Generic event tracking
   */
  trackEvent(eventType, eventData = {}) {
    if (!this.privacySettings.trackingEnabled) return;

    const event = {
      event_type: eventType,
      event_data: eventData,
      user_id: this.authManager?.getCurrentUser()?.id || null,
      session_id: this.sessionData.sessionId,
      timestamp: new Date().toISOString(),
      url: this.privacySettings.anonymizeData ? this.anonymizeUrl(window.location.href) : window.location.href
    };

    // Add to session events
    this.sessionData.events.push(event);
    
    // Add to batch queue
    this.batchQueue.push(event);
    
    // Process batch if it's full
    if (this.batchQueue.length >= this.batchSize) {
      this.flushBatch();
    }

    // Notify listeners
    this.notifyAnalyticsListeners('event_tracked', event);
  }

  /**
   * Store usage analytics for quota tracking
   */
  async storeUsageAnalytics(toolType, actionType, fileSize = null) {
    try {
      const user = this.authManager?.getCurrentUser();
      if (!user) return;

      const analyticsData = {
        user_id: user.id,
        tool_type: toolType,
        action_type: actionType,
        file_size: fileSize,
        created_at: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from('usage_analytics')
        .insert(analyticsData);

      if (error) {
        console.error('Error storing usage analytics:', error);
      }

    } catch (error) {
      console.error('Error in storeUsageAnalytics:', error);
    }
  }

  /**
   * Set up batch processing
   */
  setupBatchProcessing() {
    // Set up timer for periodic batch flushing
    this.batchTimer = setInterval(() => {
      if (this.batchQueue.length > 0) {
        this.flushBatch();
      }
    }, this.batchTimeout);
  }

  /**
   * Flush batch queue to database
   */
  async flushBatch() {
    if (this.batchQueue.length === 0) return;

    const batch = [...this.batchQueue];
    this.batchQueue = [];

    try {
      // In a real implementation, you might want to create an analytics_events table
      // For now, we'll store important events in usage_analytics
      const analyticsEvents = batch.filter(event => 
        ['tool_usage', 'file_operation'].includes(event.event_type)
      );

      if (analyticsEvents.length > 0) {
        console.log('Flushing analytics batch:', analyticsEvents.length, 'events');
        
        // Store events that are relevant for usage tracking
        for (const event of analyticsEvents) {
          if (event.event_type === 'tool_usage') {
            await this.storeUsageAnalytics(
              event.event_data.tool_type,
              event.event_data.action_type,
              event.event_data.metadata?.file_size
            );
          }
        }
      }
      
    } catch (error) {
      console.error('Error flushing analytics batch:', error);
      // Re-add failed events to queue for retry
      this.batchQueue.unshift(...batch);
    }
  }

  /**
   * Set up session tracking
   */
  setupSessionTracking() {
    // Update session duration every minute
    setInterval(() => {
      this.updateSessionDuration();
    }, 60000);

    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.trackEvent('page_hidden');
      } else {
        this.trackEvent('page_visible');
      }
    });
  }

  /**
   * Set up unload tracking
   */
  setupUnloadTracking() {
    window.addEventListener('beforeunload', () => {
      this.trackSessionEnd();
      this.flushBatch();
    });

    // Use Page Visibility API for better mobile support
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.trackSessionEnd();
        this.flushBatch();
      }
    });
  }

  /**
   * Update session duration
   */
  updateSessionDuration() {
    if (!this.privacySettings.trackingEnabled) return;

    const duration = Date.now() - this.sessionData.startTime;
    this.trackEvent('session_update', {
      duration: duration,
      tools_used: Array.from(this.sessionData.toolsUsed),
      files_processed: this.sessionData.filesProcessed,
      events_count: this.sessionData.events.length
    });
  }

  /**
   * Track session end
   */
  trackSessionEnd() {
    if (!this.privacySettings.trackingEnabled) return;

    const duration = Date.now() - this.sessionData.startTime;
    this.trackEvent('session_end', {
      duration: duration,
      tools_used: Array.from(this.sessionData.toolsUsed),
      files_processed: this.sessionData.filesProcessed,
      events_count: this.sessionData.events.length
    });
  }

  /**
   * Get user analytics summary
   */
  async getUserAnalytics(timeRange = '30d') {
    try {
      const user = this.authManager?.getCurrentUser();
      if (!user) return null;

      const startDate = this.getStartDate(timeRange);

      // Get usage analytics
      const { data: usageData, error: usageError } = await this.supabase
        .from('usage_analytics')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', startDate.toISOString());

      if (usageError) throw usageError;

      // Process analytics data
      const analytics = this.processAnalyticsData(usageData);
      
      return analytics;

    } catch (error) {
      console.error('Error getting user analytics:', error);
      return null;
    }
  }

  /**
   * Process analytics data into insights
   */
  processAnalyticsData(data) {
    const analytics = {
      totalEvents: data.length,
      toolUsage: {},
      actionTypes: {},
      dailyUsage: {},
      fileSizes: [],
      topTools: [],
      usagePatterns: {}
    };

    data.forEach(event => {
      const date = new Date(event.created_at).toDateString();
      const tool = event.tool_type;
      const action = event.action_type;

      // Tool usage
      analytics.toolUsage[tool] = (analytics.toolUsage[tool] || 0) + 1;
      
      // Action types
      analytics.actionTypes[action] = (analytics.actionTypes[action] || 0) + 1;
      
      // Daily usage
      analytics.dailyUsage[date] = (analytics.dailyUsage[date] || 0) + 1;
      
      // File sizes
      if (event.file_size) {
        analytics.fileSizes.push(event.file_size);
      }
    });

    // Calculate top tools
    analytics.topTools = Object.entries(analytics.toolUsage)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([tool, count]) => ({ tool, count }));

    // Calculate usage patterns
    analytics.usagePatterns = this.calculateUsagePatterns(data);

    return analytics;
  }

  /**
   * Calculate usage patterns
   */
  calculateUsagePatterns(data) {
    const patterns = {
      hourlyDistribution: new Array(24).fill(0),
      weeklyDistribution: new Array(7).fill(0),
      peakUsageHour: 0,
      peakUsageDay: 0
    };

    data.forEach(event => {
      const date = new Date(event.created_at);
      const hour = date.getHours();
      const day = date.getDay();
      
      patterns.hourlyDistribution[hour]++;
      patterns.weeklyDistribution[day]++;
    });

    // Find peak usage times
    patterns.peakUsageHour = patterns.hourlyDistribution.indexOf(
      Math.max(...patterns.hourlyDistribution)
    );
    patterns.peakUsageDay = patterns.weeklyDistribution.indexOf(
      Math.max(...patterns.weeklyDistribution)
    );

    return patterns;
  }

  /**
   * Get start date for time range
   */
  getStartDate(timeRange) {
    const now = new Date();
    const ranges = {
      '1d': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365
    };
    
    const days = ranges[timeRange] || 30;
    return new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
  }

  /**
   * Generate analytics report
   */
  async generateReport(timeRange = '30d', format = 'json') {
    try {
      const analytics = await this.getUserAnalytics(timeRange);
      if (!analytics) return null;

      const report = {
        timeRange: timeRange,
        generatedAt: new Date().toISOString(),
        summary: {
          totalEvents: analytics.totalEvents,
          uniqueTools: Object.keys(analytics.toolUsage).length,
          averageDailyUsage: analytics.totalEvents / Math.max(1, Object.keys(analytics.dailyUsage).length),
          topTool: analytics.topTools[0]?.tool || 'None'
        },
        details: analytics
      };

      if (format === 'csv') {
        return this.convertToCSV(report);
      }

      return report;

    } catch (error) {
      console.error('Error generating report:', error);
      return null;
    }
  }

  /**
   * Convert report to CSV format
   */
  convertToCSV(report) {
    const csvData = [];
    
    // Add summary
    csvData.push(['Summary']);
    csvData.push(['Total Events', report.summary.totalEvents]);
    csvData.push(['Unique Tools', report.summary.uniqueTools]);
    csvData.push(['Average Daily Usage', report.summary.averageDailyUsage.toFixed(2)]);
    csvData.push(['Top Tool', report.summary.topTool]);
    csvData.push(['']);
    
    // Add tool usage
    csvData.push(['Tool Usage']);
    csvData.push(['Tool', 'Count']);
    Object.entries(report.details.toolUsage).forEach(([tool, count]) => {
      csvData.push([tool, count]);
    });
    
    return csvData.map(row => row.join(',')).join('\\n');
  }

  /**
   * Export user data (GDPR compliance)
   */
  async exportUserData() {
    try {
      const user = this.authManager?.getCurrentUser();
      if (!user) return null;

      const analytics = await this.getUserAnalytics('1y');
      const exportData = {
        user_id: user.id,
        email: user.email,
        export_date: new Date().toISOString(),
        analytics: analytics,
        privacy_settings: this.privacySettings
      };

      return exportData;

    } catch (error) {
      console.error('Error exporting user data:', error);
      return null;
    }
  }

  /**
   * Delete user data (GDPR compliance)
   */
  async deleteUserData() {
    try {
      const user = this.authManager?.getCurrentUser();
      if (!user) return false;

      const { error } = await this.supabase
        .from('usage_analytics')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      return true;

    } catch (error) {
      console.error('Error deleting user data:', error);
      return false;
    }
  }

  /**
   * Update privacy settings
   */
  async updatePrivacySettings(settings) {
    try {
      this.privacySettings = { ...this.privacySettings, ...settings };

      const user = this.authManager?.getCurrentUser();
      if (user) {
        const { error } = await this.supabase
          .from('user_preferences')
          .upsert({
            user_id: user.id,
            analytics_enabled: this.privacySettings.trackingEnabled,
            data_retention_days: this.privacySettings.retentionDays
          });

        if (error) throw error;
      }

      return true;

    } catch (error) {
      console.error('Error updating privacy settings:', error);
      return false;
    }
  }

  /**
   * Anonymize URL for privacy
   */
  anonymizeUrl(url) {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
    } catch {
      return '/';
    }
  }

  /**
   * Anonymize user agent
   */
  anonymizeUserAgent(userAgent) {
    // Return just browser family and OS
    const browserMatch = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)/);
    const osMatch = userAgent.match(/(Windows|Mac|Linux|Android|iOS)/);
    
    const browser = browserMatch ? browserMatch[1] : 'Unknown';
    const os = osMatch ? osMatch[1] : 'Unknown';
    
    return `${browser} on ${os}`;
  }

  /**
   * Get real-time analytics
   */
  getRealTimeAnalytics() {
    return {
      sessionId: this.sessionData.sessionId,
      sessionDuration: Date.now() - this.sessionData.startTime,
      toolsUsed: Array.from(this.sessionData.toolsUsed),
      filesProcessed: this.sessionData.filesProcessed,
      eventsCount: this.sessionData.events.length,
      currentPage: window.location.pathname,
      privacySettings: this.privacySettings
    };
  }

  /**
   * Add analytics listener
   */
  addAnalyticsListener(callback) {
    this.analyticsListeners.push(callback);
  }

  /**
   * Remove analytics listener
   */
  removeAnalyticsListener(callback) {
    this.analyticsListeners = this.analyticsListeners.filter(listener => listener !== callback);
  }

  /**
   * Notify analytics listeners
   */
  notifyAnalyticsListeners(event, data) {
    this.analyticsListeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error in analytics listener:', error);
      }
    });
  }

  /**
   * Clean up analytics manager
   */
  destroy() {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }
    
    this.trackSessionEnd();
    this.flushBatch();
  }
}

// Global utility functions
window.trackEvent = function(eventType, eventData = {}) {
  if (window.analyticsManager) {
    window.analyticsManager.trackEvent(eventType, eventData);
  }
};

window.trackToolUsage = function(toolType, action, metadata = {}) {
  if (window.analyticsManager) {
    window.analyticsManager.trackToolUsage(toolType, action, metadata);
  }
};

window.trackError = function(error, context = {}) {
  if (window.analyticsManager) {
    window.analyticsManager.trackError(error, context);
  }
};

window.trackInteraction = function(element, action, metadata = {}) {
  if (window.analyticsManager) {
    window.analyticsManager.trackInteraction(element, action, metadata);
  }
};

// Create global instance when dependencies are available
if (typeof window !== 'undefined') {
  window.addEventListener('supabase-auth-change', () => {
    if (window.authManager && window.supabaseClient && !window.analyticsManager) {
      window.analyticsManager = new AnalyticsManager(window.authManager, window.supabaseClient);
    }
  });

  // Initialize immediately if dependencies are already available
  if (window.authManager && window.supabaseClient) {
    window.analyticsManager = new AnalyticsManager(window.authManager, window.supabaseClient);
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnalyticsManager;
}