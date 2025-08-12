/**
 * Metadata Extraction Utilities
 * 
 * Extracts comprehensive metadata from various file types
 * Requirements: 13.1, 13.2, 13.3, 14.3, 14.4
 */

/**
 * Metadata Extractor class for comprehensive file analysis
 */
export class MetadataExtractor {
  constructor() {
    this.extractors = new Map();
    this.setupExtractors();
  }

  /**
   * Setup format-specific extractors
   */
  setupExtractors() {
    this.extractors.set('jpeg', this.extractJpegMetadata.bind(this));
    this.extractors.set('png', this.extractPngMetadata.bind(this));
    this.extractors.set('webp', this.extractWebpMetadata.bind(this));
    this.extractors.set('gif', this.extractGifMetadata.bind(this));
    this.extractors.set('tiff', this.extractTiffMetadata.bind(this));
    this.extractors.set('bmp', this.extractBmpMetadata.bind(this));
    this.extractors.set('heic', this.extractHeicMetadata.bind(this));
    this.extractors.set('avif', this.extractAvifMetadata.bind(this));
  }

  /**
   * Extract metadata from file
   * @param {File} file - File to extract metadata from
   * @param {string} detectedFormat - Detected file format
   * @returns {Promise<Object>} Extracted metadata
   */
  async extractMetadata(file, detectedFormat) {
    const metadata = {
      // Basic information
      filename: file.name,
      size: file.size,
      type: file.type,
      lastModified: new Date(file.lastModified),
      
      // Technical metadata
      format: detectedFormat,
      dimensions: null,
      colorDepth: null,
      colorSpace: null,
      compression: null,
      quality: null,
      
      // Image properties
      hasTransparency: false,
      isAnimated: false,
      frameCount: 1,
      
      // EXIF data
      exif: null,
      
      // Color analysis
      colorProfile: null,
      dominantColors: null,
      
      // Processing metadata
      extractedAt: new Date(),
      extractionVersion: '1.0.0'
    };

    try {
      // Use format-specific extractor if available
      const extractor = this.extractors.get(detectedFormat?.toLowerCase());
      if (extractor) {
        const formatMetadata = await extractor(file);
        Object.assign(metadata, formatMetadata);
      }

      // Extract common image metadata
      if (file.type.startsWith('image/')) {
        const imageMetadata = await this.extractCommonImageMetadata(file);
        Object.assign(metadata, imageMetadata);
      }

      // Perform color analysis
      const colorAnalysis = await this.analyzeColors(file);
      Object.assign(metadata, colorAnalysis);

    } catch (error) {
      console.warn('Error extracting metadata:', error);
      metadata.extractionError = error.message;
    }

    return metadata;
  }

  /**
   * Extract JPEG metadata
   * @param {File} file - JPEG file
   * @returns {Promise<Object>} JPEG metadata
   */
  async extractJpegMetadata(file) {
    const metadata = {
      format: 'JPEG',
      compression: 'JPEG',
      hasTransparency: false
    };

    try {
      const buffer = await file.arrayBuffer();
      const view = new DataView(buffer);

      // Parse JPEG segments
      let offset = 2; // Skip SOI marker
      
      while (offset < view.byteLength - 1) {
        const marker = view.getUint16(offset);
        
        if ((marker & 0xFF00) !== 0xFF00) {
          break; // Invalid marker
        }

        const markerType = marker & 0xFF;
        
        // Skip length for certain markers
        if (markerType === 0xD8 || markerType === 0xD9) {
          offset += 2;
          continue;
        }

        const length = view.getUint16(offset + 2);
        
        // Extract EXIF data
        if (markerType === 0xE1) {
          const exifData = await this.extractJpegExif(view, offset + 4, length - 2);
          if (exifData) {
            metadata.exif = exifData;
          }
        }
        
        // Extract dimensions from SOF markers
        if (markerType >= 0xC0 && markerType <= 0xCF && markerType !== 0xC4 && markerType !== 0xC8 && markerType !== 0xCC) {
          metadata.dimensions = {
            height: view.getUint16(offset + 5),
            width: view.getUint16(offset + 7)
          };
          metadata.colorDepth = view.getUint8(offset + 4) * 8;
        }

        offset += 2 + length;
      }

    } catch (error) {
      console.warn('Error extracting JPEG metadata:', error);
    }

    return metadata;
  }

