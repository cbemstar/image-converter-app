/**
 * Storage Usage Tracking System
 * 
 * Monitors and tracks file storage usage across buckets with limits and alerts
 * Requirements: 14.3, 14.4, 14.5, 14.6
 */

import { storageManager } from '../storage/storage-config.js';
import { fileAuditLogger } from './file-audit.js';

/**
 * Storage Usage Tracker class
 */
export class StorageUsageTracker {
  constructor() {
    this.usageCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    this.trackingInterval = null;
    this.alertThresholds = {
      warning: 0.8,  // 80%
      critical: 0.95 // 95%
    };
    
    // Storage limits per bucket (in bytes)
    this.storageLimits = {
      'user-uploads': 500 * 1024 * 1024,    // 500MB
      'converted-files': 2 * 1024 * 1024 * 1024, // 2GB
      'temp-processing': 100 * 1024 * 1024  // 100MB
    };
    
    // User-specific limits
    this.userLimits = {
      free: {
        totalStorage: 100 * 1024 * 1024,     // 100MB
        maxFileSize: 10 * 1024 * 1024,       // 10MB
        maxFiles: 100
      },
      pro: {
        totalStorage: 1 * 1024 * 1024 * 1024, // 1GB
        maxFileSize: 50 * 1024 * 1024,        // 50MB
        maxFiles: 1000
      },
      unlimited: {
        totalStorage: 10 * 1024 * 1024 * 1024, // 10GB
        maxFileSize: 100 * 1024 * 1024,        // 100MB
        maxFiles: 10000
      }
    };
    
    this.init();
  }

  /**
   * Initialize the storage usage tracker
   */
  init() {
    // Start periodic usage tracking
    this.startTracking();
    
    // Setup event listeners
    this.setupEventListeners();
    
    console.log('Storage usage tracker initialized');
  }

