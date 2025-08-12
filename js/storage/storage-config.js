/**
 * Supabase Storage Configuration
 * 
 * Configures storage buckets and policies for secure file handling
 * Requirements: 14.1, 14.2, 14.7, 14.8
 */

import { supabase } from '../auth/supabase-client.js';

// Storage bucket configurations
export const STORAGE_BUCKETS = {
  USER_UPLOADS: 'user-uploads',
  CONVERTED_FILES: 'converted-files', 
  TEMP_PROCESSING: 'temp-processing'
};

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
  USER_UPLOADS: 52428800,    // 50MB
  CONVERTED_FILES: 52428800, // 50MB
  TEMP_PROCESSING: 104857600 // 100MB
};

// Supported MIME types
export const SUPPORTED_MIME_TYPES = {
  IMAGES: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/bmp',
    'image/tiff',
    'image/avif',
    'image/heic',
    'image/heif'
  ],
  RAW_FORMATS: [
    'image/x-canon-cr2',
    'image/x-canon-crw',
    'image/x-nikon-nef',
    'image/x-sony-arw',
    'image/x-adobe-dng',
    'image/x-fuji-raf',
    'image/x-olympus-orf',
    'image/x-panasonic-rw2',
    'image/x-pentax-pef',
    'image/x-samsung-srw'
  ],
  ARCHIVES: [
    'application/zip'
  ],
  PROCESSING: [
    'application/octet-stream'
  ]
};

// Get all supported MIME types for a bucket
export function getSupportedMimeTypes(bucketId) {
  switch (bucketId) {
    case STORAGE_BUCKETS.USER_UPLOADS:
      return [
        ...SUPPORTED_MIME_TYPES.IMAGES,
        ...SUPPORTED_MIME_TYPES.RAW_FORMATS
      ];
    case STORAGE_BUCKETS.CONVERTED_FILES:
      return [
        ...SUPPORTED_MIME_TYPES.IMAGES,
        ...SUPPORTED_MIME_TYPES.ARCHIVES
      ];
    case STORAGE_BUCKETS.TEMP_PROCESSING:
      return [
        ...SUPPORTED_MIME_TYPES.IMAGES,
        ...SUPPORTED_MIME_TYPES.RAW_FORMATS,
        ...SUPPORTED_MIME_TYPES.ARCHIVES,
        ...SUPPORTED_MIME_TYPES.PROCESSING
      ];
    default:
      return [];
  }
}

// File retention policies (in hours)
export const RETENTION_POLICIES = {
  USER_UPLOADS: 24,      // 24 hours
  CONVERTED_FILES: 168,  // 7 days
  TEMP_PROCESSING: 1     // 1 hour
};

/**
 * Storage utility class for managing file operations
 */
export class StorageManager {
  constructor() {
    this.supabase = supabase;
  }

  /**
   * Generate a user-specific file path
   * @param {string} userId - User ID
   * @param {string} filename - Original filename
   * @param {string} prefix - Optional prefix
   * @returns {string} User-specific file path
   */
  generateUserFilePath(userId, filename, prefix = '') {
    const timestamp = Date.now();
    const sanitizedFilename = this.sanitizeFilename(filename);
    const pathPrefix = prefix ? `${prefix}/` : '';
    
    return `${userId}/${pathPrefix}${timestamp}_${sanitizedFilename}`;
  }

  /**
   * Sanitize filename for safe storage
   * @param {string} filename - Original filename
   * @returns {string} Sanitized filename
   */
  sanitizeFilename(filename) {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
      .replace(/_{2,}/g, '_')          // Replace multiple underscores with single
      .replace(/^_|_$/g, '')           // Remove leading/trailing underscores
      .toLowerCase();
  }