  /**
   * Extract PNG metadata
   * @param {File} file - PNG file
   * @returns {Promise<Object>} PNG metadata
   */
  async extractPngMetadata(file) {
    const metadata = {
      format: 'PNG',
      compression: 'Deflate',
      hasTransparency: false
    };

    try {
      const buffer = await file.arrayBuffer();
      const view = new DataView(buffer);

      // Skip PNG signature (8 bytes)
      let offset = 8;

      while (offset < view.byteLength) {
        const length = view.getUint32(offset);
        const type = String.fromCharCode(
          view.getUint8(offset + 4),
          view.getUint8(offset + 5),
          view.getUint8(offset + 6),
          view.getUint8(offset + 7)
        );

        if (type === 'IHDR') {
          // Image header
          metadata.dimensions = {
            width: view.getUint32(offset + 8),
            height: view.getUint32(offset + 12)
          };
          metadata.colorDepth = view.getUint8(offset + 16);
          const colorType = view.getUint8(offset + 17);
          
          // Determine if has transparency
          metadata.hasTransparency = colorType === 4 || colorType === 6;
          
          // Color space
          metadata.colorSpace = this.getPngColorSpace(colorType);
        }

        if (type === 'tRNS') {
          metadata.hasTransparency = true;
        }

        if (type === 'IEND') {
          break;
        }

        offset += 12 + length; // 4 (length) + 4 (type) + length + 4 (CRC)
      }

    } catch (error) {
      console.warn('Error extracting PNG metadata:', error);
    }

    return metadata;
  }

  /**
   * Extract WebP metadata
   * @param {File} file - WebP file
   * @returns {Promise<Object>} WebP metadata
   */
  async extractWebpMetadata(file) {
    const metadata = {
      format: 'WebP',
      compression: 'WebP',
      hasTransparency: false,
      isAnimated: false
    };

    try {
      const buffer = await file.arrayBuffer();
      const view = new DataView(buffer);

      // Check WebP format
      const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
      const webp = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));

      if (riff !== 'RIFF' || webp !== 'WEBP') {
        throw new Error('Invalid WebP file');
      }

      // Parse WebP chunks
      let offset = 12;
      
