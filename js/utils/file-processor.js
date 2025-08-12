/**
 * File Processing Utilities
 * 
 * Handles secure file processing, metadata extraction, and conversion preparation
 * Requirements: 13.1, 13.2, 13.3, 14.3, 14.4
 */

import { fileValidator } from './file-validation.js';
import { storageManager } from '../storage/storage-config.js';

/**
 * File Processing class for handling file operations
 */
export class FileProcessor {
  constructor() {
    this.processingQueue = new Map();
    this.maxConcurrentProcessing = 3;
    this.currentProcessing = 0;
  }

  /**
   * Process uploaded file for conversion
   * @param {File} file - File to process
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processing result
   */
  async processFile(file, options = {}) {
    const processingId = this.generateProcessingId();
    
    try {
      // Add to processing queue
      this.processingQueue.set(processingId, {
        file,
        status: 'validating',
        startTime: Date.now(),
        options
      });

      // Validate file
      const validation = await fileValidator.validateFile(file, options);
      
      if (!validation.valid) {
        throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
      }

      // Update status
      this.updateProcessingStatus(processingId, 'processing');

      // Extract comprehensive metadata
      const metadata = await this.extractComprehensiveMetadata(file, validation);

      // Prepare file for conversion
      const preparedFile = await this.prepareFileForConversion(file, metadata, options);

      // Update status
      this.updateProcessingStatus(processingId, 'completed');

      const result = {
        success: true,
        processingId,
        file: preparedFile,
        metadata,
        validation,
        processingTime: Date.now() - this.processingQueue.get(processingId).startTime
      };

      // Clean up processing queue
      this.processingQueue.delete(processingId);

      return result;

    } catch (error) {
      console.error('File processing error:', error);
      
      // Update status
      this.updateProcessingStatus(processingId, 'error', error.message);
      
      // Clean up processing queue
      this.processingQueue.delete(processingId);

      throw error;
    }
  }

