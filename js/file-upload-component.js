/**
 * FileUploadComponent - Reusable file upload component with quota enforcement
 * Can be easily integrated into any tool for file uploads
 */

class FileUploadComponent {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? 
      document.querySelector(container) : container;
    
    this.options = {
      toolType: 'default',
      accept: '*/*',
      multiple: false,
      maxFiles: 1,
      showProgress: true,
      showPreview: true,
      allowDrop: true,
      autoUpload: false,
      generateThumbnail: false,
      onFileSelect: null,
      onUploadStart: null,
      onUploadProgress: null,
      onUploadComplete: null,
      onUploadError: null,
      onQuotaExceeded: null,
      ...options
    };

    this.fileManager = window.fileManager;
    this.quotaManager = window.quotaManager;
    this.authManager = window.authManager;
    
    this.selectedFiles = [];
    this.uploadedFiles = [];
    this.isUploading = false;
    
    this.init();
  }

  /**
   * Initialize the upload component
   */
  init() {
    if (!this.container) {
      console.error('FileUploadComponent: Container not found');
      return;
    }

    this.render();
    this.setupEventListeners();
    this.addStyles();
  }

  /**
   * Render the upload component
   */
  render() {
    this.container.innerHTML = `
      <div class="file-upload-component">
        <div class="file-upload-dropzone" id="dropzone-${this.getComponentId()}">
          <div class="file-upload-content">
            <div class="file-upload-icon">
              <i class="fas fa-cloud-upload-alt"></i>
            </div>
            <div class="file-upload-text">
              <h3>Drop files here or click to browse</h3>
              <p>Supported formats: ${this.getSupportedFormatsText()}</p>
              <p class="file-upload-limits">Max file size: ${this.getMaxFileSizeText()}</p>
            </div>
            <input type="file" 
                   class="file-upload-input" 
                   id="input-${this.getComponentId()}"
                   accept="${this.options.accept}"
                   ${this.options.multiple ? 'multiple' : ''}
                   style="display: none;">
            <button class="file-upload-browse-btn" type="button">
              <i class="fas fa-folder-open"></i>
              Browse Files
            </button>
          </div>
        </div>
        
        <div class="file-upload-selected" id="selected-${this.getComponentId()}" style="display: none;">
          <div class="file-upload-selected-header">
            <h4>Selected Files</h4>
            <button class="file-upload-clear-btn" type="button">
              <i class="fas fa-times"></i>
              Clear All
            </button>
          </div>
          <div class="file-upload-files-list" id="files-list-${this.getComponentId()}">
            <!-- Selected files will be displayed here -->
          </div>
          <div class="file-upload-actions">
            <button class="file-upload-upload-btn" type="button" ${this.options.autoUpload ? 'style="display: none;"' : ''}>
              <i class="fas fa-upload"></i>
              Upload Files
            </button>
          </div>
        </div>

        <div class="file-upload-progress" id="progress-${this.getComponentId()}" style="display: none;">
          <div class="file-upload-progress-header">
            <h4>Uploading Files</h4>
            <span class="file-upload-progress-text">0%</span>
          </div>
          <div class="file-upload-progress-bar">
            <div class="file-upload-progress-fill"></div>
          </div>
        </div>

        <div class="file-upload-completed" id="completed-${this.getComponentId()}" style="display: none;">
          <div class="file-upload-completed-header">
            <h4>Upload Complete</h4>
            <button class="file-upload-new-btn" type="button">
              <i class="fas fa-plus"></i>
              Upload More
            </button>
          </div>
          <div class="file-upload-completed-list" id="completed-list-${this.getComponentId()}">
            <!-- Completed uploads will be displayed here -->
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    const componentId = this.getComponentId();
    const dropzone = document.getElementById(`dropzone-${componentId}`);
    const input = document.getElementById(`input-${componentId}`);
    const browseBtn = dropzone.querySelector('.file-upload-browse-btn');
    const clearBtn = document.getElementById(`selected-${componentId}`).querySelector('.file-upload-clear-btn');
    const uploadBtn = document.getElementById(`selected-${componentId}`).querySelector('.file-upload-upload-btn');
    const newBtn = document.getElementById(`completed-${componentId}`).querySelector('.file-upload-new-btn');

    // File input change
    input.addEventListener('change', (e) => {
      this.handleFileSelect(Array.from(e.target.files));
    });

    // Browse button click
    browseBtn.addEventListener('click', () => {
      input.click();
    });

    // Dropzone click
    dropzone.addEventListener('click', (e) => {
      if (e.target === dropzone || e.target.closest('.file-upload-content')) {
        input.click();
      }
    });

    // Drag and drop
    if (this.options.allowDrop) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('file-upload-dragover');
      });

      dropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        if (!dropzone.contains(e.relatedTarget)) {
          dropzone.classList.remove('file-upload-dragover');
        }
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('file-upload-dragover');
        
        const files = Array.from(e.dataTransfer.files);
        this.handleFileSelect(files);
      });
    }

    // Action buttons
    clearBtn.addEventListener('click', () => this.clearFiles());
    uploadBtn.addEventListener('click', () => this.uploadFiles());
    newBtn.addEventListener('click', () => this.reset());
  }

  /**
   * Handle file selection
   */
  async handleFileSelect(files) {
    try {
      // Validate file count
      if (!this.options.multiple && files.length > 1) {
        throw new Error('Only one file is allowed');
      }

      if (files.length > this.options.maxFiles) {
        throw new Error(`Maximum ${this.options.maxFiles} files allowed`);
      }

      // Validate each file
      const validFiles = [];
      for (const file of files) {
        try {
          await this.validateFile(file);
          validFiles.push(file);
        } catch (error) {
          this.showError(`${file.name}: ${error.message}`);
        }
      }

      if (validFiles.length === 0) {
        return;
      }

      this.selectedFiles = validFiles;
      this.displaySelectedFiles();

      // Callback
      if (this.options.onFileSelect) {
        this.options.onFileSelect(validFiles);
      }

      // Auto upload if enabled
      if (this.options.autoUpload) {
        await this.uploadFiles();
      }

    } catch (error) {
      this.showError(error.message);
    }
  }

  /**
   * Validate file
   */
  async validateFile(file) {
    // Check authentication
    if (!this.authManager?.isAuthenticated()) {
      throw new Error('Please sign in to upload files');
    }

    // Use FileManager validation
    if (this.fileManager) {
      this.fileManager.validateFile(file, this.options.toolType);
    }

    // Check quota
    if (this.quotaManager) {
      const quotaCheck = await this.quotaManager.checkStorageQuota(file.size);
      if (!quotaCheck.allowed) {
        const error = new Error('Storage quota exceeded');
        error.quotaError = true;
        error.quotaData = quotaCheck;
        throw error;
      }
    }

    return true;
  }

  /**
   * Display selected files
   */
  displaySelectedFiles() {
    const selectedContainer = document.getElementById(`selected-${this.getComponentId()}`);
    const filesList = document.getElementById(`files-list-${this.getComponentId()}`);
    
    selectedContainer.style.display = 'block';
    
    filesList.innerHTML = this.selectedFiles.map((file, index) => `
      <div class="file-upload-file-item">
        <div class="file-upload-file-info">
          <div class="file-upload-file-icon">
            <i class="${this.getFileIcon(file.type)}"></i>
          </div>
          <div class="file-upload-file-details">
            <div class="file-upload-file-name">${file.name}</div>
            <div class="file-upload-file-size">${this.formatFileSize(file.size)}</div>
          </div>
        </div>
        <button class="file-upload-remove-btn" onclick="fileUploadComponent_${this.getComponentId()}.removeFile(${index})">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `).join('');

    // Store reference for onclick handlers
    window[`fileUploadComponent_${this.getComponentId()}`] = this;
  }

  /**
   * Remove file from selection
   */
  removeFile(index) {
    this.selectedFiles.splice(index, 1);
    
    if (this.selectedFiles.length === 0) {
      this.clearFiles();
    } else {
      this.displaySelectedFiles();
    }
  }

  /**
   * Clear all selected files
   */
  clearFiles() {
    this.selectedFiles = [];
    const selectedContainer = document.getElementById(`selected-${this.getComponentId()}`);
    selectedContainer.style.display = 'none';
  }

  /**
   * Upload files
   */
  async uploadFiles() {
    if (this.selectedFiles.length === 0 || this.isUploading) {
      return;
    }

    this.isUploading = true;
    this.showProgress();

    try {
      // Callback
      if (this.options.onUploadStart) {
        this.options.onUploadStart(this.selectedFiles);
      }

      const uploadPromises = this.selectedFiles.map((file, index) => 
        this.uploadSingleFile(file, index)
      );

      const results = await Promise.all(uploadPromises);
      this.uploadedFiles = results.filter(result => result.success);

      this.showCompleted();

      // Callback
      if (this.options.onUploadComplete) {
        this.options.onUploadComplete(this.uploadedFiles);
      }

    } catch (error) {
      console.error('Upload error:', error);
      this.showError('Upload failed: ' + error.message);
      
      // Callback
      if (this.options.onUploadError) {
        this.options.onUploadError(error);
      }
    } finally {
      this.isUploading = false;
    }
  }

  /**
   * Upload single file
   */
  async uploadSingleFile(file, index) {
    try {
      const result = await this.fileManager.uploadFile(file, this.options.toolType, {
        generateThumbnail: this.options.generateThumbnail,
        onProgress: (progress) => {
          this.updateProgress(index, progress);
        }
      });

      return {
        success: true,
        file: result.file,
        originalFile: file,
        url: result.url
      };

    } catch (error) {
      console.error(`Upload error for ${file.name}:`, error);
      
      if (error.quotaError && this.options.onQuotaExceeded) {
        this.options.onQuotaExceeded(error.quotaData);
      }

      return {
        success: false,
        file: null,
        originalFile: file,
        error: error.message
      };
    }
  }

  /**
   * Update upload progress
   */
  updateProgress(fileIndex, progress) {
    const totalProgress = ((fileIndex + (progress.percentage / 100)) / this.selectedFiles.length) * 100;
    
    const progressContainer = document.getElementById(`progress-${this.getComponentId()}`);
    const progressText = progressContainer.querySelector('.file-upload-progress-text');
    const progressFill = progressContainer.querySelector('.file-upload-progress-fill');
    
    progressText.textContent = `${Math.round(totalProgress)}%`;
    progressFill.style.width = `${totalProgress}%`;

    // Callback
    if (this.options.onUploadProgress) {
      this.options.onUploadProgress({
        fileIndex,
        fileProgress: progress,
        totalProgress: totalProgress
      });
    }
  }

  /**
   * Show progress view
   */
  showProgress() {
    const componentId = this.getComponentId();
    document.getElementById(`selected-${componentId}`).style.display = 'none';
    document.getElementById(`progress-${componentId}`).style.display = 'block';
  }

  /**
   * Show completed view
   */
  showCompleted() {
    const componentId = this.getComponentId();
    document.getElementById(`progress-${componentId}`).style.display = 'none';
    document.getElementById(`completed-${componentId}`).style.display = 'block';

    const completedList = document.getElementById(`completed-list-${componentId}`);
    completedList.innerHTML = this.uploadedFiles.map(result => `
      <div class="file-upload-completed-item ${result.success ? 'success' : 'error'}">
        <div class="file-upload-file-info">
          <div class="file-upload-file-icon">
            <i class="${result.success ? 'fas fa-check-circle' : 'fas fa-exclamation-circle'}"></i>
          </div>
          <div class="file-upload-file-details">
            <div class="file-upload-file-name">${result.originalFile.name}</div>
            <div class="file-upload-file-status">
              ${result.success ? 'Upload successful' : result.error}
            </div>
          </div>
        </div>
      </div>
    `).join('');
  }

  /**
   * Reset component to initial state
   */
  reset() {
    this.selectedFiles = [];
    this.uploadedFiles = [];
    this.isUploading = false;

    const componentId = this.getComponentId();
    document.getElementById(`selected-${componentId}`).style.display = 'none';
    document.getElementById(`progress-${componentId}`).style.display = 'none';
    document.getElementById(`completed-${componentId}`).style.display = 'none';
    
    // Clear file input
    const input = document.getElementById(`input-${componentId}`);
    input.value = '';
  }

  /**
   * Get uploaded files
   */
  getUploadedFiles() {
    return this.uploadedFiles.filter(result => result.success);
  }

  /**
   * Get component ID
   */
  getComponentId() {
    if (!this._componentId) {
      this._componentId = Math.random().toString(36).substr(2, 9);
    }
    return this._componentId;
  }

  /**
   * Get supported formats text
   */
  getSupportedFormatsText() {
    const supportedTypes = window.APP_CONFIG?.SUPPORTED_FILE_TYPES?.[this.options.toolType] || ['*/*'];
    
    if (supportedTypes.includes('*/*')) {
      return 'All file types';
    }

    const extensions = supportedTypes.map(type => {
      const parts = type.split('/');
      return parts[1] ? parts[1].toUpperCase() : type;
    });

    return extensions.join(', ');
  }

  /**
   * Get max file size text
   */
  getMaxFileSizeText() {
    const planLimits = this.quotaManager?.getCurrentPlanLimits();
    if (planLimits?.maxFileSize) {
      return this.formatFileSize(planLimits.maxFileSize);
    }
    return 'No limit';
  }

  /**
   * Get file icon
   */
  getFileIcon(fileType) {
    const iconMap = {
      'image/': 'fas fa-image',
      'application/pdf': 'fas fa-file-pdf',
      'application/json': 'fas fa-file-code',
      'text/': 'fas fa-file-alt',
      'video/': 'fas fa-file-video',
      'audio/': 'fas fa-file-audio'
    };

    for (const [type, icon] of Object.entries(iconMap)) {
      if (fileType.startsWith(type)) {
        return icon;
      }
    }

    return 'fas fa-file';
  }

  /**
   * Format file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Show error message
   */
  showError(message) {
    // Try to use existing notification system
    if (window.quotaNotifications) {
      window.quotaNotifications.showNotification({
        type: 'error',
        title: 'Upload Error',
        message: message,
        autoClose: 5000
      });
    } else {
      alert(message);
    }
  }

  /**
   * Add component styles
   */
  addStyles() {
    if (document.getElementById('fileUploadComponentStyles')) {
      return;
    }

    const styles = document.createElement('style');
    styles.id = 'fileUploadComponentStyles';
    styles.textContent = `
      .file-upload-component {
        width: 100%;
        max-width: 600px;
        margin: 0 auto;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .file-upload-dropzone {
        border: 2px dashed #d1d5db;
        border-radius: 12px;
        padding: 40px 20px;
        text-align: center;
        background: #f9fafb;
        transition: all 0.2s;
        cursor: pointer;
      }

      .file-upload-dropzone:hover {
        border-color: #3b82f6;
        background: #eff6ff;
      }

      .file-upload-dropzone.file-upload-dragover {
        border-color: #3b82f6;
        background: #dbeafe;
        transform: scale(1.02);
      }

      .file-upload-icon {
        font-size: 48px;
        color: #6b7280;
        margin-bottom: 16px;
      }

      .file-upload-text h3 {
        font-size: 18px;
        font-weight: 600;
        color: #1f2937;
        margin-bottom: 8px;
      }

      .file-upload-text p {
        color: #6b7280;
        margin-bottom: 4px;
        font-size: 14px;
      }

      .file-upload-limits {
        font-size: 12px !important;
        opacity: 0.8;
      }

      .file-upload-browse-btn {
        margin-top: 16px;
        padding: 10px 20px;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.2s;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .file-upload-browse-btn:hover {
        background: #2563eb;
      }

      .file-upload-selected {
        margin-top: 20px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      }

      .file-upload-selected-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid #e5e7eb;
        background: #f9fafb;
      }

      .file-upload-selected-header h4 {
        font-size: 16px;
        font-weight: 600;
        color: #1f2937;
        margin: 0;
      }

      .file-upload-clear-btn {
        background: none;
        border: none;
        color: #6b7280;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 14px;
      }

      .file-upload-clear-btn:hover {
        background: #f3f4f6;
        color: #374151;
      }

      .file-upload-files-list {
        padding: 0;
      }

      .file-upload-file-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 20px;
        border-bottom: 1px solid #f3f4f6;
      }

      .file-upload-file-item:last-child {
        border-bottom: none;
      }

      .file-upload-file-info {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
      }

      .file-upload-file-icon {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f3f4f6;
        border-radius: 6px;
        color: #6b7280;
      }

      .file-upload-file-details {
        flex: 1;
      }

      .file-upload-file-name {
        font-weight: 500;
        color: #1f2937;
        font-size: 14px;
        margin-bottom: 2px;
      }

      .file-upload-file-size {
        font-size: 12px;
        color: #6b7280;
      }

      .file-upload-remove-btn {
        background: none;
        border: none;
        color: #6b7280;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: all 0.2s;
      }

      .file-upload-remove-btn:hover {
        background: #fef2f2;
        color: #ef4444;
      }

      .file-upload-actions {
        padding: 16px 20px;
        border-top: 1px solid #e5e7eb;
        background: #f9fafb;
      }

      .file-upload-upload-btn {
        width: 100%;
        padding: 12px 20px;
        background: #10b981;
        color: white;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }

      .file-upload-upload-btn:hover {
        background: #059669;
      }

      .file-upload-progress {
        margin-top: 20px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      }

      .file-upload-progress-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid #e5e7eb;
        background: #f9fafb;
      }

      .file-upload-progress-header h4 {
        font-size: 16px;
        font-weight: 600;
        color: #1f2937;
        margin: 0;
      }

      .file-upload-progress-text {
        font-weight: 600;
        color: #3b82f6;
      }

      .file-upload-progress-bar {
        height: 8px;
        background: #e5e7eb;
        margin: 20px;
        border-radius: 4px;
        overflow: hidden;
      }

      .file-upload-progress-fill {
        height: 100%;
        background: #3b82f6;
        border-radius: 4px;
        transition: width 0.3s ease;
        width: 0%;
      }

      .file-upload-completed {
        margin-top: 20px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      }

      .file-upload-completed-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid #e5e7eb;
        background: #f0fdf4;
      }

      .file-upload-completed-header h4 {
        font-size: 16px;
        font-weight: 600;
        color: #166534;
        margin: 0;
      }

      .file-upload-new-btn {
        background: #10b981;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 14px;
      }

      .file-upload-new-btn:hover {
        background: #059669;
      }

      .file-upload-completed-list {
        padding: 0;
      }

      .file-upload-completed-item {
        padding: 12px 20px;
        border-bottom: 1px solid #f3f4f6;
      }

      .file-upload-completed-item:last-child {
        border-bottom: none;
      }

      .file-upload-completed-item.success .file-upload-file-icon {
        background: #dcfce7;
        color: #16a34a;
      }

      .file-upload-completed-item.error .file-upload-file-icon {
        background: #fef2f2;
        color: #dc2626;
      }

      .file-upload-file-status {
        font-size: 12px;
        color: #6b7280;
      }

      .file-upload-completed-item.success .file-upload-file-status {
        color: #16a34a;
      }

      .file-upload-completed-item.error .file-upload-file-status {
        color: #dc2626;
      }

      /* Mobile responsive */
      @media (max-width: 480px) {
        .file-upload-dropzone {
          padding: 30px 15px;
        }

        .file-upload-icon {
          font-size: 36px;
        }

        .file-upload-text h3 {
          font-size: 16px;
        }

        .file-upload-file-item {
          padding: 10px 15px;
        }

        .file-upload-actions {
          padding: 12px 15px;
        }
      }
    `;

    document.head.appendChild(styles);
  }
}

// Export for global usage
window.FileUploadComponent = FileUploadComponent;

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FileUploadComponent;
}