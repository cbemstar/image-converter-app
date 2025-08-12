/**
 * File Cleanup and Management System
 * 
 * Handles automatic file cleanup, retention policies, and storage management
 * Requirements: 14.3, 14.4, 14.5, 14.6
 */

import { storageManager } from '../storage/storage-config.js';

/**
 * File Cleanup Manager class
 */
export class FileCleanupManager {
  constructor() {
    this.cleanupIntervals = new Map();
    this.cleanupHistory = [];
    this.isRunning = false;
    this.maxHistoryEntries = 100;
    
    // Cleanup policies
    this.policies = {
      'user-uploads': {
        retentionHours: 24,
        maxFiles: 1000,
        maxTotalSize: 500 * 1024 * 1024, // 500MB
        cleanupInterval: 60 * 60 * 1000, // 1 hour
      },
      'converted-files': {
        retentionHours: 168, // 7 days
        maxFiles: 5000,
        maxTotalSize: 2 * 1024 * 1024 * 1024, // 2GB
        cleanupInterval: 4 * 60 * 60 * 1000, // 4 hours
      },
      'temp-processing': {
        retentionHours: 1,
        maxFiles: 100,
        maxTotalSize: 100 * 1024 * 1024, // 100MB
        cleanupInterval: 15 * 60 * 1000, // 15 minutes
      }
    };
    
    this.init();
  }

  /**
   * Initialize the cleanup manager
   */
  init() {
    // Start cleanup schedules for each bucket
    Object.keys(this.policies).forEach(bucketId => {
      this.scheduleCleanup(bucketId);
    });
    
    // Setup browser event listeners
    this.setupEventListeners();
    
    console.log('File cleanup manager initialized');
  }

