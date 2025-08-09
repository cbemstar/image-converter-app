/**
 * FileManager - Comprehensive file storage system with quota enforcement
 * Handles file uploads, downloads, management, and secure sharing
 */

class FileManager {
  constructor(authManager, quotaManager, supabaseClient) {
    this.authManager = authManager || window.authManager;
    this.quotaManager = quotaManager || window.quotaManager;
    this.supabase = supabaseClient?.getClient() || window.supabaseClient?.getClient();
    
    this.fileListeners = [];
    this.uploadQueue = [];
    this.isUploading = false;
    this.maxConcurrentUploads = 3;
    this.chunkSize = 1024 * 1024; // 1MB chunks
    this.retryAttempts = 3;
    
    this.supportedTypes = window.APP_CONFIG?.SUPPORTED_FILE_TYPES || {
      'image-converter': [
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'image/bmp', 'image/tiff', 'image/avif', 'image/heic',
        'image/heif', 'image/x-icon'
      ],
      'pdf-merger': ['application/pdf'],
      'pdf-ocr': ['application/pdf'],
      'background-remover': ['image/jpeg', 'image/png', 'image/webp'],
      'json-formatter': ['application/json', 'text/plain'],
      'default': ['*/*']
    };

    this.isInitialized = false;
    this.initialize();
  }

  /**
   * Initialize the file manager
   */
  async initialize() {
    try {
      if (!this.supabase) {
        console.error('FileManager: Supabase client not available');
        return;
      }

      // Listen for auth state changes
      if (this.authManager) {
        this.authManager.addAuthStateListener((event, session) => {
          this.handleAuthStateChange(event, session);
        });
      }

      this.isInitialized = true;
      
    } catch (error) {
      console.error('FileManager initialization error:', error);
    }
  }

  /**
   * Handle authentication state changes
   */
  handleAuthStateChange(event, session) {
    switch (event) {
      case 'SIGNED_OUT':
        this.clearFileData();
        break;
    }
  }

  /**
   * Upload file with quota enforcement
   */
  async uploadFile(file, toolType, options = {}) {
    try {
      const {
        onProgress = null,
        metadata = {},
        generateThumbnail = false,
        customPath = null
      } = options;

      // Validate authentication
      const user = this.authManager?.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Validate file
      this.validateFile(file, toolType);

      // Check quota before upload
      const quotaCheck = await this.quotaManager?.checkStorageQuota(file.size);
      if (!quotaCheck?.allowed) {
        const error = new Error('Storage quota exceeded');
        error.quotaError = true;
        error.quotaData = quotaCheck;
        throw error;
      }

      // Generate file path
      const filePath = customPath || this.generateFilePath(user.id, file.name, toolType);

      // Upload to Supabase Storage
      const uploadResult = await this.performUpload(file, filePath, onProgress);

      // Create database record
      const fileRecord = await this.createFileRecord({
        user_id: user.id,
        filename: file.name,
        file_size: file.size,
        file_type: file.type,
        tool_type: toolType,
        storage_path: filePath,
        metadata: metadata
      });

      // Update quota usage
      if (this.quotaManager) {
        await this.quotaManager.updateStorageUsage(file.size);
      }

      // Generate thumbnail if requested
      if (generateThumbnail && this.isImageFile(file)) {
        try {
          const thumbnail = await this.generateThumbnail(file);
          const thumbnailPath = this.generateThumbnailPath(filePath);
          await this.performUpload(thumbnail, thumbnailPath);
          
          // Update record with thumbnail path
          await this.updateFileRecord(fileRecord.id, {
            thumbnail_path: thumbnailPath
          });
        } catch (thumbnailError) {
          console.warn('Thumbnail generation failed:', thumbnailError);
        }
      }

      this.notifyFileListeners('file_uploaded', {
        file: fileRecord,
        originalFile: file
      });

      return {
        success: true,
        file: fileRecord,
        url: uploadResult.publicUrl
      };

    } catch (error) {
      console.error('File upload error:', error);
      
      if (error.quotaError) {
        this.handleQuotaError(error);
      }
      
      throw error;
    }
  }

