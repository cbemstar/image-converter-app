// special-formats.js - Handlers for special image formats (HEIC/HEIF, RAW)
import { showNotification, compressToTargetSize } from '../../utils.js';

// HEIC/HEIF conversion (extracted from hybridConvert)
export async function convertHeic(file, format, targetBytes) {
  updateProcessingStatus('heic', 'start');
  try {
    // Use the new heic-to library instead of heic2any
    const outputType = format === 'jpeg' ? 'image/jpeg' : 
                      format === 'png' ? 'image/png' : 
                      format === 'webp' ? 'image/webp' : 'image/avif';
    
    // Check if file is HEIC format
    const isHeicFormat = await HeicTo.isHeic(file);
    
    if (!isHeicFormat) {
      throw new Error('Not a valid HEIC/HEIF image');
    }
    
    // Get WebP lossless setting if applicable
    const isLossless = format === 'webp' && document.getElementById('webp-lossless')?.checked;
    
    // Convert using heic-to with appropriate settings
    const initialBlob = await HeicTo({
      blob: file,
      type: outputType,
      quality: isLossless ? undefined : 0.95
    });

    // Draw to canvas for target-size compression
    const bitmap = await createImageBitmap(initialBlob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);

    const blob = await compressToTargetSize(canvas, outputType, targetBytes);
    let ext = format === 'jpeg' ? 'jpg' : format;
    updateProcessingStatus('heic', 'end');
    return { blob, filename: file.name.replace(/\.[^.]+$/, '') + '.' + ext };
  } catch (err) {
    console.error("HEIC conversion with heic-to failed:", err);
    
    // Try fallback with libheif
    try {
      updateProcessingStatus('heic', 'start');
      showNotification('Primary HEIC conversion failed. Trying alternative method...', 'warning');
      
      const arrayBuffer = await file.arrayBuffer();
      const decoder = new libheif.HeifDecoder();
      const data = new Uint8Array(arrayBuffer);
      const images = decoder.decode(data);
      
      if (!images || images.length === 0) {
        throw new Error('No images found in HEIC file');
      }
      
      // Get primary image
      const image = images[0];
      const width = image.get_width();
      const height = image.get_height();
      
      // Create canvas and draw image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      // Get image data
      const imageData = ctx.createImageData(width, height);
      
      // Use promise to handle the display callback
      const displayResult = await new Promise((resolve, reject) => {
        image.display(imageData, (displayData) => {
          if (!displayData) {
            reject(new Error('Failed to process HEIC image data'));
            return;
          }
          ctx.putImageData(displayData, 0, 0);
          resolve(true);
        });
      });
      
      // Convert to requested format
      let mime = format === 'jpeg' ? 'image/jpeg' : 
                format === 'png' ? 'image/png' : 
                format === 'webp' ? 'image/webp' : 'image/avif';
      let ext = format === 'jpeg' ? 'jpg' : format;
      
      // Convert canvas to blob using target size
      const blobFromCanvas = await compressToTargetSize(canvas, mime, targetBytes);
      
      updateProcessingStatus('heic', 'end');
      showNotification('Successfully converted HEIC image using fallback method', 'info');
      return { blob: blobFromCanvas, filename: file.name.replace(/\.[^.]+$/, '') + '.' + ext };
    } catch (fallbackErr) {
      console.error("HEIC fallback conversion failed:", fallbackErr);
      updateProcessingStatus('heic', 'end');
      throw new Error(`HEIC/HEIF conversion failed with all methods. Error: ${err.message}. Please try a different browser or convert the image using another tool first.`);
    }
  }
}

// RAW conversion (extracted from hybridConvert)
export async function convertRaw(file, format, targetBytes) {
  updateProcessingStatus('raw', 'start');
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // Check if RAW-WASM is available
    if (!window.RawWasm) {
      throw new Error('RAW image processing library not loaded. Please refresh the page and try again.');
    }
    
    // Decode RAW file
    const raw = await window.RawWasm.decode(new Uint8Array(arrayBuffer));
    
    if (!raw || !raw.width || !raw.height || !raw.data) {
      throw new Error('Failed to decode RAW image data. This RAW format may not be supported.');
    }
    
    // Create canvas and set dimensions
    const canvas = document.createElement('canvas');
    canvas.width = raw.width;
    canvas.height = raw.height;
    const ctx = canvas.getContext('2d');
    
    // Create image data and set decoded pixel data
    const imageData = ctx.createImageData(raw.width, raw.height);
    
    // Handle different bit depths and color spaces
    if (raw.data instanceof Uint8Array) {
      imageData.data.set(raw.data);
    } else if (raw.data instanceof Uint16Array) {
      // Convert 16-bit data to 8-bit for canvas
      const data8bit = new Uint8Array(raw.width * raw.height * 4);
      for (let i = 0; i < raw.data.length; i++) {
        // Convert 16-bit to 8-bit by dividing by 256
        data8bit[i] = raw.data[i] >> 8;
      }
      imageData.data.set(data8bit);
    } else {
      throw new Error('Unsupported RAW data format');
    }
    
    // Put image data on canvas
    ctx.putImageData(imageData, 0, 0);
    
    // Apply basic auto-levels to improve visibility
    applyAutoLevels(canvas);
    
    // Determine output format
    let mime;
    if (format === 'jpeg') mime = 'image/jpeg';
    else if (format === 'png') mime = 'image/png';
    else if (format === 'webp') mime = 'image/webp';
    else if (format === 'avif') mime = 'image/avif';
    else if (format === 'bmp') mime = 'image/bmp';
    else if (format === 'tiff') mime = 'image/tiff';
    else if (format === 'gif') mime = 'image/gif';
    else if (format === 'ico') mime = 'image/x-icon';
    else mime = 'image/jpeg'; // Default to JPEG
    
    let ext = format === 'jpeg' ? 'jpg' : format;
    
    // Convert canvas to blob with specified format
    const blob = await compressToTargetSize(canvas, mime, targetBytes);
    
    updateProcessingStatus('raw', 'end');
    return { blob, filename: file.name.replace(/\.[^.]+$/, '') + '.' + ext };
  } catch (err) {
    updateProcessingStatus('raw', 'end');
    console.error('RAW conversion error:', err);
    throw new Error(`RAW conversion failed: ${err.message || 'Unknown error'}. This RAW format may not be supported.`);
  }
}

