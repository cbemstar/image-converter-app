/**
 * Secure File Upload Component
 * 
 * Handles secure file uploads with validation, progress tracking, signed URLs, and rate limiting
 * Requirements: 14.1, 14.2, 14.3, 14.4, 10.1, 10.2, 10.3
 */

import { storageManager, STORAGE_BUCKETS } from '../storage/storage-config.js';

export class SecureFileUpload {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      bucketId: STORAGE_BUCKETS.USER_UPLOADS,
      allowMultiple: true,
      maxFiles: 10,
      showProgress: true,
      showPreview: true,
      autoUpload: false,
      onUploadStart: null,
      onUploadProgress: null,
      onUploadComplete: null,
      onUploadError: null,
      onFileValidation: null,
      ...options
    };
    
    if (!this.container) {
      console.error(`SecureFileUpload: Container with id "${containerId}" not found`);
      return;
    }
    
    this.files = [];
    this.uploadQueue = [];
    this.isUploading = false;
    this.uploadedFiles = [];
    
    this.init();
  }

  /**
   * Initialize the upload component
   */
  init() {
    this.render();
    this.attachEventListeners();
  }

  /**
   * Render the upload interface
   */
  render() {
    this.container.innerHTML = `
      <div class="secure-file-upload">
        <div class="upload-area ${this.isUploading ? 'uploading' : ''}" id="upload-drop-area">
          <div class="upload-content">
            <div class="upload-icon">
              <i class="fas fa-cloud-upload-alt"></i>
            </div>
            <div class="upload-text">
              <h3>Drop files here or click to browse</h3>
              <p>Supported formats: JPEG, PNG, WebP, GIF, BMP, TIFF, AVIF, HEIC, RAW</p>
              <p class="upload-limits">Max file size: 50MB • Max ${this.options.maxFiles} files</p>
            </div>
            <input type="file" 
                   id="file-input" 
                   ${this.options.allowMultiple ? 'multiple' : ''} 
                   accept="image/*,.cr2,.nef,.arw,.dng,.raf,.orf,.rw2,.pef,.srw,.heic,.heif"
                   style="display: none;">
            <button class="btn btn-primary browse-btn" type="button">
              <i class="fas fa-folder-open"></i>
              Browse Files
            </button>
          </div>
          
          <div class="upload-progress" style="display: none;">
            <div class="progress-info">
              <span class="progress-text">Uploading files...</span>
              <span class="progress-percentage">0%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: 0%"></div>
            </div>
          </div>
        </div>
        
        <div class="file-list" id="file-list" style="display: none;">
          <div class="file-list-header">
            <h4>Selected Files</h4>
            <div class="file-actions">
              <button class="btn btn-secondary btn-sm clear-btn">
                <i class="fas fa-times"></i>
                Clear All
              </button>
              <button class="btn btn-primary btn-sm upload-btn" ${this.options.autoUpload ? 'style="display: none;"' : ''}>
                <i class="fas fa-upload"></i>
                Upload Files
              </button>
            </div>
          </div>
          <div class="file-items" id="file-items"></div>
        </div>
        
        <div class="uploaded-files" id="uploaded-files" style="display: none;">
          <div class="uploaded-header">
            <h4>Uploaded Files</h4>
            <div class="uploaded-actions">
              <button class="btn btn-secondary btn-sm refresh-btn">
                <i class="fas fa-sync-alt"></i>
                Refresh
              </button>
            </div>
          </div>
          <div class="uploaded-items" id="uploaded-items"></div>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    const dropArea = this.container.querySelector('#upload-drop-area');
    const fileInput = this.container.querySelector('#file-input');
    const browseBtn = this.container.querySelector('.browse-btn');
    const uploadBtn = this.container.querySelector('.upload-btn');
    const clearBtn = this.container.querySelector('.clear-btn');
    const refreshBtn = this.container.querySelector('.refresh-btn');

    // File input change
    fileInput.addEventListener('change', (e) => {
      this.handleFileSelection(e.target.files);
    });

    // Browse button click
    browseBtn.addEventListener('click', () => {
      fileInput.click();
    });

    // Upload button click
    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => {
        this.startUpload();
      });
    }

    // Clear button click
    clearBtn.addEventListener('click', () => {
      this.clearFiles();
    });

    // Refresh button click
    refreshBtn.addEventListener('click', () => {
      this.loadUploadedFiles();
    });

    // Drag and drop events
    dropArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropArea.classList.add('drag-over');
    });

    dropArea.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropArea.classList.remove('drag-over');
    });

    dropArea.addEventListener('drop', (e) => {
      e.preventDefault();
      dropArea.classList.remove('drag-over');
      this.handleFileSelection(e.dataTransfer.files);
    });

    // Click to browse
    dropArea.addEventListener('click', (e) => {
      if (e.target === dropArea || e.target.closest('.upload-content')) {
        fileInput.click();
      }
    });
  }

  /**
   * Handle file selection
   * @param {FileList} files - Selected files
   */
  handleFileSelection(files) {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    
    // Check file count limit
    if (this.files.length + fileArray.length > this.options.maxFiles) {
      this.showError(`Maximum ${this.options.maxFiles} files allowed`);
      return;
    }

    // Validate and add files
    const validFiles = [];
    const errors = [];

    fileArray.forEach(file => {
      const validation = storageManager.validateFile(file, this.options.bucketId);
      
      if (validation.valid) {
        validFiles.push({
          file,
          id: this.generateFileId(),
          status: 'pending',
          progress: 0,
          error: null,
          warnings: validation.warnings
        });
      } else {
        errors.push(`${file.name}: ${validation.errors.join(', ')}`);
      }

      // Call validation callback if provided
      if (this.options.onFileValidation) {
        this.options.onFileValidation(file, validation);
      }
    });

    if (errors.length > 0) {
      this.showError(`File validation errors:\n${errors.join('\n')}`);
    }

    if (validFiles.length > 0) {
      this.files.push(...validFiles);
      this.renderFileList();
      
      // Auto-upload if enabled
      if (this.options.autoUpload) {
        this.startUpload();
      }
    }
  }

  /**
   * Generate unique file ID
   * @returns {string} Unique file ID
   */
  generateFileId() {
    return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Render file list
   */
  renderFileList() {
    const fileList = this.container.querySelector('#file-list');
    const fileItems = this.container.querySelector('#file-items');

    if (this.files.length === 0) {
      fileList.style.display = 'none';
      return;
    }

    fileList.style.display = 'block';
    fileItems.innerHTML = this.files.map(fileData => this.renderFileItem(fileData)).join('');
  }

  /**
   * Render individual file item
   * @param {Object} fileData - File data object
   * @returns {string} HTML for file item
   */
  renderFileItem(fileData) {
    const { file, id, status, progress, error, warnings } = fileData;
    const statusIcon = this.getStatusIcon(status);
    const statusClass = `status-${status}`;

    return `
      <div class="file-item ${statusClass}" data-file-id="${id}">
        <div class="file-info">
          ${this.options.showPreview ? this.renderFilePreview(file) : ''}
          <div class="file-details">
            <div class="file-name">${file.name}</div>
            <div class="file-meta">
              <span class="file-size">${storageManager.formatFileSize(file.size)}</span>
              <span class="file-type">${file.type || 'Unknown'}</span>
            </div>
            ${warnings && warnings.length > 0 ? `
              <div class="file-warnings">
                ${warnings.map(warning => `<span class="warning">${warning}</span>`).join('')}
              </div>
            ` : ''}
            ${error ? `<div class="file-error">${error}</div>` : ''}
          </div>
        </div>
        
        <div class="file-status">
          <div class="status-icon">${statusIcon}</div>
          ${status === 'uploading' ? `
            <div class="file-progress">
              <div class="progress-bar-mini">
                <div class="progress-fill-mini" style="width: ${progress}%"></div>
              </div>
              <span class="progress-text">${progress}%</span>
            </div>
          ` : ''}
        </div>
        
        <div class="file-actions">
          ${status === 'pending' ? `
            <button class="btn btn-sm btn-secondary remove-btn" data-file-id="${id}">
              <i class="fas fa-times"></i>
            </button>
          ` : ''}
          ${status === 'completed' ? `
            <button class="btn btn-sm btn-primary download-btn" data-file-id="${id}">
              <i class="fas fa-download"></i>
            </button>
          ` : ''}
          ${status === 'error' ? `
            <button class="btn btn-sm btn-secondary retry-btn" data-file-id="${id}">
              <i class="fas fa-redo"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Render file preview
   * @param {File} file - File object
   * @returns {string} HTML for file preview
   */
  renderFilePreview(file) {
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      return `
        <div class="file-preview">
          <img src="${url}" alt="Preview" onload="URL.revokeObjectURL(this.src)">
        </div>
      `;
    }
    
    return `
      <div class="file-preview file-icon">
        <i class="fas fa-file-image"></i>
      </div>
    `;
  }

  /**
   * Get status icon for file
   * @param {string} status - File status
   * @returns {string} HTML for status icon
   */
  getStatusIcon(status) {
    const icons = {
      pending: '<i class="fas fa-clock text-muted"></i>',
      uploading: '<i class="fas fa-spinner fa-spin text-primary"></i>',
      completed: '<i class="fas fa-check-circle text-success"></i>',
      error: '<i class="fas fa-exclamation-circle text-danger"></i>'
    };
    
    return icons[status] || icons.pending;
  }

  /**
   * Start file upload process
   */
  async startUpload() {
    if (this.isUploading) return;
    
    const pendingFiles = this.files.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) {
      this.showError('No files to upload');
      return;
    }

    // Check rate limits before starting upload
    if (window.rateLimitHandler && window.rateLimitHandler.isRateLimited('upload')) {
      const timeUntilReset = window.rateLimitHandler.getTimeUntilReset('upload');
      this.showError(`Upload rate limit exceeded. Please wait ${Math.ceil(timeUntilReset / 60)} minutes before trying again.`);
      return;
    }

    this.isUploading = true;
    this.uploadQueue = [...pendingFiles];
    
    // Update UI
    this.container.querySelector('.upload-area').classList.add('uploading');
    this.showUploadProgress(true);
    
    // Call upload start callback
    if (this.options.onUploadStart) {
      this.options.onUploadStart(pendingFiles);
    }

    try {
      await this.processUploadQueue();
    } catch (error) {
      console.error('Upload process error:', error);
      
      // Handle rate limit errors specifically
      if (error.message.includes('rate limit') || error.message.includes('429')) {
        this.showError('Upload rate limit exceeded. Please wait before trying again.');
      } else {
        this.showError('Upload process failed');
      }
    } finally {
      this.isUploading = false;
      this.container.querySelector('.upload-area').classList.remove('uploading');
      this.showUploadProgress(false);
    }
  }

  /**
   * Process upload queue
   */
  async processUploadQueue() {
    const totalFiles = this.uploadQueue.length;
    let completedFiles = 0;

    for (const fileData of this.uploadQueue) {
      try {
        // Update file status
        fileData.status = 'uploading';
        this.updateFileItem(fileData);

        // Generate file path
        const { data: { user } } = await storageManager.supabase.auth.getUser();
        if (!user) {
          throw new Error('Authentication required');
        }

        const filePath = storageManager.generateUserFilePath(
          user.id,
          fileData.file.name,
          'uploads'
        );

        // Upload file with progress tracking
        const result = await this.uploadFileWithProgress(fileData, filePath);
        
        // Update file status
        fileData.status = 'completed';
        fileData.uploadResult = result;
        this.updateFileItem(fileData);
        
        // Add to uploaded files
        this.uploadedFiles.push(fileData);
        
        completedFiles++;
        
        // Call upload complete callback
        if (this.options.onUploadComplete) {
          this.options.onUploadComplete(fileData, result);
        }

      } catch (error) {
        console.error('File upload error:', error);
        
        // Update file status
        fileData.status = 'error';
        fileData.error = error.message;
        this.updateFileItem(fileData);
        
        // Call upload error callback
        if (this.options.onUploadError) {
          this.options.onUploadError(fileData, error);
        }
      }

      // Update overall progress
      const overallProgress = Math.round((completedFiles / totalFiles) * 100);
      this.updateOverallProgress(overallProgress);
    }

    // Show uploaded files section
    this.renderUploadedFiles();
  }

  /**
   * Upload file with progress tracking and rate limiting
   * @param {Object} fileData - File data object
   * @param {string} filePath - Target file path
   * @returns {Promise<Object>} Upload result
   */
  async uploadFileWithProgress(fileData, filePath) {
    const { file } = fileData;

    // Create progress tracking wrapper
    const progressFile = new File([file], file.name, { type: file.type });
    
    try {
      // Upload file with rate limit handling
      const result = await this.uploadWithRateLimit(
        () => storageManager.uploadFile(
          this.options.bucketId,
          filePath,
          progressFile,
          {
            onUploadProgress: (progress) => {
              fileData.progress = Math.round(progress * 100);
              this.updateFileItem(fileData);
              
              // Call progress callback
              if (this.options.onUploadProgress) {
                this.options.onUploadProgress(fileData, progress);
              }
            }
          }
        )
      );

      return result;
      
    } catch (error) {
      // Handle rate limit errors
      if (error.message.includes('rate limit') || error.message.includes('429')) {
        throw new Error('Upload rate limit exceeded');
      }
      throw error;
    }
  }

  /**
   * Upload with rate limit handling
   * @param {Function} uploadFn - Upload function to execute
   * @returns {Promise<Object>} Upload result
   */
  async uploadWithRateLimit(uploadFn) {
    if (window.rateLimitHandler) {
      return await window.rateLimitHandler.retryWithBackoff(uploadFn, 'upload', 3);
    } else {
      return await uploadFn();
    }
  }

  /**
   * Update file item in UI
   * @param {Object} fileData - File data object
   */
  updateFileItem(fileData) {
    const fileItem = this.container.querySelector(`[data-file-id="${fileData.id}"]`);
    if (fileItem) {
      const newHTML = this.renderFileItem(fileData);
      fileItem.outerHTML = newHTML;
      
      // Re-attach event listeners for the new element
      this.attachFileItemListeners(fileData.id);
    }
  }

  /**
   * Attach event listeners to file item
   * @param {string} fileId - File ID
   */
  attachFileItemListeners(fileId) {
    const fileItem = this.container.querySelector(`[data-file-id="${fileId}"]`);
    if (!fileItem) return;

    // Remove button
    const removeBtn = fileItem.querySelector('.remove-btn');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        this.removeFile(fileId);
      });
    }

    // Download button
    const downloadBtn = fileItem.querySelector('.download-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        this.downloadFile(fileId);
      });
    }

    // Retry button
    const retryBtn = fileItem.querySelector('.retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        this.retryFile(fileId);
      });
    }
  }

  /**
   * Show/hide upload progress
   * @param {boolean} show - Whether to show progress
   */
  showUploadProgress(show) {
    const progressElement = this.container.querySelector('.upload-progress');
    if (progressElement) {
      progressElement.style.display = show ? 'block' : 'none';
    }
  }

  /**
   * Update overall upload progress
   * @param {number} percentage - Progress percentage
   */
  updateOverallProgress(percentage) {
    const progressFill = this.container.querySelector('.upload-progress .progress-fill');
    const progressText = this.container.querySelector('.upload-progress .progress-percentage');
    
    if (progressFill) {
      progressFill.style.width = `${percentage}%`;
    }
    
    if (progressText) {
      progressText.textContent = `${percentage}%`;
    }
  }

  /**
   * Remove file from list
   * @param {string} fileId - File ID to remove
   */
  removeFile(fileId) {
    this.files = this.files.filter(f => f.id !== fileId);
    this.renderFileList();
  }

  /**
   * Download file
   * @param {string} fileId - File ID to download
   */
  async downloadFile(fileId) {
    try {
      const fileData = this.uploadedFiles.find(f => f.id === fileId);
      if (!fileData || !fileData.uploadResult) {
        throw new Error('File not found or not uploaded');
      }

      const signedUrl = await storageManager.generateSignedUrl(
        this.options.bucketId,
        fileData.uploadResult.path
      );

      // Create download link
      const link = document.createElement('a');
      link.href = signedUrl;
      link.download = fileData.file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (error) {
      console.error('Download error:', error);
      this.showError(`Download failed: ${error.message}`);
    }
  }

  /**
   * Retry file upload
   * @param {string} fileId - File ID to retry
   */
  retryFile(fileId) {
    const fileData = this.files.find(f => f.id === fileId);
    if (fileData) {
      fileData.status = 'pending';
      fileData.error = null;
      fileData.progress = 0;
      this.updateFileItem(fileData);
    }
  }

  /**
   * Clear all files
   */
  clearFiles() {
    this.files = [];
    this.uploadQueue = [];
    this.renderFileList();
  }

  /**
   * Load uploaded files from storage
   */
  async loadUploadedFiles() {
    try {
      const files = await storageManager.listUserFiles(this.options.bucketId);
      this.renderUploadedFiles(files);
    } catch (error) {
      console.error('Error loading uploaded files:', error);
      this.showError('Failed to load uploaded files');
    }
  }

  /**
   * Render uploaded files section
   * @param {Array} files - Array of uploaded files
   */
  renderUploadedFiles(files = []) {
    const uploadedSection = this.container.querySelector('#uploaded-files');
    const uploadedItems = this.container.querySelector('#uploaded-items');

    if (this.uploadedFiles.length === 0 && files.length === 0) {
      uploadedSection.style.display = 'none';
      return;
    }

    uploadedSection.style.display = 'block';
    
    const filesToShow = files.length > 0 ? files : this.uploadedFiles;
    uploadedItems.innerHTML = filesToShow.map(file => this.renderUploadedFileItem(file)).join('');
  }

  /**
   * Render uploaded file item
   * @param {Object} file - File object
   * @returns {string} HTML for uploaded file item
   */
  renderUploadedFileItem(file) {
    const fileName = file.name || file.file?.name || 'Unknown';
    const fileSize = file.metadata?.size || file.file?.size || 0;
    
    return `
      <div class="uploaded-file-item">
        <div class="file-info">
          <div class="file-name">${fileName}</div>
          <div class="file-meta">
            <span class="file-size">${storageManager.formatFileSize(fileSize)}</span>
            <span class="upload-date">${new Date(file.created_at || Date.now()).toLocaleDateString()}</span>
          </div>
        </div>
        <div class="file-actions">
          <button class="btn btn-sm btn-primary" onclick="window.storageManager.generateSignedUrl('${this.options.bucketId}', '${file.name}').then(url => window.open(url))">
            <i class="fas fa-download"></i>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    if (window.showNotification) {
      window.showNotification(message, 'error');
    } else {
      alert(message);
    }
  }

  /**
   * Get uploaded files
   * @returns {Array} Array of uploaded files
   */
  getUploadedFiles() {
    return this.uploadedFiles;
  }

  /**
   * Get pending files
   * @returns {Array} Array of pending files
   */
  getPendingFiles() {
    return this.files.filter(f => f.status === 'pending');
  }

  /**
   * Clear uploaded files
   */
  clearUploadedFiles() {
    this.uploadedFiles = [];
    this.renderUploadedFiles();
  }

  /**
   * Destroy the component
   */
  destroy() {
    if (this.container) {
      this.container.innerHTML = '';
    }
    
    this.files = [];
    this.uploadQueue = [];
    this.uploadedFiles = [];
  }
}

// Make available globally
window.SecureFileUpload = SecureFileUpload;