  /**
   * Perform the actual file upload
   */
  async performUpload(file, filePath, onProgress = null) {
    try {
      const uploadOptions = {
        cacheControl: '3600',
        upsert: false
      };

      // For large files, use resumable upload
      if (file.size > this.chunkSize) {
        return await this.resumableUpload(file, filePath, onProgress);
      }

      // Regular upload for smaller files
      const { data, error } = await this.supabase.storage
        .from('user-files')
        .upload(filePath, file, uploadOptions);

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = this.supabase.storage
        .from('user-files')
        .getPublicUrl(filePath);

      return {
        data,
        publicUrl
      };

    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  }

  /**
   * Resumable upload for large files
   */
  async resumableUpload(file, filePath, onProgress = null) {
    const chunks = Math.ceil(file.size / this.chunkSize);
    let uploadedBytes = 0;

    for (let i = 0; i < chunks; i++) {
      const start = i * this.chunkSize;
      const end = Math.min(start + this.chunkSize, file.size);
      const chunk = file.slice(start, end);
      
      const chunkPath = `${filePath}.part${i}`;
      
      let retries = 0;
      while (retries < this.retryAttempts) {
        try {
          await this.supabase.storage
            .from('user-files')
            .upload(chunkPath, chunk, { upsert: true });
          
          uploadedBytes += chunk.size;
          
          if (onProgress) {
            onProgress({
              loaded: uploadedBytes,
              total: file.size,
              percentage: (uploadedBytes / file.size) * 100
            });
          }
          
          break;
        } catch (error) {
          retries++;
          if (retries >= this.retryAttempts) {
            throw error;
          }
          await this.delay(1000 * retries); // Exponential backoff
        }
      }
    }

    // Combine chunks (this would typically be done server-side)
    // For now, we'll upload the complete file
    const { data, error } = await this.supabase.storage
      .from('user-files')
      .upload(filePath, file, { upsert: true });

    if (error) throw error;

    // Clean up chunk files
    for (let i = 0; i < chunks; i++) {
      const chunkPath = `${filePath}.part${i}`;
      await this.supabase.storage
        .from('user-files')
        .remove([chunkPath]);
    }

    const { data: { publicUrl } } = this.supabase.storage
      .from('user-files')
      .getPublicUrl(filePath);

    return { data, publicUrl };
  }

  /**
   * Download file
   */
  async downloadFile(fileId, options = {}) {
    try {
      const { saveAs = null, onProgress = null } = options;

      // Get file record
      const fileRecord = await this.getFileRecord(fileId);
      if (!fileRecord) {
        throw new Error('File not found');
      }

      // Check permissions
      const user = this.authManager?.getCurrentUser();
      if (!user || fileRecord.user_id !== user.id) {
        throw new Error('Access denied');
      }

      // Download from storage
      const { data, error } = await this.supabase.storage
        .from('user-files')
        .download(fileRecord.storage_path);

      if (error) throw error;

      // Create download
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = saveAs || fileRecord.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.notifyFileListeners('file_downloaded', { file: fileRecord });

      return {
        success: true,
        file: fileRecord
      };

    } catch (error) {
      console.error('File download error:', error);
      throw error;
    }
  }

  /**
   * Delete file with quota recalculation
   */
  async deleteFile(fileId) {
    try {
      // Get file record
      const fileRecord = await this.getFileRecord(fileId);
      if (!fileRecord) {
        throw new Error('File not found');
      }

      // Check permissions
      const user = this.authManager?.getCurrentUser();
      if (!user || fileRecord.user_id !== user.id) {
        throw new Error('Access denied');
      }

      // Delete from storage
      const { error: storageError } = await this.supabase.storage
        .from('user-files')
        .remove([fileRecord.storage_path]);

      if (storageError) {
        console.warn('Storage deletion error:', storageError);
      }

      // Delete thumbnail if exists
      if (fileRecord.thumbnail_path) {
        await this.supabase.storage
          .from('user-files')
          .remove([fileRecord.thumbnail_path]);
      }

      // Delete database record
      const { error: dbError } = await this.supabase
        .from('user_files')
        .delete()
        .eq('id', fileId);

      if (dbError) throw dbError;

      // Update quota usage
      if (this.quotaManager) {
        await this.quotaManager.updateStorageUsage(-fileRecord.file_size);
      }

      this.notifyFileListeners('file_deleted', { file: fileRecord });

      return {
        success: true,
        file: fileRecord
      };

    } catch (error) {
      console.error('File deletion error:', error);
      throw error;
    }
  }

  /**
   * List user files with filtering and pagination
   */
  async listUserFiles(options = {}) {
    try {
      const {
        toolType = null,
        limit = 50,
        offset = 0,
        sortBy = 'created_at',
        sortOrder = 'desc',
        search = null
      } = options;

      const user = this.authManager?.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      let query = this.supabase
        .from('user_files')
        .select('*')
        .eq('user_id', user.id);

      // Apply filters
      if (toolType) {
        query = query.eq('tool_type', toolType);
      }

      if (search) {
        query = query.ilike('filename', `%${search}%`);
      }

      // Apply sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Apply pagination
      if (limit) {
        query = query.range(offset, offset + limit - 1);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        files: data || [],
        total: data?.length || 0
      };

    } catch (error) {
      console.error('Error listing files:', error);
      throw error;
    }
  }

  /**
   * Generate secure sharing URL with expiration
   */
  async generateShareUrl(fileId, options = {}) {
    try {
      const {
        expiresIn = 3600, // 1 hour default
        allowDownload = true,
        password = null
      } = options;

      // Get file record
      const fileRecord = await this.getFileRecord(fileId);
      if (!fileRecord) {
        throw new Error('File not found');
      }

      // Check permissions
      const user = this.authManager?.getCurrentUser();
      if (!user || fileRecord.user_id !== user.id) {
        throw new Error('Access denied');
      }

      // Generate signed URL
      const { data, error } = await this.supabase.storage
        .from('user-files')
        .createSignedUrl(fileRecord.storage_path, expiresIn);

      if (error) throw error;

      // Update file record with sharing info
      const expiresAt = new Date(Date.now() + expiresIn * 1000);
      await this.updateFileRecord(fileId, {
        is_shared: true,
        share_expires_at: expiresAt.toISOString()
      });

      this.notifyFileListeners('file_shared', {
        file: fileRecord,
        shareUrl: data.signedUrl,
        expiresAt
      });

      return {
        success: true,
        shareUrl: data.signedUrl,
        expiresAt: expiresAt
      };

    } catch (error) {
      console.error('Error generating share URL:', error);
      throw error;
    }
  }

  /**
   * Revoke file sharing
   */
  async revokeSharing(fileId) {
    try {
      // Update file record
      await this.updateFileRecord(fileId, {
        is_shared: false,
        share_expires_at: null
      });

      this.notifyFileListeners('sharing_revoked', { fileId });

      return { success: true };

    } catch (error) {
      console.error('Error revoking sharing:', error);
      throw error;
    }
  }

  /**
   * Get file metadata and info
   */
  async getFileInfo(fileId) {
    try {
      const fileRecord = await this.getFileRecord(fileId);
      if (!fileRecord) {
        throw new Error('File not found');
      }

      // Check permissions
      const user = this.authManager?.getCurrentUser();
      if (!user || fileRecord.user_id !== user.id) {
        throw new Error('Access denied');
      }

      // Get additional metadata
      const metadata = {
        ...fileRecord,
        formattedSize: this.formatFileSize(fileRecord.file_size),
        isImage: this.isImageFile({ type: fileRecord.file_type }),
        canPreview: this.canPreviewFile(fileRecord.file_type),
        isShared: fileRecord.is_shared && 
                 fileRecord.share_expires_at && 
                 new Date(fileRecord.share_expires_at) > new Date()
      };

      return metadata;

    } catch (error) {
      console.error('Error getting file info:', error);
      throw error;
    }
  }

  /**
   * Validate file before upload
   */
  validateFile(file, toolType) {
    // Check file size
    if (!file || file.size === 0) {
      throw new Error('Invalid file');
    }

    // Check file type
    const supportedTypes = this.supportedTypes[toolType] || this.supportedTypes.default;
    if (!supportedTypes.includes('*/*') && !supportedTypes.includes(file.type)) {
      throw new Error(`File type ${file.type} not supported for ${toolType}`);
    }

    // Check plan-specific file size limits
    const profile = this.authManager?.getCurrentUser();
    const planLimits = this.quotaManager?.getCurrentPlanLimits();
    
    if (planLimits && file.size > planLimits.maxFileSize) {
      const error = new Error(`File size exceeds ${this.formatFileSize(planLimits.maxFileSize)} limit for your plan`);
      error.fileSizeError = true;
      error.maxSize = planLimits.maxFileSize;
      throw error;
    }

    return true;
  }

  /**
   * Generate file path
   */
  generateFilePath(userId, filename, toolType) {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    const extension = filename.split('.').pop();
    const baseName = filename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_');
    
    return `${userId}/${toolType}/${timestamp}_${randomId}_${baseName}.${extension}`;
  }

  /**
   * Generate thumbnail path
   */
  generateThumbnailPath(originalPath) {
    const pathParts = originalPath.split('.');
    pathParts[pathParts.length - 2] += '_thumb';
    return pathParts.join('.');
  }

  /**
   * Generate thumbnail for image files
   */
  async generateThumbnail(file, maxSize = 200) {
    return new Promise((resolve, reject) => {
      if (!this.isImageFile(file)) {
        reject(new Error('File is not an image'));
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate thumbnail dimensions
        const { width, height } = this.calculateThumbnailSize(
          img.width, 
          img.height, 
          maxSize
        );

        canvas.width = width;
        canvas.height = height;

        // Draw thumbnail
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to generate thumbnail'));
          }
        }, 'image/jpeg', 0.8);
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Calculate thumbnail dimensions
   */
  calculateThumbnailSize(originalWidth, originalHeight, maxSize) {
    const aspectRatio = originalWidth / originalHeight;
    
    if (originalWidth > originalHeight) {
      return {
        width: maxSize,
        height: Math.round(maxSize / aspectRatio)
      };
    } else {
      return {
        width: Math.round(maxSize * aspectRatio),
        height: maxSize
      };
    }
  }

  /**
   * Create file record in database
   */
  async createFileRecord(fileData) {
    try {
      const { data, error } = await this.supabase
        .from('user_files')
        .insert({
          ...fileData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      return data;

    } catch (error) {
      console.error('Error creating file record:', error);
      throw error;
    }
  }

  /**
   * Update file record
   */
  async updateFileRecord(fileId, updates) {
    try {
      const { data, error } = await this.supabase
        .from('user_files')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', fileId)
        .select()
        .single();

      if (error) throw error;

      return data;

    } catch (error) {
      console.error('Error updating file record:', error);
      throw error;
    }
  }

  /**
   * Get file record from database
   */
  async getFileRecord(fileId) {
    try {
      const { data, error } = await this.supabase
        .from('user_files')
        .select('*')
        .eq('id', fileId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;

    } catch (error) {
      console.error('Error getting file record:', error);
      throw error;
    }
  }

  /**
   * Check if file is an image
   */
  isImageFile(file) {
    const imageTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'image/bmp', 'image/tiff', 'image/avif', 'image/heic',
      'image/heif', 'image/x-icon'
    ];
    return imageTypes.includes(file.type);
  }

  /**
   * Check if file can be previewed
   */
  canPreviewFile(fileType) {
    const previewableTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'image/bmp', 'image/tiff', 'image/avif', 'image/x-icon',
      'application/pdf', 'text/plain', 'application/json'
    ];
    return previewableTypes.includes(fileType);
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Handle quota errors
   */
  handleQuotaError(error) {
    if (error.quotaData) {
      const { current, limit, error: quotaErrorType } = error.quotaData;
      
      if (quotaErrorType === 'FILE_TOO_LARGE') {
        this.showQuotaError(
          'File Too Large',
          `This file exceeds the ${this.formatFileSize(error.quotaData.maxFileSize)} limit for your plan. Upgrade to upload larger files.`
        );
      } else {
        this.showQuotaError(
          'Storage Quota Exceeded',
          `You've used ${this.formatFileSize(current)} of ${this.formatFileSize(limit)} storage. Upgrade to get more space.`
        );
      }
    }
  }

  /**
   * Show quota error to user
   */
  showQuotaError(title, message) {
    // Try to use existing notification system
    if (window.quotaNotifications) {
      window.quotaNotifications.showNotification({
        type: 'exceeded',
        title: title,
        message: message,
        actions: [{
          text: 'Upgrade Now',
          icon: 'fas fa-crown',
          class: 'quota-notification-btn-primary',
          action: () => window.location.href = '/pricing.html'
        }]
      });
    } else {
      alert(`${title}: ${message}`);
    }
  }

  /**
   * Clear file data on sign out
   */
  clearFileData() {
    this.uploadQueue = [];
    this.isUploading = false;
    this.notifyFileListeners('files_cleared', {});
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Add file change listener
   */
  addFileListener(callback) {
    this.fileListeners.push(callback);
  }

  /**
   * Remove file change listener
   */
  removeFileListener(callback) {
    this.fileListeners = this.fileListeners.filter(listener => listener !== callback);
  }

  /**
   * Notify all file listeners
   */
  notifyFileListeners(event, data) {
    this.fileListeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error in file listener:', error);
      }
    });
  }
}

// Global utility functions
window.uploadFile = async function(file, toolType, options = {}) {
  if (!window.fileManager) {
    throw new Error('FileManager not available');
  }
  return await window.fileManager.uploadFile(file, toolType, options);
};

window.downloadFile = async function(fileId, options = {}) {
  if (!window.fileManager) {
    throw new Error('FileManager not available');
  }
  return await window.fileManager.downloadFile(fileId, options);
};

window.deleteFile = async function(fileId) {
  if (!window.fileManager) {
    throw new Error('FileManager not available');
  }
  return await window.fileManager.deleteFile(fileId);
};

window.listUserFiles = async function(options = {}) {
  if (!window.fileManager) {
    throw new Error('FileManager not available');
  }
  return await window.fileManager.listUserFiles(options);
};

// Create global instance when dependencies are available
if (typeof window !== 'undefined') {
  window.addEventListener('supabase-auth-change', () => {
    if (window.authManager && window.quotaManager && window.supabaseClient && !window.fileManager) {
      window.fileManager = new FileManager(window.authManager, window.quotaManager, window.supabaseClient);
    }
  });

  // Initialize immediately if dependencies are already available
  if (window.authManager && window.quotaManager && window.supabaseClient) {
    window.fileManager = new FileManager(window.authManager, window.quotaManager, window.supabaseClient);
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FileManager;
}