      while (offset < view.byteLength) {
        const chunkType = String.fromCharCode(
          view.getUint8(offset),
          view.getUint8(offset + 1),
          view.getUint8(offset + 2),
          view.getUint8(offset + 3)
        );
        
        const chunkSize = view.getUint32(offset + 4, true);

        if (chunkType === 'VP8 ') {
          // Simple WebP
          metadata.compression = 'VP8 (Lossy)';
          const dimensions = this.parseVP8Dimensions(view, offset + 8);
          if (dimensions) {
            metadata.dimensions = dimensions;
          }
        } else if (chunkType === 'VP8L') {
          // Lossless WebP
          metadata.compression = 'VP8L (Lossless)';
          const dimensions = this.parseVP8LDimensions(view, offset + 8);
          if (dimensions) {
            metadata.dimensions = dimensions;
          }
        } else if (chunkType === 'VP8X') {
          // Extended WebP
          const flags = view.getUint8(offset + 8);
          metadata.hasTransparency = (flags & 0x10) !== 0;
          metadata.isAnimated = (flags & 0x02) !== 0;
          
          metadata.dimensions = {
            width: (view.getUint32(offset + 12, true) & 0xFFFFFF) + 1,
            height: (view.getUint32(offset + 15, true) & 0xFFFFFF) + 1
          };
        }

        offset += 8 + chunkSize + (chunkSize % 2); // Pad to even boundary
      }

    } catch (error) {
      console.warn('Error extracting WebP metadata:', error);
    }

    return metadata;
  }

  /**
   * Extract GIF metadata
   * @param {File} file - GIF file
   * @returns {Promise<Object>} GIF metadata
   */
  async extractGifMetadata(file) {
    const metadata = {
      format: 'GIF',
      compression: 'LZW',
      hasTransparency: false,
      isAnimated: false,
      frameCount: 1
    };

    try {
      const buffer = await file.arrayBuffer();
      const view = new DataView(buffer);

      // Check GIF signature
      const signature = String.fromCharCode(
        view.getUint8(0), view.getUint8(1), view.getUint8(2),
        view.getUint8(3), view.getUint8(4), view.getUint8(5)
      );

      if (signature !== 'GIF87a' && signature !== 'GIF89a') {
        throw new Error('Invalid GIF file');
      }

      // Extract dimensions
      metadata.dimensions = {
        width: view.getUint16(6, true),
        height: view.getUint16(8, true)
      };

      // Parse global color table info
      const packed = view.getUint8(10);
      const globalColorTableFlag = (packed & 0x80) !== 0;
      const colorResolution = ((packed & 0x70) >> 4) + 1;
      const globalColorTableSize = 2 << (packed & 0x07);

      metadata.colorDepth = colorResolution;

      // Count frames and check for transparency
      let offset = 13;
      if (globalColorTableFlag) {
        offset += globalColorTableSize * 3;
      }

      let frameCount = 0;
      
      while (offset < view.byteLength) {
        const separator = view.getUint8(offset);
        
        if (separator === 0x21) { // Extension
          const label = view.getUint8(offset + 1);
          
          if (label === 0xF9) { // Graphic Control Extension
            const packed = view.getUint8(offset + 3);
            if ((packed & 0x01) !== 0) {
              metadata.hasTransparency = true;
            }
          }
          
          // Skip extension
          offset += 2;
          let blockSize = view.getUint8(offset);
          while (blockSize > 0) {
            offset += 1 + blockSize;
            blockSize = view.getUint8(offset);
          }
          offset += 1; // Skip terminator
          
        } else if (separator === 0x2C) { // Image descriptor
          frameCount++;
          offset += 10; // Skip image descriptor
          
          // Skip local color table if present
          const packed = view.getUint8(offset - 1);
          if ((packed & 0x80) !== 0) {
            const localColorTableSize = 2 << (packed & 0x07);
            offset += localColorTableSize * 3;
          }
          
          // Skip LZW minimum code size
          offset += 1;
          
          // Skip image data
          let blockSize = view.getUint8(offset);
          while (blockSize > 0) {
            offset += 1 + blockSize;
            blockSize = view.getUint8(offset);
          }
          offset += 1; // Skip terminator
          
        } else if (separator === 0x3B) { // Trailer
          break;
        } else {
          offset++;
        }
      }

      metadata.frameCount = frameCount;
      metadata.isAnimated = frameCount > 1;

    } catch (error) {
      console.warn('Error extracting GIF metadata:', error);
    }

    return metadata;
  }

  /**
   * Extract TIFF metadata
   * @param {File} file - TIFF file
   * @returns {Promise<Object>} TIFF metadata
   */
  async extractTiffMetadata(file) {
    const metadata = {
      format: 'TIFF',
      compression: 'Unknown',
      hasTransparency: false
    };

    try {
      const buffer = await file.arrayBuffer();
      const view = new DataView(buffer);

      // Check TIFF header
      const byteOrder = view.getUint16(0);
      const littleEndian = byteOrder === 0x4949;
      
      const magic = view.getUint16(2, littleEndian);
      if (magic !== 42) {
        throw new Error('Invalid TIFF file');
      }

      // Parse first IFD
      const ifdOffset = view.getUint32(4, littleEndian);
      const ifdEntryCount = view.getUint16(ifdOffset, littleEndian);

      for (let i = 0; i < ifdEntryCount; i++) {
        const entryOffset = ifdOffset + 2 + (i * 12);
        const tag = view.getUint16(entryOffset, littleEndian);
        const type = view.getUint16(entryOffset + 2, littleEndian);
        const count = view.getUint32(entryOffset + 4, littleEndian);
        const valueOffset = view.getUint32(entryOffset + 8, littleEndian);

        switch (tag) {
          case 256: // ImageWidth
            if (!metadata.dimensions) metadata.dimensions = {};
            metadata.dimensions.width = this.getTiffValue(view, type, count, valueOffset, littleEndian);
            break;
          case 257: // ImageLength
            if (!metadata.dimensions) metadata.dimensions = {};
            metadata.dimensions.height = this.getTiffValue(view, type, count, valueOffset, littleEndian);
            break;
          case 258: // BitsPerSample
            metadata.colorDepth = this.getTiffValue(view, type, count, valueOffset, littleEndian);
            break;
          case 259: // Compression
            const compressionType = this.getTiffValue(view, type, count, valueOffset, littleEndian);
            metadata.compression = this.getTiffCompressionName(compressionType);
            break;
          case 262: // PhotometricInterpretation
            const photometric = this.getTiffValue(view, type, count, valueOffset, littleEndian);
            metadata.colorSpace = this.getTiffColorSpace(photometric);
            break;
        }
      }

    } catch (error) {
      console.warn('Error extracting TIFF metadata:', error);
    }

    return metadata;
  }

  /**
   * Extract BMP metadata
   * @param {File} file - BMP file
   * @returns {Promise<Object>} BMP metadata
   */
  async extractBmpMetadata(file) {
    const metadata = {
      format: 'BMP',
      compression: 'None',
      hasTransparency: false
    };

    try {
      const buffer = await file.arrayBuffer();
      const view = new DataView(buffer);

      // Check BMP signature
      const signature = String.fromCharCode(view.getUint8(0), view.getUint8(1));
      if (signature !== 'BM') {
        throw new Error('Invalid BMP file');
      }

      // Read DIB header size
      const dibHeaderSize = view.getUint32(14, true);
      
      if (dibHeaderSize >= 40) { // BITMAPINFOHEADER or later
        metadata.dimensions = {
          width: Math.abs(view.getInt32(18, true)),
          height: Math.abs(view.getInt32(22, true))
        };
        
        metadata.colorDepth = view.getUint16(28, true);
        
        const compressionMethod = view.getUint32(30, true);
        metadata.compression = this.getBmpCompressionName(compressionMethod);
      }

    } catch (error) {
      console.warn('Error extracting BMP metadata:', error);
    }

    return metadata;
  }

  /**
   * Extract HEIC metadata
   * @param {File} file - HEIC file
   * @returns {Promise<Object>} HEIC metadata
   */
  async extractHeicMetadata(file) {
    const metadata = {
      format: 'HEIC',
      compression: 'HEVC',
      hasTransparency: false
    };

    try {
      // HEIC parsing is complex and would require a specialized library
      // This is a simplified version that extracts basic information
      
      const buffer = await file.arrayBuffer();
      const view = new DataView(buffer);

      // Look for ftyp box
      if (view.byteLength >= 12) {
        const boxSize = view.getUint32(0);
        const boxType = String.fromCharCode(
          view.getUint8(4), view.getUint8(5), view.getUint8(6), view.getUint8(7)
        );
        
        if (boxType === 'ftyp') {
          const brand = String.fromCharCode(
            view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11)
          );
          
          if (brand === 'heic' || brand === 'mif1') {
            metadata.format = 'HEIC';
          } else if (brand === 'heif') {
            metadata.format = 'HEIF';
          }
        }
      }

      // Note: Full HEIC parsing would require parsing the entire box structure
      // and extracting dimensions from the image properties

    } catch (error) {
      console.warn('Error extracting HEIC metadata:', error);
    }

    return metadata;
  }

  /**
   * Extract AVIF metadata
   * @param {File} file - AVIF file
   * @returns {Promise<Object>} AVIF metadata
   */
  async extractAvifMetadata(file) {
    const metadata = {
      format: 'AVIF',
      compression: 'AV1',
      hasTransparency: false
    };

    try {
      // Similar to HEIC, AVIF parsing is complex
      // This is a simplified version
      
      const buffer = await file.arrayBuffer();
      const view = new DataView(buffer);

      // Look for ftyp box
      if (view.byteLength >= 12) {
        const boxSize = view.getUint32(0);
        const boxType = String.fromCharCode(
          view.getUint8(4), view.getUint8(5), view.getUint8(6), view.getUint8(7)
        );
        
        if (boxType === 'ftyp') {
          const brand = String.fromCharCode(
            view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11)
          );
          
          if (brand === 'avif') {
            metadata.format = 'AVIF';
          }
        }
      }

    } catch (error) {
      console.warn('Error extracting AVIF metadata:', error);
    }

    return metadata;
  }

  /**
   * Extract common image metadata using Canvas API
   * @param {File} file - Image file
   * @returns {Promise<Object>} Common image metadata
   */
  async extractCommonImageMetadata(file) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        const metadata = {
          dimensions: {
            width: img.naturalWidth,
            height: img.naturalHeight,
            aspectRatio: img.naturalWidth / img.naturalHeight
          }
        };
        
        URL.revokeObjectURL(url);
        resolve(metadata);
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({});
      };
      
      img.src = url;
    });
  }

  /**
   * Analyze colors in image
   * @param {File} file - Image file
   * @returns {Promise<Object>} Color analysis
   */
  async analyzeColors(file) {
    if (!file.type.startsWith('image/')) {
      return {};
    }

    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Sample a smaller version for performance
          const sampleSize = 100;
          canvas.width = sampleSize;
          canvas.height = sampleSize;
          
          ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
          const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
          
          const colorAnalysis = this.performColorAnalysis(imageData);
          
          URL.revokeObjectURL(url);
          resolve(colorAnalysis);
          
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
   * Perform color analysis on image data
   * @param {ImageData} imageData - Image pixel data
   * @returns {Object} Color analysis results
   */
  performColorAnalysis(imageData) {
    const data = imageData.data;
    const pixelCount = data.length / 4;
    
    const colorCounts = new Map();
    let totalR = 0, totalG = 0, totalB = 0;
    let hasTransparency = false;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      
      if (a < 255) {
        hasTransparency = true;
      }
      
      totalR += r;
      totalG += g;
      totalB += b;
      
      // Quantize colors for dominant color detection
      const quantizedR = Math.floor(r / 32) * 32;
      const quantizedG = Math.floor(g / 32) * 32;
      const quantizedB = Math.floor(b / 32) * 32;
      const colorKey = `${quantizedR},${quantizedG},${quantizedB}`;
      
      colorCounts.set(colorKey, (colorCounts.get(colorKey) || 0) + 1);
    }
    
    // Find dominant colors
    const sortedColors = Array.from(colorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([color, count]) => {
        const [r, g, b] = color.split(',').map(Number);
        return {
          rgb: { r, g, b },
          hex: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`,
          percentage: Math.round((count / pixelCount) * 100)
        };
      });
    
    return {
      hasTransparency,
      averageColor: {
        r: Math.round(totalR / pixelCount),
        g: Math.round(totalG / pixelCount),
        b: Math.round(totalB / pixelCount)
      },
      dominantColors: sortedColors
    };
  }

  // Helper methods for format-specific parsing

  /**
   * Extract JPEG EXIF data
   * @param {DataView} view - Data view
   * @param {number} offset - Offset to EXIF data
   * @param {number} length - Length of EXIF data
   * @returns {Promise<Object|null>} EXIF data
   */
  async extractJpegExif(view, offset, length) {
    try {
      // Check for EXIF identifier
      const exifId = String.fromCharCode(
        view.getUint8(offset), view.getUint8(offset + 1),
        view.getUint8(offset + 2), view.getUint8(offset + 3)
      );
      
      if (exifId !== 'Exif') {
        return null;
      }
      
      // Skip null bytes and parse TIFF header
      const tiffOffset = offset + 6;
      const byteOrder = view.getUint16(tiffOffset);
      const littleEndian = byteOrder === 0x4949;
      
      // Basic EXIF extraction (simplified)
      return {
        byteOrder: littleEndian ? 'little-endian' : 'big-endian',
        found: true,
        // In a real implementation, you would parse the IFD structure here
      };
      
    } catch (error) {
      return null;
    }
  }

  /**
   * Parse VP8 dimensions from WebP
   * @param {DataView} view - Data view
   * @param {number} offset - Offset to VP8 data
   * @returns {Object|null} Dimensions
   */
  parseVP8Dimensions(view, offset) {
    try {
      // Skip VP8 frame header
      const frameStart = view.getUint32(offset, true) & 0xFFFFFF;
      if ((frameStart & 0x01) !== 0) return null; // Key frame check
      
      // Parse dimensions (simplified)
      const width = view.getUint16(offset + 6, true) & 0x3FFF;
      const height = view.getUint16(offset + 8, true) & 0x3FFF;
      
      return { width, height };
    } catch (error) {
      return null;
    }
  }

  /**
   * Parse VP8L dimensions from WebP
   * @param {DataView} view - Data view
   * @param {number} offset - Offset to VP8L data
   * @returns {Object|null} Dimensions
   */
  parseVP8LDimensions(view, offset) {
    try {
      const signature = view.getUint8(offset);
      if (signature !== 0x2F) return null;
      
      const bits = view.getUint32(offset + 1, true);
      const width = (bits & 0x3FFF) + 1;
      const height = ((bits >> 14) & 0x3FFF) + 1;
      
      return { width, height };
    } catch (error) {
      return null;
    }
  }

  /**
   * Get PNG color space from color type
   * @param {number} colorType - PNG color type
   * @returns {string} Color space description
   */
  getPngColorSpace(colorType) {
    const colorSpaces = {
      0: 'Grayscale',
      2: 'RGB',
      3: 'Indexed',
      4: 'Grayscale + Alpha',
      6: 'RGB + Alpha'
    };
    return colorSpaces[colorType] || 'Unknown';
  }

  /**
   * Get TIFF value from IFD entry
   * @param {DataView} view - Data view
   * @param {number} type - Value type
   * @param {number} count - Value count
   * @param {number} valueOffset - Value offset
   * @param {boolean} littleEndian - Byte order
   * @returns {number} Value
   */
  getTiffValue(view, type, count, valueOffset, littleEndian) {
    if (count === 1) {
      switch (type) {
        case 1: // BYTE
        case 2: // ASCII
          return view.getUint8(valueOffset);
        case 3: // SHORT
          return view.getUint16(valueOffset, littleEndian);
        case 4: // LONG
          return view.getUint32(valueOffset, littleEndian);
        default:
          return valueOffset;
      }
    }
    return valueOffset; // For multiple values, return offset
  }

  /**
   * Get TIFF compression name
   * @param {number} compression - Compression type
   * @returns {string} Compression name
   */
  getTiffCompressionName(compression) {
    const compressions = {
      1: 'None',
      2: 'CCITT 1D',
      3: 'Group 3 Fax',
      4: 'Group 4 Fax',
      5: 'LZW',
      6: 'JPEG (old)',
      7: 'JPEG',
      8: 'Deflate',
      32773: 'PackBits'
    };
    return compressions[compression] || `Unknown (${compression})`;
  }

  /**
   * Get TIFF color space
   * @param {number} photometric - Photometric interpretation
   * @returns {string} Color space
   */
  getTiffColorSpace(photometric) {
    const colorSpaces = {
      0: 'WhiteIsZero',
      1: 'BlackIsZero',
      2: 'RGB',
      3: 'Palette',
      4: 'Transparency Mask',
      5: 'CMYK',
      6: 'YCbCr'
    };
    return colorSpaces[photometric] || 'Unknown';
  }

  /**
   * Get BMP compression name
   * @param {number} compression - Compression method
   * @returns {string} Compression name
   */
  getBmpCompressionName(compression) {
    const compressions = {
      0: 'None (BI_RGB)',
      1: 'RLE 8-bit',
      2: 'RLE 4-bit',
      3: 'Bitfields',
      4: 'JPEG',
      5: 'PNG'
    };
    return compressions[compression] || `Unknown (${compression})`;
  }
}

// Create singleton instance
export const metadataExtractor = new MetadataExtractor();

// Make available globally
window.metadataExtractor = metadataExtractor;
window.MetadataExtractor = MetadataExtractor;