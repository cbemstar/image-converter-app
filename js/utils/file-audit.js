/**
 * File Access Logging and Audit System
 * 
 * Tracks file access, operations, and maintains audit trails
 * Requirements: 14.3, 14.4, 14.5, 14.6
 */

import { storageManager } from '../storage/storage-config.js';

/**
 * File Audit Logger class
 */
export class FileAuditLogger {
  constructor() {
    this.auditQueue = [];
    this.maxQueueSize = 100;
    this.flushInterval = 30000; // 30 seconds
    this.isFlushingQueue = false;
    
    // Audit event types
    this.eventTypes = {
      UPLOAD: 'upload',
      DOWNLOAD: 'download',
      DELETE: 'delete',
      ACCESS: 'access',
      CONVERSION: 'conversion',
      CLEANUP: 'cleanup',
      ERROR: 'error'
    };
    
    this.init();
  }

  /**
   * Initialize the audit logger
   */
  init() {
    // Start periodic queue flushing
    this.startQueueFlushing();
    
    // Setup event listeners for automatic logging
    this.setupEventListeners();
    
    console.log('File audit logger initialized');
  }

  /**
   * Setup event listeners for automatic audit logging
   */
  setupEventListeners() {
    // Listen for storage events
    document.addEventListener('fileUploaded', (e) => {
      this.logFileOperation(this.eventTypes.UPLOAD, e.detail);
    });

    document.addEventListener('fileDownloaded', (e) => {
      this.logFileOperation(this.eventTypes.DOWNLOAD, e.detail);
    });

    document.addEventListener('fileDeleted', (e) => {
      this.logFileOperation(this.eventTypes.DELETE, e.detail);
    });

    document.addEventListener('fileConverted', (e) => {
      this.logFileOperation(this.eventTypes.CONVERSION, e.detail);
    });

    // Listen for cleanup events
    document.addEventListener('filesCleanedUp', (e) => {
      this.logCleanupOperation(e.detail);
    });

    // Listen for errors
    document.addEventListener('fileError', (e) => {
      this.logError(e.detail);
    });

    // Flush queue before page unload
    window.addEventListener('beforeunload', () => {
      this.flushQueueSync();
    });
  }

  /**
   * Log a file operation
   * @param {string} eventType - Type of operation
   * @param {Object} details - Operation details
   */
  async logFileOperation(eventType, details) {
    const auditEntry = await this.createAuditEntry(eventType, details);
    this.addToQueue(auditEntry);
  }

  /**
   * Log a cleanup operation
   * @param {Object} cleanupResult - Cleanup operation result
   */
  async logCleanupOperation(cleanupResult) {
    const auditEntry = await this.createAuditEntry(this.eventTypes.CLEANUP, {
      bucketId: cleanupResult.bucketId,
      filesDeleted: cleanupResult.filesDeleted,
      bytesFreed: cleanupResult.bytesFreed,
      duration: cleanupResult.duration,
      errors: cleanupResult.errors
    });
    
    this.addToQueue(auditEntry);
  }

  /**
   * Log an error
   * @param {Object} errorDetails - Error details
   */
  async logError(errorDetails) {
    const auditEntry = await this.createAuditEntry(this.eventTypes.ERROR, errorDetails);
    this.addToQueue(auditEntry);
  }

  /**
   * Create an audit entry
   * @param {string} eventType - Event type
   * @param {Object} details - Event details
   * @returns {Promise<Object>} Audit entry
   */
  async createAuditEntry(eventType, details) {
    const entry = {
      id: this.generateAuditId(),
      timestamp: new Date().toISOString(),
      eventType,
      userId: await this.getCurrentUserId(),
      sessionId: this.getSessionId(),
      ipAddress: await this.getClientIP(),
      userAgent: navigator.userAgent,
      details: this.sanitizeDetails(details),
      metadata: {
        url: window.location.href,
        referrer: document.referrer,
        timestamp: Date.now()
      }
    };

    return entry;
  }

  /**
   * Add audit entry to queue
   * @param {Object} entry - Audit entry
   */
  addToQueue(entry) {
    this.auditQueue.push(entry);
    
    // Prevent queue from growing too large
    if (this.auditQueue.length > this.maxQueueSize) {
      this.auditQueue.shift(); // Remove oldest entry
    }
    
    // Flush immediately for critical events
    if (this.isCriticalEvent(entry.eventType)) {
      this.flushQueue();
    }
  }

  /**
   * Check if event is critical and needs immediate logging
   * @param {string} eventType - Event type
   * @returns {boolean} True if critical
   */
  isCriticalEvent(eventType) {
    const criticalEvents = [this.eventTypes.DELETE, this.eventTypes.ERROR];
    return criticalEvents.includes(eventType);
  }