function applyAutoLevels(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // Find min and max values for each channel
  let rMin = 255, gMin = 255, bMin = 255;
  let rMax = 0, gMax = 0, bMax = 0;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    rMin = Math.min(rMin, r);
    gMin = Math.min(gMin, g);
    bMin = Math.min(bMin, b);
    
    rMax = Math.max(rMax, r);
    gMax = Math.max(gMax, g);
    bMax = Math.max(bMax, b);
  }
  
  // Apply auto-levels if there's enough dynamic range
  if (rMax > rMin && gMax > gMin && bMax > bMin) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 * (data[i] - rMin) / (rMax - rMin);
      data[i + 1] = 255 * (data[i + 1] - gMin) / (gMax - gMin);
      data[i + 2] = 255 * (data[i + 2] - bMin) / (bMax - bMin);
    }
    ctx.putImageData(imageData, 0, 0);
  }
}

function updateProcessingStatus(format, action) {
  let message = '';
  if (format === 'heic') {
    message = action === 'start' ? 'Processing HEIC/HEIF image... This may take a moment.' : '';
  } else if (format === 'raw') {
    message = action === 'start' ? 'Processing RAW image... This may take a moment.' : '';
  }
  
  if (message) {
    const statusDiv = document.createElement('div');
    statusDiv.id = `${format}-status`;
    statusDiv.style.color = '#7fd7c4';
    statusDiv.style.textAlign = 'center';
    statusDiv.style.margin = '8px 0';
    statusDiv.textContent = message;
    
    // Remove existing status if there is one
    const existingStatus = document.getElementById(`${format}-status`);
    if (existingStatus) existingStatus.remove();
    
    if (action === 'start') {
      // Insert after progress status
      const progressStatus = document.getElementById('progress-status');
      if (progressStatus) {
        progressStatus.parentNode.insertBefore(statusDiv, progressStatus.nextSibling);
      } else {
        document.body.appendChild(statusDiv);
      }
    }
  } else if (action === 'end') {
    // Remove the status message
    const existingStatus = document.getElementById(`${format}-status`);
    if (existingStatus) existingStatus.remove();
  }
}

// Initialize special format libraries
export async function initSpecialFormatLibraries() {
  let success = true;
  
  // Initialize HEIC libraries
  try {
    // Check if the HeicTo object is available
    if (typeof HeicTo === 'undefined') {
      console.error('HeicTo library not found. HEIC/HEIF conversion will not work.');
      success = false;
    } else {
      console.log('HEIC conversion library found');
    }
    
    // Check if libheif is available as fallback
    if (typeof libheif === 'undefined') {
      console.warn('libheif library not found. Fallback HEIC conversion will not be available.');
    } else {
      console.log('HEIC fallback library found');
    }
  } catch (err) {
    console.error('Error initializing HEIC libraries:', err);
    success = false;
  }
  
  // Initialize RAW processing
  try {
    if (typeof RawWasm === 'undefined') {
      console.error('RAW-WASM library not found. RAW conversion will not work.');
      success = false;
    } else {
      window.RawWasm = RawWasm;
      console.log('RAW image processing library found');
    }
  } catch (err) {
    console.error('Error initializing RAW-WASM:', err);
    success = false;
  }
  
  return success;
}

// Initialize AVIF libraries
export async function initAvifLibraries() {
  let success = true;
  
  // Initialize AVIF decoder
  try {
    if (typeof avifDec !== 'undefined') {
      await avifDec.default();
      window.avifDecInit = true;
      console.log('AVIF decoder initialized successfully');
    } else {
      console.error('AVIF decoder not found');
      success = false;
    }
  } catch (err) {
    console.error('Error initializing AVIF decoder:', err);
    success = false;
  }
  
  // Initialize AVIF encoder
  try {
    if (typeof avifEnc !== 'undefined') {
      await avifEnc.default();
      window.avifEncInit = true;
      console.log('AVIF encoder initialized successfully');
    } else {
      console.error('AVIF encoder not found');
      success = false;
    }
  } catch (err) {
    console.error('Error initializing AVIF encoder:', err);
    success = false;
  }
  
  return success;
}