  /**
   * Setup event listeners for cleanup triggers
   */
  setupEventListeners() {
    // Cleanup on page visibility change
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.performMaintenanceCleanup();
      }
    });

    // Cleanup on beforeunload
    window.addEventListener('beforeunload', () => {
      this.performEmergencyCleanup();
    });

    // Cleanup on storage events (if supported)
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      this.monitorStorageUsage();
    }
  }

  /**
   * Schedule cleanup for a specific bucket
   * @param {string} bucketId - Bucket to schedule cleanup for
   */
  scheduleCleanup(bucketId) {
    const policy = this.policies[bucketId];
    if (!policy) {
      console.warn(`No cleanup policy found for bucket: ${bucketId}`);
      return;
    }

    // Clear existing interval if any
    if (this.cleanupIntervals.has(bucketId)) {
      clearInterval(this.cleanupIntervals.get(bucketId));
    }

    // Schedule new cleanup interval
    const intervalId = setInterval(async () => {
      try {
        await this.cleanupBucket(bucketId);
      } catch (error) {
        console.error(`Scheduled cleanup failed for ${bucketId}:`, error);
      }
    }, policy.cleanupInterval);

    this.cleanupIntervals.set(bucketId, intervalId);
    
    console.log(`Scheduled cleanup for ${bucketId} every ${policy.cleanupInterval / 1000} seconds`);
  }

  /**
   * Cleanup files in a specific bucket
   * @param {string} bucketId - Bucket to cleanup
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupBucket(bucketId) {
    const policy = this.policies[bucketId];
    if (!policy) {
      throw new Error(`No cleanup policy found for bucket: ${bucketId}`);
    }

    const cleanupStart = Date.now();
    const result = {
      bucketId,
      startTime: new Date(cleanupStart),
      filesDeleted: 0,
      bytesFreed: 0,
      errors: [],
      duration: 0
    };

    try {
      console.log(`Starting cleanup for bucket: ${bucketId}`);

      // Get file metadata for the bucket
      const files = await this.getFileMetadata(bucketId);
      
      if (files.length === 0) {
        result.duration = Date.now() - cleanupStart;
        return result;
      }

      // Apply cleanup rules
      const filesToDelete = this.identifyFilesToDelete(files, policy);
      
      if (filesToDelete.length === 0) {
        console.log(`No files to delete in bucket: ${bucketId}`);
        result.duration = Date.now() - cleanupStart;
        return result;
      }

      // Delete files
      for (const file of filesToDelete) {
        try {
          await this.deleteFile(bucketId, file);
          result.filesDeleted++;
          result.bytesFreed += file.file_size || 0;
        } catch (error) {
          console.error(`Failed to delete file ${file.file_path}:`, error);
          result.errors.push({
            file: file.file_path,
            error: error.message
          });
        }
      }

      result.duration = Date.now() - cleanupStart;
      
      // Log cleanup result
      console.log(`Cleanup completed for ${bucketId}:`, {
        filesDeleted: result.filesDeleted,
        bytesFreed: this.formatFileSize(result.bytesFreed),
        duration: `${result.duration}ms`,
        errors: result.errors.length
      });

      // Add to cleanup history
      this.addToHistory(result);

    } catch (error) {
      console.error(`Cleanup failed for bucket ${bucketId}:`, error);
      result.errors.push({ general: error.message });
      result.duration = Date.now() - cleanupStart;
    }

    return result;
  }

  /**
   * Get file metadata for a bucket
   * @param {string} bucketId - Bucket ID
   * @returns {Promise<Array>} Array of file metadata
   */
  async getFileMetadata(bucketId) {
    try {
      const { data, error } = await storageManager.supabase
        .from('file_metadata')
        .select('*')
        .eq('bucket_id', bucketId)
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to get file metadata: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error getting file metadata:', error);
      return [];
    }
  }

  /**
   * Identify files to delete based on policy
   * @param {Array} files - Array of file metadata
   * @param {Object} policy - Cleanup policy
   * @returns {Array} Files to delete
   */
  identifyFilesToDelete(files, policy) {
    const now = new Date();
    const filesToDelete = [];

    // Sort files by creation date (oldest first)
    const sortedFiles = [...files].sort((a, b) => 
      new Date(a.created_at) - new Date(b.created_at)
    );

    // Rule 1: Delete expired files
    const expiredFiles = sortedFiles.filter(file => {
      if (file.expires_at) {
        return new Date(file.expires_at) < now;
      }
      
      // Calculate expiration based on retention policy
      const createdAt = new Date(file.created_at);
      const expirationTime = new Date(createdAt.getTime() + (policy.retentionHours * 60 * 60 * 1000));
      return expirationTime < now;
    });

    filesToDelete.push(...expiredFiles);

    // Rule 2: Delete oldest files if over file count limit
    const remainingFiles = sortedFiles.filter(file => !filesToDelete.includes(file));
    if (remainingFiles.length > policy.maxFiles) {
      const excessFiles = remainingFiles.slice(0, remainingFiles.length - policy.maxFiles);
      filesToDelete.push(...excessFiles);
    }

    // Rule 3: Delete oldest files if over size limit
    const finalRemainingFiles = sortedFiles.filter(file => !filesToDelete.includes(file));
    let totalSize = finalRemainingFiles.reduce((sum, file) => sum + (file.file_size || 0), 0);
    
    if (totalSize > policy.maxTotalSize) {
      for (const file of finalRemainingFiles) {
        if (totalSize <= policy.maxTotalSize) break;
        
        if (!filesToDelete.includes(file)) {
          filesToDelete.push(file);
          totalSize -= (file.file_size || 0);
        }
      }
    }

    return filesToDelete;
  }

  /**
   * Delete a file from storage and metadata
   * @param {string} bucketId - Bucket ID
   * @param {Object} fileMetadata - File metadata
   * @returns {Promise<void>}
   */
  async deleteFile(bucketId, fileMetadata) {
    try {
      // Delete from storage
      const { error: storageError } = await storageManager.supabase.storage
        .from(bucketId)
        .remove([fileMetadata.file_path]);

      if (storageError) {
        console.warn(`Storage deletion failed for ${fileMetadata.file_path}:`, storageError);
        // Continue with metadata deletion even if storage deletion fails
      }

      // Delete metadata record
      const { error: metadataError } = await storageManager.supabase
        .from('file_metadata')
        .delete()
        .eq('id', fileMetadata.id);

      if (metadataError) {
        throw new Error(`Metadata deletion failed: ${metadataError.message}`);
      }

    } catch (error) {
      console.error(`Error deleting file ${fileMetadata.file_path}:`, error);
      throw error;
    }
  }

  /**
   * Perform maintenance cleanup (less aggressive)
   */
  async performMaintenanceCleanup() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    try {
      console.log('Performing maintenance cleanup...');
      
      // Only cleanup temp-processing bucket during maintenance
      await this.cleanupBucket('temp-processing');
      
      // Check for orphaned files
      await this.cleanupOrphanedFiles();
      
    } catch (error) {
      console.error('Maintenance cleanup failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Perform emergency cleanup (more aggressive)
   */
  async performEmergencyCleanup() {
    try {
      console.log('Performing emergency cleanup...');
      
      // Cleanup all temp files immediately
      await this.cleanupBucket('temp-processing');
      
      // Cleanup old user uploads
      const userUploads = await this.getFileMetadata('user-uploads');
      const now = new Date();
      const emergencyExpiredFiles = userUploads.filter(file => {
        const createdAt = new Date(file.created_at);
        const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);
        return hoursSinceCreation > 1; // Delete files older than 1 hour
      });

      for (const file of emergencyExpiredFiles) {
        try {
          await this.deleteFile('user-uploads', file);
        } catch (error) {
          console.error('Emergency cleanup file deletion failed:', error);
        }
      }
      
    } catch (error) {
      console.error('Emergency cleanup failed:', error);
    }
  }

  /**
   * Cleanup orphaned files (files in storage but not in metadata)
   */
  async cleanupOrphanedFiles() {
    try {
      console.log('Checking for orphaned files...');
      
      for (const bucketId of Object.keys(this.policies)) {
        await this.cleanupOrphanedFilesInBucket(bucketId);
      }
      
    } catch (error) {
      console.error('Orphaned file cleanup failed:', error);
    }
  }

  /**
   * Cleanup orphaned files in a specific bucket
   * @param {string} bucketId - Bucket ID
   */
  async cleanupOrphanedFilesInBucket(bucketId) {
    try {
      // Get files from storage
      const { data: storageFiles, error: storageError } = await storageManager.supabase.storage
        .from(bucketId)
        .list('', { limit: 1000 });

      if (storageError) {
        console.warn(`Failed to list storage files for ${bucketId}:`, storageError);
        return;
      }

      if (!storageFiles || storageFiles.length === 0) {
        return;
      }

      // Get metadata records
      const metadataFiles = await this.getFileMetadata(bucketId);
      const metadataPaths = new Set(metadataFiles.map(f => f.file_path));

      // Find orphaned files
      const orphanedFiles = storageFiles.filter(file => {
        const filePath = file.name;
        return !metadataPaths.has(filePath);
      });

      if (orphanedFiles.length === 0) {
        return;
      }

      console.log(`Found ${orphanedFiles.length} orphaned files in ${bucketId}`);

      // Delete orphaned files
      const filesToDelete = orphanedFiles.map(f => f.name);
      const { error: deleteError } = await storageManager.supabase.storage
        .from(bucketId)
        .remove(filesToDelete);

      if (deleteError) {
        console.error(`Failed to delete orphaned files from ${bucketId}:`, deleteError);
      } else {
        console.log(`Deleted ${filesToDelete.length} orphaned files from ${bucketId}`);
      }

    } catch (error) {
      console.error(`Error cleaning orphaned files in ${bucketId}:`, error);
    }
  }

  /**
   * Monitor storage usage and trigger cleanup if needed
   */
  async monitorStorageUsage() {
    try {
      if (!('storage' in navigator) || !('estimate' in navigator.storage)) {
        return;
      }

      const estimate = await navigator.storage.estimate();
      const usagePercent = (estimate.usage / estimate.quota) * 100;

      console.log(`Storage usage: ${this.formatFileSize(estimate.usage)} / ${this.formatFileSize(estimate.quota)} (${usagePercent.toFixed(1)}%)`);

      // Trigger aggressive cleanup if storage is over 80% full
      if (usagePercent > 80) {
        console.warn('Storage usage is high, triggering aggressive cleanup...');
        await this.performAggressiveCleanup();
      }

    } catch (error) {
      console.error('Storage monitoring failed:', error);
    }
  }

  /**
   * Perform aggressive cleanup when storage is full
   */
  async performAggressiveCleanup() {
    try {
      console.log('Performing aggressive cleanup...');
      
      // Cleanup all buckets with reduced retention times
      const aggressivePolicies = {
        'temp-processing': { ...this.policies['temp-processing'], retentionHours: 0.1 }, // 6 minutes
        'user-uploads': { ...this.policies['user-uploads'], retentionHours: 12 }, // 12 hours
        'converted-files': { ...this.policies['converted-files'], retentionHours: 72 } // 3 days
      };

      for (const [bucketId, policy] of Object.entries(aggressivePolicies)) {
        const files = await this.getFileMetadata(bucketId);
        const filesToDelete = this.identifyFilesToDelete(files, policy);
        
        for (const file of filesToDelete) {
          try {
            await this.deleteFile(bucketId, file);
          } catch (error) {
            console.error(`Aggressive cleanup failed for ${file.file_path}:`, error);
          }
        }
      }

    } catch (error) {
      console.error('Aggressive cleanup failed:', error);
    }
  }

  /**
   * Get cleanup statistics
   * @returns {Object} Cleanup statistics
   */
  getCleanupStats() {
    const stats = {
      totalCleanups: this.cleanupHistory.length,
      totalFilesDeleted: 0,
      totalBytesFreed: 0,
      averageCleanupTime: 0,
      lastCleanup: null,
      bucketStats: {}
    };

    if (this.cleanupHistory.length === 0) {
      return stats;
    }

    // Calculate totals
    let totalDuration = 0;
    
    this.cleanupHistory.forEach(cleanup => {
      stats.totalFilesDeleted += cleanup.filesDeleted;
      stats.totalBytesFreed += cleanup.bytesFreed;
      totalDuration += cleanup.duration;
      
      if (!stats.lastCleanup || cleanup.startTime > stats.lastCleanup) {
        stats.lastCleanup = cleanup.startTime;
      }
      
      // Bucket-specific stats
      if (!stats.bucketStats[cleanup.bucketId]) {
        stats.bucketStats[cleanup.bucketId] = {
          cleanups: 0,
          filesDeleted: 0,
          bytesFreed: 0,
          errors: 0
        };
      }
      
      const bucketStat = stats.bucketStats[cleanup.bucketId];
      bucketStat.cleanups++;
      bucketStat.filesDeleted += cleanup.filesDeleted;
      bucketStat.bytesFreed += cleanup.bytesFreed;
      bucketStat.errors += cleanup.errors.length;
    });

    stats.averageCleanupTime = totalDuration / this.cleanupHistory.length;

    return stats;
  }

  /**
   * Add cleanup result to history
   * @param {Object} result - Cleanup result
   */
  addToHistory(result) {
    this.cleanupHistory.push(result);
    
    // Keep only the last N entries
    if (this.cleanupHistory.length > this.maxHistoryEntries) {
      this.cleanupHistory.shift();
    }
  }

  /**
   * Get cleanup history
   * @param {number} limit - Number of entries to return
   * @returns {Array} Cleanup history
   */
  getCleanupHistory(limit = 10) {
    return this.cleanupHistory
      .slice(-limit)
      .sort((a, b) => b.startTime - a.startTime);
  }

  /**
   * Update cleanup policy for a bucket
   * @param {string} bucketId - Bucket ID
   * @param {Object} newPolicy - New policy settings
   */
  updatePolicy(bucketId, newPolicy) {
    if (!this.policies[bucketId]) {
      throw new Error(`No policy exists for bucket: ${bucketId}`);
    }

    this.policies[bucketId] = { ...this.policies[bucketId], ...newPolicy };
    
    // Reschedule cleanup with new policy
    this.scheduleCleanup(bucketId);
    
    console.log(`Updated cleanup policy for ${bucketId}:`, this.policies[bucketId]);
  }

  /**
   * Get current policies
   * @returns {Object} Current cleanup policies
   */
  getPolicies() {
    return { ...this.policies };
  }

  /**
   * Manually trigger cleanup for a bucket
   * @param {string} bucketId - Bucket ID
   * @returns {Promise<Object>} Cleanup result
   */
  async manualCleanup(bucketId) {
    if (!this.policies[bucketId]) {
      throw new Error(`No policy exists for bucket: ${bucketId}`);
    }

    console.log(`Manual cleanup triggered for ${bucketId}`);
    return await this.cleanupBucket(bucketId);
  }

  /**
   * Manually trigger cleanup for all buckets
   * @returns {Promise<Array>} Array of cleanup results
   */
  async manualCleanupAll() {
    console.log('Manual cleanup triggered for all buckets');
    
    const results = [];
    
    for (const bucketId of Object.keys(this.policies)) {
      try {
        const result = await this.cleanupBucket(bucketId);
        results.push(result);
      } catch (error) {
        results.push({
          bucketId,
          error: error.message,
          filesDeleted: 0,
          bytesFreed: 0
        });
      }
    }

    return results;
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
   * Stop all cleanup schedules
   */
  stop() {
    console.log('Stopping file cleanup manager...');
    
    this.cleanupIntervals.forEach((intervalId, bucketId) => {
      clearInterval(intervalId);
      console.log(`Stopped cleanup schedule for ${bucketId}`);
    });
    
    this.cleanupIntervals.clear();
  }

  /**
   * Restart cleanup schedules
   */
  restart() {
    console.log('Restarting file cleanup manager...');
    this.stop();
    this.init();
  }

  /**
   * Get current status
   * @returns {Object} Current status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      scheduledBuckets: Array.from(this.cleanupIntervals.keys()),
      policies: this.getPolicies(),
      stats: this.getCleanupStats(),
      recentHistory: this.getCleanupHistory(5)
    };
  }
}

// Create singleton instance
export const fileCleanupManager = new FileCleanupManager();

// Make available globally
window.fileCleanupManager = fileCleanupManager;
window.FileCleanupManager = FileCleanupManager;