  /**
   * Validate file before upload
   * @param {File} file - File to validate
   * @param {string} bucketId - Target bucket ID
   * @returns {Object} Validation result
   */
  validateFile(file, bucketId) {
    const errors = [];
    const warnings = [];

    // Check file size
    const sizeLimit = FILE_SIZE_LIMITS[bucketId.toUpperCase().replace('-', '_')];
    if (file.size > sizeLimit) {
      errors.push(`File size ${this.formatFileSize(file.size)} exceeds limit of ${this.formatFileSize(sizeLimit)}`);
    }

    // Check MIME type
    const supportedTypes = getSupportedMimeTypes(bucketId);
    if (!supportedTypes.includes(file.type)) {
      // Check by file extension as fallback
      const extension = file.name.split('.').pop().toLowerCase();
      const isRawFile = this.isRawFileExtension(extension);
      const isHeicFile = this.isHeicFileExtension(extension);
      
      if (!isRawFile && !isHeicFile) {
        errors.push(`File type ${file.type} is not supported for bucket ${bucketId}`);
      } else {
        warnings.push(`File type detected by extension: ${extension}`);
      }
    }

    // Check filename
    if (file.name.length > 255) {
      errors.push('Filename is too long (max 255 characters)');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check if file extension is a RAW format
   * @param {string} extension - File extension
   * @returns {boolean} True if RAW format
   */
  isRawFileExtension(extension) {
    const rawExtensions = ['cr2', 'crw', 'nef', 'arw', 'dng', 'raf', 'orf', 'rw2', 'pef', 'srw'];
    return rawExtensions.includes(extension);
  }

  /**
   * Check if file extension is HEIC/HEIF
   * @param {string} extension - File extension
   * @returns {boolean} True if HEIC/HEIF format
   */
  isHeicFileExtension(extension) {
    return ['heic', 'heif'].includes(extension);
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
   * Generate signed URL for file download
   * @param {string} bucketId - Bucket ID
   * @param {string} filePath - File path
   * @param {number} expiresIn - Expiration time in seconds (default: 1 hour)
   * @returns {Promise<string>} Signed URL
   */
  async generateSignedUrl(bucketId, filePath, expiresIn = 3600) {
    try {
      const { data, error } = await this.supabase.storage
        .from(bucketId)
        .createSignedUrl(filePath, expiresIn);

      if (error) {
        throw new Error(`Failed to generate signed URL: ${error.message}`);
      }

      return data.signedUrl;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      throw error;
    }
  }

  /**
   * Generate signed upload URL
   * @param {string} bucketId - Bucket ID
   * @param {string} filePath - File path
   * @param {number} expiresIn - Expiration time in seconds (default: 1 hour)
   * @returns {Promise<string>} Signed upload URL
   */
  async generateSignedUploadUrl(bucketId, filePath, expiresIn = 3600) {
    try {
      // Validate that user can upload to this path
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) {
        throw new Error('Authentication required for upload');
      }

      // Ensure file path starts with user's folder
      const userFolder = `${user.id}/`;
      if (!filePath.startsWith(userFolder)) {
        throw new Error('File path must start with user folder');
      }

      const { data, error } = await this.supabase.storage
        .from(bucketId)
        .createSignedUploadUrl(filePath, {
          upsert: false // Don't allow overwriting existing files
        });

      if (error) {
        throw new Error(`Failed to generate signed upload URL: ${error.message}`);
      }

      return data.signedUrl;
    } catch (error) {
      console.error('Error generating signed upload URL:', error);
      throw error;
    }
  }

  /**
   * Upload file to storage
   * @param {string} bucketId - Bucket ID
   * @param {string} filePath - File path
   * @param {File} file - File to upload
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result
   */
  async uploadFile(bucketId, filePath, file, options = {}) {
    try {
      // Validate file
      const validation = this.validateFile(file, bucketId);
      if (!validation.valid) {
        throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
      }

      // Upload file
      const { data, error } = await this.supabase.storage
        .from(bucketId)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          ...options
        });

      if (error) {
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Record file metadata
      await this.recordFileMetadata({
        bucketId,
        filePath,
        originalName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        uploadCompleted: true
      });

      return {
        success: true,
        path: data.path,
        fullPath: data.fullPath,
        id: data.id
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  /**
   * Delete file from storage
   * @param {string} bucketId - Bucket ID
   * @param {string} filePath - File path
   * @returns {Promise<boolean>} Success status
   */
  async deleteFile(bucketId, filePath) {
    try {
      const { error } = await this.supabase.storage
        .from(bucketId)
        .remove([filePath]);

      if (error) {
        throw new Error(`Delete failed: ${error.message}`);
      }

      // Remove file metadata
      await this.removeFileMetadata(bucketId, filePath);

      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  /**
   * List user's files in a bucket
   * @param {string} bucketId - Bucket ID
   * @param {string} folder - Folder path (optional)
   * @returns {Promise<Array>} List of files
   */
  async listUserFiles(bucketId, folder = '') {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      const userFolder = folder ? `${user.id}/${folder}` : user.id;

      const { data, error } = await this.supabase.storage
        .from(bucketId)
        .list(userFolder, {
          limit: 100,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) {
        throw new Error(`Failed to list files: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error listing files:', error);
      throw error;
    }
  }

  /**
   * Record file metadata in database
   * @param {Object} metadata - File metadata
   * @returns {Promise<Object>} Metadata record
   */
  async recordFileMetadata(metadata) {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      const record = {
        user_id: user.id,
        bucket_id: metadata.bucketId,
        file_path: metadata.filePath,
        original_name: metadata.originalName,
        file_size: metadata.fileSize,
        mime_type: metadata.mimeType,
        file_hash: metadata.fileHash || null,
        upload_completed_at: metadata.uploadCompleted ? new Date().toISOString() : null,
        expires_at: this.calculateExpirationDate(metadata.bucketId),
        conversion_job_id: metadata.conversionJobId || null
      };

      const { data, error } = await this.supabase
        .from('file_metadata')
        .insert(record)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to record metadata: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error recording file metadata:', error);
      throw error;
    }
  }

  /**
   * Remove file metadata from database
   * @param {string} bucketId - Bucket ID
   * @param {string} filePath - File path
   * @returns {Promise<boolean>} Success status
   */
  async removeFileMetadata(bucketId, filePath) {
    try {
      const { error } = await this.supabase
        .from('file_metadata')
        .delete()
        .eq('bucket_id', bucketId)
        .eq('file_path', filePath);

      if (error) {
        throw new Error(`Failed to remove metadata: ${error.message}`);
      }

      return true;
    } catch (error) {
      console.error('Error removing file metadata:', error);
      throw error;
    }
  }

  /**
   * Calculate expiration date based on bucket retention policy
   * @param {string} bucketId - Bucket ID
   * @returns {string} ISO date string
   */
  calculateExpirationDate(bucketId) {
    const retentionHours = RETENTION_POLICIES[bucketId.toUpperCase().replace('-', '_')] || 24;
    const expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours() + retentionHours);
    return expirationDate.toISOString();
  }

  /**
   * Get file metadata
   * @param {string} bucketId - Bucket ID
   * @param {string} filePath - File path
   * @returns {Promise<Object>} File metadata
   */
  async getFileMetadata(bucketId, filePath) {
    try {
      const { data, error } = await this.supabase
        .from('file_metadata')
        .select('*')
        .eq('bucket_id', bucketId)
        .eq('file_path', filePath)
        .single();

      if (error) {
        throw new Error(`Failed to get metadata: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error getting file metadata:', error);
      throw error;
    }
  }

  /**
   * Clean up expired files
   * @returns {Promise<number>} Number of files cleaned up
   */
  async cleanupExpiredFiles() {
    try {
      // This would typically be called by a scheduled function
      const { data, error } = await this.supabase.rpc('cleanup_expired_files');

      if (error) {
        throw new Error(`Cleanup failed: ${error.message}`);
      }

      return data || 0;
    } catch (error) {
      console.error('Error cleaning up expired files:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const storageManager = new StorageManager();

// Make available globally
window.storageManager = storageManager;
window.StorageManager = StorageManager;