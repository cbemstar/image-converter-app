/**
 * File Validation Utilities
 * 
 * Comprehensive file validation for secure file handling
 * Requirements: 13.1, 13.2, 13.3, 14.3, 14.4
 */

// File type configurations
export const FILE_TYPES = {
  JPEG: {
    mimeTypes: ['image/jpeg', 'image/jpg'],
    extensions: ['jpg', 'jpeg'],
    signatures: [
      [0xFF, 0xD8, 0xFF], // JPEG
    ],
    maxSize: 50 * 1024 * 1024, // 50MB
    description: 'JPEG Image'
  },
  PNG: {
    mimeTypes: ['image/png'],
    extensions: ['png'],
    signatures: [
      [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], // PNG
    ],
    maxSize: 50 * 1024 * 1024,
    description: 'PNG Image'
  },
  WEBP: {
    mimeTypes: ['image/webp'],
    extensions: ['webp'],
    signatures: [
      [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50], // WEBP
    ],
    maxSize: 50 * 1024 * 1024,
    description: 'WebP Image'
  },
  GIF: {
    mimeTypes: ['image/gif'],
    extensions: ['gif'],
    signatures: [
      [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
      [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
    ],
    maxSize: 50 * 1024 * 1024,
    description: 'GIF Image'
  },
  BMP: {
    mimeTypes: ['image/bmp', 'image/x-ms-bmp'],
    extensions: ['bmp'],
    signatures: [
      [0x42, 0x4D], // BM
    ],
    maxSize: 50 * 1024 * 1024,
    description: 'Bitmap Image'
  },
  TIFF: {
    mimeTypes: ['image/tiff', 'image/tif'],
    extensions: ['tiff', 'tif'],
    signatures: [
      [0x49, 0x49, 0x2A, 0x00], // Little-endian TIFF
      [0x4D, 0x4D, 0x00, 0x2A], // Big-endian TIFF
    ],
    maxSize: 50 * 1024 * 1024,
    description: 'TIFF Image'
  },
  AVIF: {
    mimeTypes: ['image/avif'],
    extensions: ['avif'],
    signatures: [
      [null, null, null, null, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66], // AVIF
    ],
    maxSize: 50 * 1024 * 1024,
    description: 'AVIF Image'
  },
  HEIC: {
    mimeTypes: ['image/heic', 'image/heif'],
    extensions: ['heic', 'heif'],
    signatures: [
      [null, null, null, null, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63], // HEIC
      [null, null, null, null, 0x66, 0x74, 0x79, 0x70, 0x6D, 0x69, 0x66, 0x31], // HEIF
    ],
    maxSize: 50 * 1024 * 1024,
    description: 'HEIC/HEIF Image'
  },
  // RAW formats
  CR2: {
    mimeTypes: ['image/x-canon-cr2'],
    extensions: ['cr2'],
    signatures: [
      [0x49, 0x49, 0x2A, 0x00, 0x10, 0x00, 0x00, 0x00, 0x43, 0x52], // Canon CR2
    ],
    maxSize: 100 * 1024 * 1024, // 100MB for RAW
    description: 'Canon RAW v2'
  },
  NEF: {
    mimeTypes: ['image/x-nikon-nef'],
    extensions: ['nef'],
    signatures: [
      [0x4D, 0x4D, 0x00, 0x2A], // Nikon NEF (TIFF-based)
    ],
    maxSize: 100 * 1024 * 1024,
    description: 'Nikon Electronic Format'
  },
  ARW: {
    mimeTypes: ['image/x-sony-arw'],
    extensions: ['arw'],
    signatures: [
      [0x49, 0x49, 0x2A, 0x00], // Sony ARW (TIFF-based)
    ],
    maxSize: 100 * 1024 * 1024,
    description: 'Sony Alpha RAW'
  },
  DNG: {
    mimeTypes: ['image/x-adobe-dng'],
    extensions: ['dng'],
    signatures: [
      [0x49, 0x49, 0x2A, 0x00], // Adobe DNG (TIFF-based)
      [0x4D, 0x4D, 0x00, 0x2A],
    ],
    maxSize: 100 * 1024 * 1024,
    description: 'Adobe Digital Negative'
  }
};

// Security validation rules
export const SECURITY_RULES = {
  MAX_FILENAME_LENGTH: 255,
  MIN_FILE_SIZE: 100, // 100 bytes minimum
  MAX_TOTAL_FILES: 100,
  ALLOWED_FILENAME_CHARS: /^[a-zA-Z0-9._-]+$/,
  BLOCKED_EXTENSIONS: ['exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar', 'php', 'asp', 'jsp'],
  MAX_METADATA_SIZE: 1024 * 1024, // 1MB for metadata
};

/**
 * File Validator class for comprehensive file validation
 */
export class FileValidator {
  constructor() {
    this.validationRules = [];
    this.setupDefaultRules();
  }

  /**
   * Setup default validation rules
   */
  setupDefaultRules() {
    this.addRule('fileSize', this.validateFileSize.bind(this));
    this.addRule('fileType', this.validateFileType.bind(this));
    this.addRule('fileName', this.validateFileName.bind(this));
    this.addRule('fileSignature', this.validateFileSignature.bind(this));
    this.addRule('security', this.validateSecurity.bind(this));
  }

  /**
   * Add validation rule
   * @param {string} name - Rule name
   * @param {Function} validator - Validation function
   */
  addRule(name, validator) {
    this.validationRules.push({ name, validator });
  }

  /**
   * Validate file against all rules
   * @param {File} file - File to validate
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation result
   */
  async validateFile(file, options = {}) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      fileType: null,
      metadata: {}
    };

    try {
      // Run all validation rules
      for (const rule of this.validationRules) {
        const ruleResult = await rule.validator(file, options);
        
        if (ruleResult.errors && ruleResult.errors.length > 0) {
          result.errors.push(...ruleResult.errors);
          result.valid = false;
        }
        
        if (ruleResult.warnings && ruleResult.warnings.length > 0) {
          result.warnings.push(...ruleResult.warnings);
        }
        
        if (ruleResult.fileType) {
          result.fileType = ruleResult.fileType;
        }
        
        if (ruleResult.metadata) {
          result.metadata = { ...result.metadata, ...ruleResult.metadata };
        }
      }

      // Extract additional metadata if file is valid
      if (result.valid) {
        const additionalMetadata = await this.extractMetadata(file);
        result.metadata = { ...result.metadata, ...additionalMetadata };
      }

    } catch (error) {
      result.valid = false;
      result.errors.push(`Validation error: ${error.message}`);
    }

    return result;
  }

  /**
   * Validate file size
   * @param {File} file - File to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  validateFileSize(file, options = {}) {
    const errors = [];
    const warnings = [];

    // Check minimum size
    if (file.size < SECURITY_RULES.MIN_FILE_SIZE) {
      errors.push(`File is too small (${file.size} bytes). Minimum size is ${SECURITY_RULES.MIN_FILE_SIZE} bytes.`);
    }

    // Check maximum size based on file type
    const detectedType = this.detectFileTypeByExtension(file.name);
    const maxSize = detectedType ? detectedType.maxSize : 50 * 1024 * 1024;

    if (file.size > maxSize) {
      errors.push(`File is too large (${this.formatFileSize(file.size)}). Maximum size is ${this.formatFileSize(maxSize)}.`);
    }

    // Warning for large files
    if (file.size > 25 * 1024 * 1024) {
      warnings.push('Large file detected. Upload may take longer.');
    }

    return { errors, warnings };
  }

  /**
   * Validate file type
   * @param {File} file - File to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  validateFileType(file, options = {}) {
    const errors = [];
    const warnings = [];
    let fileType = null;

    // Check by MIME type first
    fileType = this.detectFileTypeByMime(file.type);
    
    // Fallback to extension if MIME type is not recognized
    if (!fileType) {
      fileType = this.detectFileTypeByExtension(file.name);
      
      if (fileType) {
        warnings.push(`File type detected by extension. MIME type "${file.type}" may be incorrect.`);
      }
    }

    // Check if file type is supported
    if (!fileType) {
      errors.push(`Unsupported file type: ${file.type || 'unknown'}`);
    }

    // Validate MIME type matches extension
    if (fileType && file.type) {
      const extension = this.getFileExtension(file.name);
      if (!fileType.extensions.includes(extension)) {
        warnings.push(`File extension "${extension}" doesn't match MIME type "${file.type}"`);
      }
    }

    return { errors, warnings, fileType };
  }

  /**
   * Validate file name
   * @param {File} file - File to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  validateFileName(file, options = {}) {
    const errors = [];
    const warnings = [];

    // Check filename length
    if (file.name.length > SECURITY_RULES.MAX_FILENAME_LENGTH) {
      errors.push(`Filename is too long (${file.name.length} characters). Maximum length is ${SECURITY_RULES.MAX_FILENAME_LENGTH}.`);
    }

    // Check for empty filename
    if (!file.name || file.name.trim().length === 0) {
      errors.push('Filename cannot be empty.');
    }

    // Check for blocked extensions
    const extension = this.getFileExtension(file.name);
    if (SECURITY_RULES.BLOCKED_EXTENSIONS.includes(extension)) {
      errors.push(`File extension "${extension}" is not allowed for security reasons.`);
    }

    // Check for suspicious characters
    if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
      errors.push('Filename contains invalid characters.');
    }

    // Warning for special characters
    if (!/^[a-zA-Z0-9._-]+$/.test(file.name)) {
      warnings.push('Filename contains special characters that may cause issues.');
    }

    return { errors, warnings };
  }

  /**
   * Validate file signature (magic bytes)
   * @param {File} file - File to validate
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation result
   */
  async validateFileSignature(file, options = {}) {
    const errors = [];
    const warnings = [];

    try {
      // Read first 16 bytes for signature validation
      const headerBytes = await this.readFileHeader(file, 16);
      
      // Detect file type by signature
      const signatureType = this.detectFileTypeBySignature(headerBytes);
      
      if (signatureType) {
        // Compare with declared MIME type
        if (file.type && !signatureType.mimeTypes.includes(file.type)) {
          warnings.push(`File signature indicates ${signatureType.description}, but MIME type is "${file.type}"`);
        }
      } else {
        // Check if we expected a signature
        const declaredType = this.detectFileTypeByMime(file.type) || this.detectFileTypeByExtension(file.name);
        if (declaredType && declaredType.signatures.length > 0) {
          warnings.push('Could not verify file signature. File may be corrupted or have an unusual format.');
        }
      }

    } catch (error) {
      warnings.push(`Could not read file signature: ${error.message}`);
    }

    return { errors, warnings };
  }

  /**
   * Validate security aspects
   * @param {File} file - File to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  validateSecurity(file, options = {}) {
    const errors = [];
    const warnings = [];

    // Check for suspicious file names
    const suspiciousPatterns = [
      /\.(exe|bat|cmd|com|pif|scr|vbs|js|jar|php|asp|jsp)$/i,
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i, // Windows reserved names
      /[<>:"|?*]/,  // Invalid Windows filename characters
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(file.name)) {
        errors.push('Filename contains suspicious patterns.');
        break;
      }
    }

    // Check for double extensions
    if ((file.name.match(/\./g) || []).length > 1) {
      const parts = file.name.split('.');
      if (parts.length > 2) {
        warnings.push('File has multiple extensions. Ensure this is intentional.');
      }
    }

    // Check for hidden files (starting with dot)
    if (file.name.startsWith('.')) {
      warnings.push('Hidden file detected.');
    }

    return { errors, warnings };
  }

  /**
   * Extract file metadata
   * @param {File} file - File to extract metadata from
   * @returns {Promise<Object>} File metadata
   */
  async extractMetadata(file) {
    const metadata = {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      extension: this.getFileExtension(file.name),
      hash: null
    };

    try {
      // Calculate file hash for deduplication
      metadata.hash = await this.calculateFileHash(file);
      
      // Extract image dimensions if it's an image
      if (file.type.startsWith('image/')) {
        const dimensions = await this.extractImageDimensions(file);
        metadata.width = dimensions.width;
        metadata.height = dimensions.height;
      }

    } catch (error) {
      console.warn('Error extracting metadata:', error);
    }

    return metadata;
  }

  /**
   * Calculate file hash for deduplication
   * @param {File} file - File to hash
   * @returns {Promise<string>} File hash
   */
  async calculateFileHash(file) {
    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.error('Error calculating file hash:', error);
      return null;
    }
  }

  /**
   * Extract image dimensions
   * @param {File} file - Image file
   * @returns {Promise<Object>} Image dimensions
   */
  async extractImageDimensions(file) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight
        });
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ width: null, height: null });
      };
      
      img.src = url;
    });
  }

  /**
   * Read file header bytes
   * @param {File} file - File to read
   * @param {number} bytes - Number of bytes to read
   * @returns {Promise<Uint8Array>} Header bytes
   */
  async readFileHeader(file, bytes = 16) {
    const slice = file.slice(0, bytes);
    const buffer = await slice.arrayBuffer();
    return new Uint8Array(buffer);
  }

  /**
   * Detect file type by MIME type
   * @param {string} mimeType - MIME type
   * @returns {Object|null} File type configuration
   */
  detectFileTypeByMime(mimeType) {
    for (const [key, config] of Object.entries(FILE_TYPES)) {
      if (config.mimeTypes.includes(mimeType)) {
        return { ...config, key };
      }
    }
    return null;
  }

  /**
   * Detect file type by extension
   * @param {string} filename - Filename
   * @returns {Object|null} File type configuration
   */
  detectFileTypeByExtension(filename) {
    const extension = this.getFileExtension(filename);
    
    for (const [key, config] of Object.entries(FILE_TYPES)) {
      if (config.extensions.includes(extension)) {
        return { ...config, key };
      }
    }
    return null;
  }

  /**
   * Detect file type by signature
   * @param {Uint8Array} headerBytes - File header bytes
   * @returns {Object|null} File type configuration
   */
  detectFileTypeBySignature(headerBytes) {
    for (const [key, config] of Object.entries(FILE_TYPES)) {
      for (const signature of config.signatures) {
        if (this.matchesSignature(headerBytes, signature)) {
          return { ...config, key };
        }
      }
    }
    return null;
  }

  /**
   * Check if header bytes match signature
   * @param {Uint8Array} headerBytes - Header bytes
   * @param {Array} signature - Signature pattern
   * @returns {boolean} True if matches
   */
  matchesSignature(headerBytes, signature) {
    if (headerBytes.length < signature.length) {
      return false;
    }

    for (let i = 0; i < signature.length; i++) {
      if (signature[i] !== null && headerBytes[i] !== signature[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get file extension from filename
   * @param {string} filename - Filename
   * @returns {string} File extension (lowercase)
   */
  getFileExtension(filename) {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
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
   * Validate multiple files
   * @param {FileList|Array} files - Files to validate
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation results
   */
  async validateFiles(files, options = {}) {
    const results = {
      valid: true,
      files: [],
      errors: [],
      warnings: [],
      totalSize: 0
    };

    const fileArray = Array.from(files);

    // Check total file count
    if (fileArray.length > SECURITY_RULES.MAX_TOTAL_FILES) {
      results.valid = false;
      results.errors.push(`Too many files selected (${fileArray.length}). Maximum is ${SECURITY_RULES.MAX_TOTAL_FILES}.`);
      return results;
    }

    // Validate each file
    for (const file of fileArray) {
      const fileResult = await this.validateFile(file, options);
      
      results.files.push({
        file,
        ...fileResult
      });
      
      results.totalSize += file.size;
      
      if (!fileResult.valid) {
        results.valid = false;
      }
      
      results.errors.push(...fileResult.errors);
      results.warnings.push(...fileResult.warnings);
    }

    // Check total size
    const maxTotalSize = 500 * 1024 * 1024; // 500MB total
    if (results.totalSize > maxTotalSize) {
      results.valid = false;
      results.errors.push(`Total file size (${this.formatFileSize(results.totalSize)}) exceeds maximum (${this.formatFileSize(maxTotalSize)}).`);
    }

    return results;
  }
}

// Create singleton instance
export const fileValidator = new FileValidator();

// Make available globally
window.fileValidator = fileValidator;
window.FileValidator = FileValidator;