  /**
   * Start periodic queue flushing
   */
  startQueueFlushing() {
    setInterval(() => {
      if (this.auditQueue.length > 0) {
        this.flushQueue();
      }
    }, this.flushInterval);
  }

  /**
   * Flush audit queue to storage
   */
  async flushQueue() {
    if (this.isFlushingQueue || this.auditQueue.length === 0) {
      return;
    }

    this.isFlushingQueue = true;
    
    try {
      const entriesToFlush = [...this.auditQueue];
      this.auditQueue = [];
      
      await this.persistAuditEntries(entriesToFlush);
      
      console.log(`Flushed ${entriesToFlush.length} audit entries`);
      
    } catch (error) {
      console.error('Failed to flush audit queue:', error);
      
      // Re-add entries to queue if flush failed
      this.auditQueue.unshift(...this.auditQueue);
    } finally {
      this.isFlushingQueue = false;
    }
  }

  /**
   * Synchronously flush queue (for page unload)
   */
  flushQueueSync() {
    if (this.auditQueue.length === 0) return;
    
    try {
      // Use sendBeacon for reliable delivery during page unload
      if (navigator.sendBeacon) {
        const data = JSON.stringify({
          auditEntries: this.auditQueue,
          timestamp: new Date().toISOString()
        });
        
        navigator.sendBeacon('/api/audit/flush', data);
        this.auditQueue = [];
      }
    } catch (error) {
      console.error('Failed to flush audit queue synchronously:', error);
    }
  }

  /**
   * Persist audit entries to storage
   * @param {Array} entries - Audit entries to persist
   */
  async persistAuditEntries(entries) {
    try {
      // In a real implementation, this would send to a logging service
      // For now, we'll store in localStorage as a fallback
      
      const existingLogs = this.getStoredAuditLogs();
      const updatedLogs = [...existingLogs, ...entries];
      
      // Keep only the last 1000 entries in localStorage
      const trimmedLogs = updatedLogs.slice(-1000);
      
      localStorage.setItem('fileAuditLogs', JSON.stringify(trimmedLogs));
      
      // Also attempt to send to server if available
      await this.sendToAuditService(entries);
      
    } catch (error) {
      console.error('Failed to persist audit entries:', error);
      throw error;
    }
  }