  /**
   * Setup event listeners for storage events
   */
  setupEventListeners() {
    // Listen for file operations
    document.addEventListener('fileUploaded', (e) => {
      this.handleFileOperation('upload', e.detail);
    });

    document.addEventListener('fileDeleted', (e) => {
      this.handleFileOperation('delete', e.detail);
    });

    document.addEventListener('fileConverted', (e) => {
      this.handleFileOperation('conversion', e.detail);
    });

    // Listen for cleanup events
    document.addEventListener('filesCleanedUp', (e) => {
      this.handleCleanupOperation(e.detail);
    });

    // Track usage on visibility change
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.refreshUsageData();
      }
    });
  }

  /**
   * Start periodic usage tracking
   */
  startTracking() {
    // Track usage every 2 minutes
    this.trackingInterval = setInterval(async () => {
      try {
        await this.trackUsage();
      } catch (error) {
        console.error('Usage tracking failed:', error);
      }
    }, 2 * 60 * 1000);

    // Initial tracking
    this.trackUsage();
  }

  /**
   * Track current storage usage
   */
  async trackUsage() {
    try {
      const usage = await this.calculateCurrentUsage();
      
      // Update cache
      this.updateUsageCache(usage);
      
      // Check for alerts
      await this.checkUsageAlerts(usage);
      
      // Log usage data
      await this.logUsageData(usage);
      
    } catch (error) {
      console.error('Error tracking storage usage:', error);
    }
  }

  /**
   * Calculate current storage usage across all buckets
   * @returns {Promise<Object>} Usage data
   */
  async calculateCurrentUsage() {
    const usage = {
      timestamp: new Date(),
      buckets: {},
      totals: {
        files: 0,
        bytes: 0,
        users: new Set()
      },
      userUsage: {},
      alerts: []
    };

    try {
      // Get usage for each bucket
      for (const bucketId of Object.keys(this.storageLimits)) {
        const bucketUsage = await this.calculateBucketUsage(bucketId);
        usage.buckets[bucketId] = bucketUsage;
        
        // Add to totals
        usage.totals.files += bucketUsage.fileCount;
        usage.totals.bytes += bucketUsage.totalBytes;
        
        // Track unique users
        bucketUsage.users.forEach(userId => usage.totals.users.add(userId));
      }

      // Convert users set to count
      usage.totals.userCount = usage.totals.users.size;
      delete usage.totals.users;

      // Calculate per-user usage
      usage.userUsage = await this.calculateUserUsage();

    } catch (error) {
      console.error('Error calculating storage usage:', error);
      throw error;
    }

    return usage;
  }

  /**
   * Calculate usage for a specific bucket
   * @param {string} bucketId - Bucket ID
   * @returns {Promise<Object>} Bucket usage data
   */
  async calculateBucketUsage(bucketId) {
    const usage = {
      bucketId,
      fileCount: 0,
      totalBytes: 0,
      averageFileSize: 0,
      oldestFile: null,
      newestFile: null,
      users: new Set(),
      fileTypes: {},
      utilizationPercent: 0
    };

    try {
      // Get file metadata from database
      const { data: files, error } = await storageManager.supabase
        .from('file_metadata')
        .select('*')
        .eq('bucket_id', bucketId);

      if (error) {
        throw new Error(`Failed to get file metadata for ${bucketId}: ${error.message}`);
      }

      if (!files || files.length === 0) {
        return usage;
      }

      // Process files
      files.forEach(file => {
        usage.fileCount++;
        usage.totalBytes += file.file_size || 0;
        
        // Track users
        if (file.user_id) {
          usage.users.add(file.user_id);
        }
        
        // Track file types
        const extension = this.getFileExtension(file.original_name);
        usage.fileTypes[extension] = (usage.fileTypes[extension] || 0) + 1;
        
        // Track oldest/newest files
        const createdAt = new Date(file.created_at);
        if (!usage.oldestFile || createdAt < new Date(usage.oldestFile.created_at)) {
          usage.oldestFile = file;
        }
        if (!usage.newestFile || createdAt > new Date(usage.newestFile.created_at)) {
          usage.newestFile = file;
        }
      });

      // Calculate averages and percentages
      usage.averageFileSize = usage.fileCount > 0 ? usage.totalBytes / usage.fileCount : 0;
      
      const bucketLimit = this.storageLimits[bucketId];
      usage.utilizationPercent = bucketLimit > 0 ? (usage.totalBytes / bucketLimit) * 100 : 0;
      
      // Convert users set to array
      usage.users = Array.from(usage.users);

    } catch (error) {
      console.error(`Error calculating bucket usage for ${bucketId}:`, error);
      throw error;
    }

    return usage;
  }

  /**
   * Calculate per-user storage usage
   * @returns {Promise<Object>} User usage data
   */
  async calculateUserUsage() {
    const userUsage = {};

    try {
      // Get user usage data
      const { data: userFiles, error } = await storageManager.supabase
        .from('file_metadata')
        .select('user_id, file_size, bucket_id, created_at');

      if (error) {
        throw new Error(`Failed to get user file data: ${error.message}`);
      }

      if (!userFiles || userFiles.length === 0) {
        return userUsage;
      }

      // Process user files
      userFiles.forEach(file => {
        const userId = file.user_id;
        if (!userId) return;

        if (!userUsage[userId]) {
          userUsage[userId] = {
            totalFiles: 0,
            totalBytes: 0,
            buckets: {},
            oldestFile: null,
            newestFile: null,
            averageFileSize: 0
          };
        }

        const user = userUsage[userId];
        user.totalFiles++;
        user.totalBytes += file.file_size || 0;

        // Track per-bucket usage
        if (!user.buckets[file.bucket_id]) {
          user.buckets[file.bucket_id] = { files: 0, bytes: 0 };
        }
        user.buckets[file.bucket_id].files++;
        user.buckets[file.bucket_id].bytes += file.file_size || 0;

        // Track oldest/newest files
        const createdAt = new Date(file.created_at);
        if (!user.oldestFile || createdAt < new Date(user.oldestFile)) {
          user.oldestFile = file.created_at;
        }
        if (!user.newestFile || createdAt > new Date(user.newestFile)) {
          user.newestFile = file.created_at;
        }
      });

      // Calculate averages for each user
      Object.values(userUsage).forEach(user => {
        user.averageFileSize = user.totalFiles > 0 ? user.totalBytes / user.totalFiles : 0;
      });

    } catch (error) {
      console.error('Error calculating user usage:', error);
      throw error;
    }

    return userUsage;
  }

  /**
   * Check for usage alerts and warnings
   * @param {Object} usage - Current usage data
   */
  async checkUsageAlerts(usage) {
    const alerts = [];

    try {
      // Check bucket-level alerts
      for (const [bucketId, bucketUsage] of Object.entries(usage.buckets)) {
        const utilizationPercent = bucketUsage.utilizationPercent / 100;
        
        if (utilizationPercent >= this.alertThresholds.critical) {
          alerts.push({
            type: 'critical',
            level: 'bucket',
            bucketId,
            message: `Bucket ${bucketId} is ${bucketUsage.utilizationPercent.toFixed(1)}% full`,
            utilizationPercent: bucketUsage.utilizationPercent,
            currentBytes: bucketUsage.totalBytes,
            limitBytes: this.storageLimits[bucketId]
          });
        } else if (utilizationPercent >= this.alertThresholds.warning) {
          alerts.push({
            type: 'warning',
            level: 'bucket',
            bucketId,
            message: `Bucket ${bucketId} is ${bucketUsage.utilizationPercent.toFixed(1)}% full`,
            utilizationPercent: bucketUsage.utilizationPercent,
            currentBytes: bucketUsage.totalBytes,
            limitBytes: this.storageLimits[bucketId]
          });
        }
      }

      // Check user-level alerts
      for (const [userId, userUsage] of Object.entries(usage.userUsage)) {
        const userPlan = await this.getUserPlan(userId);
        const userLimit = this.userLimits[userPlan] || this.userLimits.free;
        
        const userUtilization = userUsage.totalBytes / userLimit.totalStorage;
        
        if (userUtilization >= this.alertThresholds.critical) {
          alerts.push({
            type: 'critical',
            level: 'user',
            userId,
            message: `User ${userId} has used ${(userUtilization * 100).toFixed(1)}% of their storage quota`,
            utilizationPercent: userUtilization * 100,
            currentBytes: userUsage.totalBytes,
            limitBytes: userLimit.totalStorage,
            plan: userPlan
          });
        } else if (userUtilization >= this.alertThresholds.warning) {
          alerts.push({
            type: 'warning',
            level: 'user',
            userId,
            message: `User ${userId} has used ${(userUtilization * 100).toFixed(1)}% of their storage quota`,
            utilizationPercent: userUtilization * 100,
            currentBytes: userUsage.totalBytes,
            limitBytes: userLimit.totalStorage,
            plan: userPlan
          });
        }
      }

      // Store alerts in usage data
      usage.alerts = alerts;

      // Send notifications for new alerts
      await this.processAlerts(alerts);

    } catch (error) {
      console.error('Error checking usage alerts:', error);
    }
  }

  /**
   * Process and send alerts
   * @param {Array} alerts - Array of alerts
   */
  async processAlerts(alerts) {
    for (const alert of alerts) {
      try {
        // Log alert
        await fileAuditLogger.logError({
          type: 'storage_alert',
          alert,
          timestamp: new Date().toISOString()
        });

        // Send notification (if notification system is available)
        if (window.showNotification) {
          const message = alert.message;
          const type = alert.type === 'critical' ? 'error' : 'warning';
          window.showNotification(message, type);
        }

        // Dispatch custom event for alert handling
        document.dispatchEvent(new CustomEvent('storageAlert', {
          detail: alert
        }));

      } catch (error) {
        console.error('Error processing alert:', error);
      }
    }
  }

  /**
   * Get user's plan type
   * @param {string} userId - User ID
   * @returns {Promise<string>} User plan
   */
  async getUserPlan(userId) {
    try {
      // This would typically query the user's subscription data
      // For now, return 'free' as default
      return 'free';
    } catch (error) {
      console.error('Error getting user plan:', error);
      return 'free';
    }
  }

  /**
   * Handle file operation events
   * @param {string} operation - Operation type
   * @param {Object} details - Operation details
   */
  async handleFileOperation(operation, details) {
    try {
      // Invalidate cache for affected bucket
      if (details.bucketId) {
        this.invalidateCache(details.bucketId);
      }

      // Trigger immediate usage check for large operations
      if (operation === 'upload' && details.fileSize > 10 * 1024 * 1024) { // 10MB
        await this.trackUsage();
      }

    } catch (error) {
      console.error('Error handling file operation:', error);
    }
  }

  /**
   * Handle cleanup operation events
   * @param {Object} cleanupResult - Cleanup result
   */
  async handleCleanupOperation(cleanupResult) {
    try {
      // Invalidate cache for cleaned bucket
      this.invalidateCache(cleanupResult.bucketId);
      
      // Trigger usage tracking after cleanup
      setTimeout(() => {
        this.trackUsage();
      }, 1000);

    } catch (error) {
      console.error('Error handling cleanup operation:', error);
    }
  }

  /**
   * Update usage cache
   * @param {Object} usage - Usage data
   */
  updateUsageCache(usage) {
    this.usageCache.set('current', {
      data: usage,
      timestamp: Date.now()
    });
  }

  /**
   * Invalidate cache for specific bucket
   * @param {string} bucketId - Bucket ID to invalidate
   */
  invalidateCache(bucketId) {
    const cached = this.usageCache.get('current');
    if (cached && cached.data.buckets[bucketId]) {
      // Remove the specific bucket from cache
      delete cached.data.buckets[bucketId];
    }
  }

  /**
   * Get cached usage data
   * @returns {Object|null} Cached usage data
   */
  getCachedUsage() {
    const cached = this.usageCache.get('current');
    
    if (!cached) return null;
    
    // Check if cache is expired
    if (Date.now() - cached.timestamp > this.cacheExpiry) {
      this.usageCache.delete('current');
      return null;
    }
    
    return cached.data;
  }

  /**
   * Get current usage (from cache or fresh calculation)
   * @param {boolean} forceRefresh - Force fresh calculation
   * @returns {Promise<Object>} Usage data
   */
  async getCurrentUsage(forceRefresh = false) {
    if (!forceRefresh) {
      const cached = this.getCachedUsage();
      if (cached) {
        return cached;
      }
    }

    return await this.calculateCurrentUsage();
  }

  /**
   * Refresh usage data
   */
  async refreshUsageData() {
    try {
      await this.trackUsage();
    } catch (error) {
      console.error('Error refreshing usage data:', error);
    }
  }

  /**
   * Log usage data for historical tracking
   * @param {Object} usage - Usage data
   */
  async logUsageData(usage) {
    try {
      // Store usage snapshot in localStorage for historical data
      const historicalData = this.getHistoricalUsageData();
      
      // Keep only the last 24 hours of data (assuming tracking every 2 minutes)
      const maxEntries = 24 * 30; // 24 hours * 30 entries per hour
      
      historicalData.push({
        timestamp: usage.timestamp.toISOString(),
        totalFiles: usage.totals.files,
        totalBytes: usage.totals.bytes,
        userCount: usage.totals.userCount,
        bucketUsage: Object.fromEntries(
          Object.entries(usage.buckets).map(([id, bucket]) => [
            id, 
            { 
              files: bucket.fileCount, 
              bytes: bucket.totalBytes,
              utilization: bucket.utilizationPercent
            }
          ])
        )
      });

      // Trim to max entries
      if (historicalData.length > maxEntries) {
        historicalData.splice(0, historicalData.length - maxEntries);
      }

      localStorage.setItem('storageUsageHistory', JSON.stringify(historicalData));

    } catch (error) {
      console.error('Error logging usage data:', error);
    }
  }

  /**
   * Get historical usage data
   * @returns {Array} Historical usage data
   */
  getHistoricalUsageData() {
    try {
      const stored = localStorage.getItem('storageUsageHistory');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error getting historical usage data:', error);
      return [];
    }
  }

  /**
   * Get usage statistics
   * @param {number} hours - Number of hours to analyze (default: 24)
   * @returns {Object} Usage statistics
   */
  getUsageStatistics(hours = 24) {
    const historicalData = this.getHistoricalUsageData();
    const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
    
    const recentData = historicalData.filter(entry => 
      new Date(entry.timestamp) >= cutoffTime
    );

    if (recentData.length === 0) {
      return { noData: true };
    }

    const stats = {
      timeRange: {
        start: recentData[0].timestamp,
        end: recentData[recentData.length - 1].timestamp,
        entries: recentData.length
      },
      files: {
        min: Math.min(...recentData.map(d => d.totalFiles)),
        max: Math.max(...recentData.map(d => d.totalFiles)),
        average: recentData.reduce((sum, d) => sum + d.totalFiles, 0) / recentData.length,
        current: recentData[recentData.length - 1].totalFiles
      },
      bytes: {
        min: Math.min(...recentData.map(d => d.totalBytes)),
        max: Math.max(...recentData.map(d => d.totalBytes)),
        average: recentData.reduce((sum, d) => sum + d.totalBytes, 0) / recentData.length,
        current: recentData[recentData.length - 1].totalBytes
      },
      users: {
        min: Math.min(...recentData.map(d => d.userCount)),
        max: Math.max(...recentData.map(d => d.userCount)),
        average: recentData.reduce((sum, d) => sum + d.userCount, 0) / recentData.length,
        current: recentData[recentData.length - 1].userCount
      },
      growth: {
        files: recentData.length > 1 ? 
          recentData[recentData.length - 1].totalFiles - recentData[0].totalFiles : 0,
        bytes: recentData.length > 1 ? 
          recentData[recentData.length - 1].totalBytes - recentData[0].totalBytes : 0
      }
    };

    return stats;
  }

  /**
   * Check if user can upload file
   * @param {string} userId - User ID
   * @param {number} fileSize - File size in bytes
   * @returns {Promise<Object>} Check result
   */
  async canUserUploadFile(userId, fileSize) {
    const result = {
      allowed: false,
      reason: null,
      currentUsage: null,
      limit: null
    };

    try {
      const userPlan = await this.getUserPlan(userId);
      const userLimit = this.userLimits[userPlan] || this.userLimits.free;
      
      const usage = await this.getCurrentUsage();
      const userUsage = usage.userUsage[userId] || { totalBytes: 0, totalFiles: 0 };

      result.currentUsage = userUsage;
      result.limit = userLimit;

      // Check file size limit
      if (fileSize > userLimit.maxFileSize) {
        result.reason = `File size (${this.formatFileSize(fileSize)}) exceeds limit (${this.formatFileSize(userLimit.maxFileSize)})`;
        return result;
      }

      // Check total storage limit
      if (userUsage.totalBytes + fileSize > userLimit.totalStorage) {
        result.reason = `Upload would exceed storage limit (${this.formatFileSize(userLimit.totalStorage)})`;
        return result;
      }

      // Check file count limit
      if (userUsage.totalFiles >= userLimit.maxFiles) {
        result.reason = `File count limit reached (${userLimit.maxFiles} files)`;
        return result;
      }

      result.allowed = true;
      return result;

    } catch (error) {
      console.error('Error checking upload permission:', error);
      result.reason = 'Error checking upload permission';
      return result;
    }
  }

  /**
   * Get file extension from filename
   * @param {string} filename - Filename
   * @returns {string} File extension
   */
  getFileExtension(filename) {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : 'unknown';
  }

  /**
   * Format file size for display
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Update storage limits
   * @param {Object} newLimits - New storage limits
   */
  updateStorageLimits(newLimits) {
    this.storageLimits = { ...this.storageLimits, ...newLimits };
    console.log('Storage limits updated:', this.storageLimits);
  }

  /**
   * Update alert thresholds
   * @param {Object} newThresholds - New alert thresholds
   */
  updateAlertThresholds(newThresholds) {
    this.alertThresholds = { ...this.alertThresholds, ...newThresholds };
    console.log('Alert thresholds updated:', this.alertThresholds);
  }

  /**
   * Get current status
   * @returns {Object} Current status
   */
  getStatus() {
    return {
      isTracking: this.trackingInterval !== null,
      cacheSize: this.usageCache.size,
      storageLimits: this.storageLimits,
      alertThresholds: this.alertThresholds,
      userLimits: this.userLimits,
      lastUpdate: this.getCachedUsage()?.timestamp || null
    };
  }

  /**
   * Stop usage tracking
   */
  stop() {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }
    
    console.log('Storage usage tracking stopped');
  }

  /**
   * Restart usage tracking
   */
  restart() {
    this.stop();
    this.startTracking();
    console.log('Storage usage tracking restarted');
  }
}

// Create singleton instance
export const storageUsageTracker = new StorageUsageTracker();

// Make available globally
window.storageUsageTracker = storageUsageTracker;
window.StorageUsageTracker = StorageUsageTracker;