  /**
   * Process multiple files concurrently
   * @param {FileList|Array} files - Files to process
   * @param {Object} options - Processing options
   * @returns {Promise<Array>} Processing results
   */
  async processFiles(files, options = {}) {
    const fileArray = Array.from(files);
    const results = [];
    const errors = [];

    // Process files in batches to avoid overwhelming the system
    const batchSize = this.maxConcurrentProcessing;
    
    for (let i = 0; i < fileArray.length; i += batchSize) {
      const batch = fileArray.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (file) => {
        try {
          return await this.processFile(file, options);
        } catch (error) {
          errors.push({ file: file.name, error: error.message });
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(result => result !== null));
    }

    return {
      results,
      errors,
      totalProcessed: results.length,
      totalErrors: errors.length
    };
  }

  /**
   * Extract comprehensive metadata from file
   * @param {File} file - File to analyze
   * @param {Object} validation - Validation result
   * @returns {Promise<Object>} Comprehensive metadata
   */
  async extractComprehensiveMetadata(file, validation) {
    const metadata = {
      // Basic file information
      originalName: file.name,
      size: file.size,
      type: file.type,
      lastModified: new Date(file.lastModified),
      
      // Validation results
      detectedType: validation.fileType,
      hash: validation.metadata.hash,
      
      // Processing information
      processedAt: new Date(),
      processingVersion: '1.0.0',
      
      // Image-specific metadata
      dimensions: null,
      colorSpace: null,
      hasTransparency: null,
      animationFrames: null,
      
      // Technical metadata
      compression: null,
      quality: null,
      dpi: null,
      
      // Security metadata
      scanResult: 'clean',
      riskLevel: 'low'
    };

    try {
      // Extract image-specific metadata
      if (file.type.startsWith('image/')) {
        const imageMetadata = await this.extractImageMetadata(file);
        Object.assign(metadata, imageMetadata);
      }

      // Extract EXIF data if available
      const exifData = await this.extractExifData(file);
      if (exifData) {
        metadata.exif = exifData;
      }

      // Perform security scan
      const securityScan = await this.performSecurityScan(file);
      metadata.scanResult = securityScan.result;
      metadata.riskLevel = securityScan.riskLevel;

    } catch (error) {
      console.warn('Error extracting comprehensive metadata:', error);
      metadata.extractionErrors = [error.message];
    }

    return metadata;
  }

  /**
   * Extract image-specific metadata
   * @param {File} file - Image file
   * @returns {Promise<Object>} Image metadata
   */
  async extractImageMetadata(file) {
    const metadata = {};

    try {
      // Get image dimensions
      const dimensions = await this.getImageDimensions(file);
      metadata.dimensions = dimensions;

      // Analyze image properties
      const imageAnalysis = await this.analyzeImageProperties(file);
      Object.assign(metadata, imageAnalysis);

    } catch (error) {
      console.warn('Error extracting image metadata:', error);
    }

    return metadata;
  }

  /**
   * Get image dimensions
   * @param {File} file - Image file
   * @returns {Promise<Object>} Image dimensions
   */
  async getImageDimensions(file) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight,
          aspectRatio: img.naturalWidth / img.naturalHeight
        });
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ width: null, height: null, aspectRatio: null });
      };
      
      img.src = url;
    });
  }

  /**
   * Analyze image properties
   * @param {File} file - Image file
   * @returns {Promise<Object>} Image analysis
   */
  async analyzeImageProperties(file) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        try {
          // Set canvas size (sample a small area for analysis)
          const sampleSize = Math.min(100, img.naturalWidth, img.naturalHeight);
          canvas.width = sampleSize;
          canvas.height = sampleSize;
          
          // Draw image to canvas
          ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
          
          // Analyze pixel data
          const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
          const analysis = this.analyzePixelData(imageData);
          
          URL.revokeObjectURL(url);
          resolve(analysis);
          
        } catch (error) {
          URL.revokeObjectURL(url);
          resolve({});
        }
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({});
      };
      
      img.src = url;
    });
  }

  /**
   * Analyze pixel data for image properties
   * @param {ImageData} imageData - Image pixel data
   * @returns {Object} Analysis results
   */
  analyzePixelData(imageData) {
    const data = imageData.data;
    const pixelCount = data.length / 4;
    
    let hasTransparency = false;
    let totalR = 0, totalG = 0, totalB = 0;
    let minBrightness = 255, maxBrightness = 0;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      
      // Check for transparency
      if (a < 255) {
        hasTransparency = true;
      }
      
      // Calculate brightness
      const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
      minBrightness = Math.min(minBrightness, brightness);
      maxBrightness = Math.max(maxBrightness, brightness);
      
      // Sum for average color
      totalR += r;
      totalG += g;
      totalB += b;
    }
    
    return {
      hasTransparency,
      averageColor: {
        r: Math.round(totalR / pixelCount),
        g: Math.round(totalG / pixelCount),
        b: Math.round(totalB / pixelCount)
      },
      brightness: {
        min: minBrightness,
        max: maxBrightness,
        range: maxBrightness - minBrightness
      },
      contrast: maxBrightness - minBrightness
    };
  }

  /**
   * Extract EXIF data from image
   * @param {File} file - Image file
   * @returns {Promise<Object|null>} EXIF data
   */
  async extractExifData(file) {
    try {
      // This is a simplified EXIF extraction
      // In a real implementation, you'd use a library like exif-js or piexifjs
      
      if (!file.type.includes('jpeg') && !file.type.includes('tiff')) {
        return null; // EXIF is mainly in JPEG and TIFF files
      }

      const buffer = await file.arrayBuffer();
      const view = new DataView(buffer);
      
      // Look for EXIF marker in JPEG
      if (file.type.includes('jpeg')) {
        return this.extractJpegExif(view);
      }
      
      return null;
      
    } catch (error) {
      console.warn('Error extracting EXIF data:', error);
      return null;
    }
  }

  /**
   * Extract EXIF from JPEG file
   * @param {DataView} view - File data view
   * @returns {Object|null} EXIF data
   */
  extractJpegExif(view) {
    try {
      // Look for EXIF marker (0xFFE1)
      for (let i = 0; i < view.byteLength - 1; i++) {
        if (view.getUint8(i) === 0xFF && view.getUint8(i + 1) === 0xE1) {
          // Found EXIF marker
          const length = view.getUint16(i + 2);
          const exifString = String.fromCharCode(...new Uint8Array(view.buffer, i + 4, 4));
          
          if (exifString === 'Exif') {
            // Basic EXIF data extraction (simplified)
            return {
              found: true,
              marker: 'APP1',
              length: length,
              // In a real implementation, you'd parse the TIFF structure here
              note: 'EXIF data present but not fully parsed in this demo'
            };
          }
        }
      }
      
      return null;
      
    } catch (error) {
      console.warn('Error parsing JPEG EXIF:', error);
      return null;
    }
  }

  /**
   * Perform security scan on file
   * @param {File} file - File to scan
   * @returns {Promise<Object>} Security scan result
   */
  async performSecurityScan(file) {
    const scanResult = {
      result: 'clean',
      riskLevel: 'low',
      issues: [],
      scannedAt: new Date()
    };

    try {
      // Check file size for potential zip bombs
      if (file.size > 100 * 1024 * 1024) { // 100MB
        scanResult.issues.push('Large file size detected');
        scanResult.riskLevel = 'medium';
      }

      // Check for suspicious file patterns
      const suspiciousPatterns = await this.checkSuspiciousPatterns(file);
      if (suspiciousPatterns.length > 0) {
        scanResult.issues.push(...suspiciousPatterns);
        scanResult.riskLevel = 'medium';
      }

      // Check for embedded content
      const embeddedContent = await this.checkEmbeddedContent(file);
      if (embeddedContent.found) {
        scanResult.issues.push('Embedded content detected');
        scanResult.riskLevel = 'medium';
      }

      // Determine overall result
      if (scanResult.issues.length > 0) {
        scanResult.result = 'warning';
      }

      if (scanResult.riskLevel === 'high') {
        scanResult.result = 'blocked';
      }

    } catch (error) {
      console.warn('Error performing security scan:', error);
      scanResult.result = 'error';
      scanResult.issues.push('Security scan failed');
    }

    return scanResult;
  }

  /**
   * Check for suspicious patterns in file
   * @param {File} file - File to check
   * @returns {Promise<Array>} List of suspicious patterns found
   */
  async checkSuspiciousPatterns(file) {
    const issues = [];

    try {
      // Read first 1KB for pattern analysis
      const headerBuffer = await file.slice(0, 1024).arrayBuffer();
      const headerBytes = new Uint8Array(headerBuffer);
      
      // Check for executable signatures
      const executableSignatures = [
        [0x4D, 0x5A], // PE executable (MZ)
        [0x7F, 0x45, 0x4C, 0x46], // ELF executable
        [0xCA, 0xFE, 0xBA, 0xBE], // Mach-O executable
      ];

      for (const signature of executableSignatures) {
        if (this.bytesMatch(headerBytes, signature, 0)) {
          issues.push('Executable signature detected');
          break;
        }
      }

      // Check for script content in image files
      if (file.type.startsWith('image/')) {
        const textContent = new TextDecoder('utf-8', { fatal: false }).decode(headerBytes);
        const scriptPatterns = [
          /<script/i,
          /javascript:/i,
          /vbscript:/i,
          /onload=/i,
          /onerror=/i
        ];

        for (const pattern of scriptPatterns) {
          if (pattern.test(textContent)) {
            issues.push('Script content detected in image');
            break;
          }
        }
      }

    } catch (error) {
      console.warn('Error checking suspicious patterns:', error);
    }

    return issues;
  }

  /**
   * Check for embedded content in file
   * @param {File} file - File to check
   * @returns {Promise<Object>} Embedded content check result
   */
  async checkEmbeddedContent(file) {
    const result = {
      found: false,
      types: []
    };

    try {
      // Read a larger sample for embedded content detection
      const sampleSize = Math.min(file.size, 10 * 1024); // 10KB sample
      const sampleBuffer = await file.slice(0, sampleSize).arrayBuffer();
      const sampleBytes = new Uint8Array(sampleBuffer);

      // Check for ZIP signatures (embedded archives)
      const zipSignatures = [
        [0x50, 0x4B, 0x03, 0x04], // ZIP local file header
        [0x50, 0x4B, 0x05, 0x06], // ZIP end of central directory
      ];

      for (const signature of zipSignatures) {
        if (this.findBytesPattern(sampleBytes, signature)) {
          result.found = true;
          result.types.push('ZIP archive');
          break;
        }
      }

      // Check for other embedded file signatures
      const embeddedSignatures = [
        { signature: [0x25, 0x50, 0x44, 0x46], type: 'PDF document' },
        { signature: [0xD0, 0xCF, 0x11, 0xE0], type: 'Microsoft Office document' },
        { signature: [0x52, 0x61, 0x72, 0x21], type: 'RAR archive' },
      ];

      for (const { signature, type } of embeddedSignatures) {
        if (this.findBytesPattern(sampleBytes, signature)) {
          result.found = true;
          result.types.push(type);
        }
      }

    } catch (error) {
      console.warn('Error checking embedded content:', error);
    }

    return result;
  }

  /**
   * Check if bytes match at specific position
   * @param {Uint8Array} bytes - Bytes to check
   * @param {Array} pattern - Pattern to match
   * @param {number} offset - Offset to check at
   * @returns {boolean} True if matches
   */
  bytesMatch(bytes, pattern, offset) {
    if (bytes.length < offset + pattern.length) {
      return false;
    }

    for (let i = 0; i < pattern.length; i++) {
      if (bytes[offset + i] !== pattern[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Find bytes pattern in array
   * @param {Uint8Array} bytes - Bytes to search
   * @param {Array} pattern - Pattern to find
   * @returns {boolean} True if pattern found
   */
  findBytesPattern(bytes, pattern) {
    for (let i = 0; i <= bytes.length - pattern.length; i++) {
      if (this.bytesMatch(bytes, pattern, i)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Prepare file for conversion
   * @param {File} file - Original file
   * @param {Object} metadata - File metadata
   * @param {Object} options - Preparation options
   * @returns {Promise<Object>} Prepared file object
   */
  async prepareFileForConversion(file, metadata, options = {}) {
    const preparedFile = {
      originalFile: file,
      metadata,
      conversionReady: true,
      preparationTime: new Date(),
      
      // Conversion parameters
      targetFormat: options.targetFormat || 'webp',
      quality: options.quality || 85,
      maxWidth: options.maxWidth || null,
      maxHeight: options.maxHeight || null,
      
      // Processing flags
      needsResize: false,
      needsFormatConversion: false,
      needsQualityAdjustment: false,
      
      // Optimization suggestions
      optimizations: []
    };

    try {
      // Determine if resize is needed
      if (metadata.dimensions && (options.maxWidth || options.maxHeight)) {
        const { width, height } = metadata.dimensions;
        const maxW = options.maxWidth || width;
        const maxH = options.maxHeight || height;
        
        if (width > maxW || height > maxH) {
          preparedFile.needsResize = true;
          preparedFile.optimizations.push('Image will be resized to fit constraints');
        }
      }

      // Determine if format conversion is needed
      const currentFormat = metadata.detectedType?.key?.toLowerCase();
      const targetFormat = options.targetFormat?.toLowerCase();
      
      if (currentFormat && targetFormat && currentFormat !== targetFormat) {
        preparedFile.needsFormatConversion = true;
        preparedFile.optimizations.push(`Format will be converted from ${currentFormat.toUpperCase()} to ${targetFormat.toUpperCase()}`);
      }

      // Suggest quality adjustments
      if (file.size > 5 * 1024 * 1024) { // 5MB
        preparedFile.needsQualityAdjustment = true;
        preparedFile.optimizations.push('Quality may be adjusted to reduce file size');
      }

      // Add format-specific optimizations
      this.addFormatSpecificOptimizations(preparedFile, metadata, options);

    } catch (error) {
      console.warn('Error preparing file for conversion:', error);
      preparedFile.preparationErrors = [error.message];
    }

    return preparedFile;
  }

  /**
   * Add format-specific optimization suggestions
   * @param {Object} preparedFile - Prepared file object
   * @param {Object} metadata - File metadata
   * @param {Object} options - Options
   */
  addFormatSpecificOptimizations(preparedFile, metadata, options) {
    const currentFormat = metadata.detectedType?.key?.toLowerCase();
    const targetFormat = options.targetFormat?.toLowerCase();

    // WebP optimizations
    if (targetFormat === 'webp') {
      preparedFile.optimizations.push('WebP format will provide better compression');
      
      if (metadata.hasTransparency) {
        preparedFile.optimizations.push('Transparency will be preserved in WebP');
      }
    }

    // AVIF optimizations
    if (targetFormat === 'avif') {
      preparedFile.optimizations.push('AVIF format will provide excellent compression');
    }

    // JPEG optimizations
    if (targetFormat === 'jpeg' || targetFormat === 'jpg') {
      if (metadata.hasTransparency) {
        preparedFile.optimizations.push('Transparency will be lost when converting to JPEG');
      }
    }

    // PNG optimizations
    if (targetFormat === 'png') {
      if (!metadata.hasTransparency) {
        preparedFile.optimizations.push('Consider JPEG for better compression of non-transparent images');
      }
    }

    // Large image warnings
    if (metadata.dimensions) {
      const { width, height } = metadata.dimensions;
      const megapixels = (width * height) / 1000000;
      
      if (megapixels > 25) { // 25MP
        preparedFile.optimizations.push('Very large image detected - consider resizing for web use');
      }
    }
  }

  /**
   * Generate processing ID
   * @returns {string} Unique processing ID
   */
  generateProcessingId() {
    return `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update processing status
   * @param {string} processingId - Processing ID
   * @param {string} status - New status
   * @param {string} error - Error message (optional)
   */
  updateProcessingStatus(processingId, status, error = null) {
    const processing = this.processingQueue.get(processingId);
    if (processing) {
      processing.status = status;
      processing.lastUpdate = Date.now();
      if (error) {
        processing.error = error;
      }
    }
  }

  /**
   * Get processing status
   * @param {string} processingId - Processing ID
   * @returns {Object|null} Processing status
   */
  getProcessingStatus(processingId) {
    return this.processingQueue.get(processingId) || null;
  }

  /**
   * Get all processing statuses
   * @returns {Array} Array of processing statuses
   */
  getAllProcessingStatuses() {
    return Array.from(this.processingQueue.entries()).map(([id, processing]) => ({
      id,
      ...processing
    }));
  }

  /**
   * Clear completed processing entries
   */
  clearCompletedProcessing() {
    for (const [id, processing] of this.processingQueue.entries()) {
      if (processing.status === 'completed' || processing.status === 'error') {
        this.processingQueue.delete(id);
      }
    }
  }
}

// Create singleton instance
export const fileProcessor = new FileProcessor();

// Make available globally
window.fileProcessor = fileProcessor;
window.FileProcessor = FileProcessor;