  /**
   * Send audit entries to audit service
   * @param {Array} entries - Audit entries
   */
  async sendToAuditService(entries) {
    try {
      // This would be replaced with actual audit service endpoint
      const response = await fetch('/api/audit/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ entries })
      });

      if (!response.ok) {
        throw new Error(`Audit service responded with ${response.status}`);
      }
      
    } catch (error) {
      // Fail silently for audit service - we have localStorage backup
      console.warn('Audit service unavailable:', error.message);
    }
  }

  /**
   * Get stored audit logs from localStorage
   * @returns {Array} Stored audit logs
   */
  getStoredAuditLogs() {
    try {
      const stored = localStorage.getItem('fileAuditLogs');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to get stored audit logs:', error);
      return [];
    }
  }

  /**
   * Get current user ID
   * @returns {Promise<string|null>} User ID
   */
  async getCurrentUserId() {
    try {
      const { data: { user } } = await storageManager.supabase.auth.getUser();
      return user ? user.id : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get session ID
   * @returns {string} Session ID
   */
  getSessionId() {
    // Generate or retrieve session ID
    let sessionId = sessionStorage.getItem('auditSessionId');
    
    if (!sessionId) {
      sessionId = this.generateSessionId();
      sessionStorage.setItem('auditSessionId', sessionId);
    }
    
    return sessionId;
  }

  /**
   * Get client IP address (best effort)
   * @returns {Promise<string>} IP address
   */
  async getClientIP() {
    try {
      // This would typically be handled server-side
      // Client-side IP detection is limited and unreliable
      return 'client-side-unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Sanitize details to remove sensitive information
   * @param {Object} details - Raw details
   * @returns {Object} Sanitized details
   */
  sanitizeDetails(details) {
    if (!details || typeof details !== 'object') {
      return details;
    }

    const sanitized = { ...details };
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'key', 'secret', 'auth'];
    
    const sanitizeObject = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      
      const result = {};
      
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        
        if (sensitiveFields.some(field => lowerKey.includes(field))) {
          result[key] = '[REDACTED]';
        } else if (typeof value === 'object') {
          result[key] = sanitizeObject(value);
        } else {
          result[key] = value;
        }
      }
      
      return result;
    };

    return sanitizeObject(sanitized);
  }

  /**
   * Generate unique audit ID
   * @returns {string} Audit ID
   */
  generateAuditId() {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate session ID
   * @returns {string} Session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Query audit logs
   * @param {Object} filters - Query filters
   * @returns {Array} Filtered audit logs
   */
  queryAuditLogs(filters = {}) {
    const logs = this.getStoredAuditLogs();
    
    let filteredLogs = logs;

    // Apply filters
    if (filters.eventType) {
      filteredLogs = filteredLogs.filter(log => log.eventType === filters.eventType);
    }

    if (filters.userId) {
      filteredLogs = filteredLogs.filter(log => log.userId === filters.userId);
    }

    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= startDate);
    }

    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) <= endDate);
    }

    if (filters.bucketId) {
      filteredLogs = filteredLogs.filter(log => 
        log.details && log.details.bucketId === filters.bucketId
      );
    }

    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Apply limit
    if (filters.limit) {
      filteredLogs = filteredLogs.slice(0, filters.limit);
    }

    return filteredLogs;
  }

  /**
   * Get audit statistics
   * @param {Object} filters - Optional filters
   * @returns {Object} Audit statistics
   */
  getAuditStats(filters = {}) {
    const logs = this.queryAuditLogs(filters);
    
    const stats = {
      totalEvents: logs.length,
      eventTypes: {},
      userActivity: {},
      timeRange: {
        earliest: null,
        latest: null
      },
      errorCount: 0,
      criticalEvents: 0
    };

    logs.forEach(log => {
      // Count event types
      stats.eventTypes[log.eventType] = (stats.eventTypes[log.eventType] || 0) + 1;
      
      // Count user activity
      if (log.userId) {
        stats.userActivity[log.userId] = (stats.userActivity[log.userId] || 0) + 1;
      }
      
      // Track time range
      const timestamp = new Date(log.timestamp);
      if (!stats.timeRange.earliest || timestamp < stats.timeRange.earliest) {
        stats.timeRange.earliest = timestamp;
      }
      if (!stats.timeRange.latest || timestamp > stats.timeRange.latest) {
        stats.timeRange.latest = timestamp;
      }
      
      // Count errors
      if (log.eventType === this.eventTypes.ERROR) {
        stats.errorCount++;
      }
      
      // Count critical events
      if (this.isCriticalEvent(log.eventType)) {
        stats.criticalEvents++;
      }
    });

    return stats;
  }

  /**
   * Export audit logs
   * @param {Object} filters - Export filters
   * @param {string} format - Export format ('json' or 'csv')
   * @returns {string} Exported data
   */
  exportAuditLogs(filters = {}, format = 'json') {
    const logs = this.queryAuditLogs(filters);
    
    if (format === 'csv') {
      return this.exportToCSV(logs);
    } else {
      return JSON.stringify(logs, null, 2);
    }
  }

  /**
   * Export logs to CSV format
   * @param {Array} logs - Audit logs
   * @returns {string} CSV data
   */
  exportToCSV(logs) {
    if (logs.length === 0) {
      return 'No data to export';
    }

    const headers = [
      'Timestamp',
      'Event Type',
      'User ID',
      'Session ID',
      'IP Address',
      'Details'
    ];

    const csvRows = [headers.join(',')];
    
    logs.forEach(log => {
      const row = [
        log.timestamp,
        log.eventType,
        log.userId || '',
        log.sessionId || '',
        log.ipAddress || '',
        JSON.stringify(log.details || {}).replace(/"/g, '""')
      ];
      
      csvRows.push(row.map(field => `"${field}"`).join(','));
    });

    return csvRows.join('\n');
  }

  /**
   * Clear audit logs (with confirmation)
   * @param {boolean} confirmed - Confirmation flag
   * @returns {boolean} Success status
   */
  clearAuditLogs(confirmed = false) {
    if (!confirmed) {
      throw new Error('Clearing audit logs requires explicit confirmation');
    }

    try {
      localStorage.removeItem('fileAuditLogs');
      this.auditQueue = [];
      
      console.log('Audit logs cleared');
      return true;
    } catch (error) {
      console.error('Failed to clear audit logs:', error);
      return false;
    }
  }

  /**
   * Get current status
   * @returns {Object} Current status
   */
  getStatus() {
    return {
      queueSize: this.auditQueue.length,
      isFlushingQueue: this.isFlushingQueue,
      totalStoredLogs: this.getStoredAuditLogs().length,
      flushInterval: this.flushInterval,
      maxQueueSize: this.maxQueueSize,
      eventTypes: this.eventTypes
    };
  }
}

// Create singleton instance
export const fileAuditLogger = new FileAuditLogger();

// Make available globally
window.fileAuditLogger = fileAuditLogger;
window.FileAuditLogger = FileAuditLogger;