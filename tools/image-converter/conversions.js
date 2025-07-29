// conversions.js - Core image conversion functions

import { 
  isAvif, 
  isHeic, 
  isRaw, 
  isTiff, 
  isBmp, 
  isGif, 
  isSvg, 
  isIco, 
  showNotification, 
  getQuotaInfo, 
  setQuotaInfo, 
  updateQuotaStatus,
  fixDownloadButtonDisplay,
  formatFileSize
} from '../../utils.js';

import {
  convertHeic,
  convertRaw,
  initSpecialFormatLibraries,
  initAvifLibraries
} from './special-formats.js';
import { compressToTargetSize } from '../../utils.js';

// Main hybrid conversion function
export async function hybridConvert(file, maxW, maxH, targetBytes, format, onProgress) {
  if (isHeic(file)) {
    return convertHeic(file, format, targetBytes);
  }

  if (isRaw(file)) {
    return convertRaw(file, format, targetBytes);
  }
  
  if (isAvif(file)) {
    if (format === 'avif') {
      // No conversion needed, just return
      return { blob: file, filename: file.name };
    }
    // Decode AVIF to canvas using @jsquash/avif, then encode to target format
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // Initialize AVIF decoder if needed
      if (!window.avifDecInit) {
        window.avifDecInit = true;
        await avifDec.default();
      }
      
      // Decode AVIF image
      const imageData = await avifDec.decode(new Uint8Array(arrayBuffer));
      
      // Create canvas and draw the decoded image
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      ctx.putImageData(imageData, 0, 0);
      
      // Convert to target format
      let mime = format === 'jpeg' ? 'image/jpeg' : 
                format === 'png' ? 'image/png' : 
                format === 'webp' ? 'image/webp' : 'image/gif';
      let ext = format === 'jpeg' ? 'jpg' : format;
      
      // Convert canvas to blob respecting target size
      const blob = await compressToTargetSize(canvas, mime, targetBytes);
      return { blob, filename: file.name.replace(/\.[^.]+$/, '') + '.' + ext };
    } catch (err) {
      throw new Error('AVIF decoding failed: ' + err.message);
    }
  }
  
  if (format === 'avif') {
    try {
      // Convert input file to ImageBitmap
      const imgBitmap = await createImageBitmap(file);
      
      // Create canvas and draw the image
      const canvas = document.createElement('canvas');
      canvas.width = imgBitmap.width;
      canvas.height = imgBitmap.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgBitmap, 0, 0);
      
      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Initialize AVIF encoder if needed
      if (!window.avifEncInit) {
        try {
          console.log('Initializing AVIF encoder...');
          if (typeof avifEnc === 'undefined') {
            throw new Error('AVIF encoder module not loaded. Please refresh the page and try again.');
          }
          
          // Make sure avifEnc is properly defined before using it
          if (typeof avifEnc.default !== 'function') {
            throw new Error('AVIF encoder module is not properly initialized. Please refresh the page and try again.');
          }
          
          await avifEnc.default();
          window.avifEncInit = true;
          console.log('AVIF encoder initialized successfully');
        } catch (initErr) {
          console.error('Failed to initialize AVIF encoder:', initErr);
          throw new Error('Failed to initialize AVIF encoder: ' + initErr.message);
        }
      }
      
      // Double check if encoder is available and properly initialized
      if (typeof avifEnc === 'undefined') {
        throw new Error('AVIF encoder not available. Please refresh the page and try again.');
      }
      
      if (typeof avifEnc.encode !== 'function') {
        throw new Error('AVIF encode function not available. Please refresh the page and try again.');
      }
      
      // Encode to AVIF with error handling
      console.log('Starting AVIF encoding...');
      let minQ = 0.1;
      let maxQ = 1.0;
      let bestBlob = null;
      for (let i = 0; i < 7; i++) {
        const q = (minQ + maxQ) / 2;
        const avifData = await avifEnc.encode(imageData, {
          quality: Math.round(q * 100),
          speed: 5,
          alpha_quality: 100
        });
        const blobCandidate = new Blob([avifData], { type: 'image/avif' });
        if (targetBytes && blobCandidate.size > targetBytes) {
          maxQ = q;
        } else {
          bestBlob = blobCandidate;
          minQ = q;
          if (!targetBytes || targetBytes - blobCandidate.size < targetBytes * 0.05) break;
        }
      }
      const finalBlob = bestBlob || new Blob([await avifEnc.encode(imageData,{quality:80})],{type:'image/avif'});
      return { blob: finalBlob, filename: file.name.replace(/\.[^.]+$/, '') + '.avif' };
    } catch (err) {
      console.error('AVIF encoding error:', err);
      throw new Error('AVIF encoding failed: ' + err.message);
    }
  }
  
  // TIFF/BMP/GIF/SVG/ICO input: rasterize to canvas, then encode
  if (isTiff(file) || isBmp(file) || isGif(file) || isSvg(file) || isIco(file)) {
    // GIF: warn if animated
    if (isGif(file)) {
      // Only static GIFs supported
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      // Check for animated GIF (netscape extension)
      if (bytes.includes(0x21) && bytes.includes(0xFF) && bytes.includes(0x0B) && bytes.includes(0x4E) && bytes.includes(0x45) && bytes.includes(0x54) && bytes.includes(0x53) && bytes.includes(0x43) && bytes.includes(0x41) && bytes.includes(0x50) && bytes.includes(0x45)) {
        throw new Error('Animated GIFs are not supported.');
      }
    }
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = function() {
        let [w, h] = [img.width, img.height];
        let scale = Math.min(maxW / w, maxH / h, 1);
        let nw = Math.round(w * scale), nh = Math.round(h * scale);
        let canvas = document.createElement('canvas');
        canvas.width = nw;
        canvas.height = nh;
        let ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, nw, nh);
        let mime = format === 'jpeg' ? 'image/jpeg' : format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : format === 'avif' ? 'image/avif' : format === 'bmp' ? 'image/bmp' : format === 'tiff' ? 'image/tiff' : format === 'gif' ? 'image/gif' : 'image/x-icon';
        let ext = format === 'jpeg' ? 'jpg' : format;
        compressToTargetSize(canvas, mime, targetBytes).then(blob => {
          if (!blob) reject(new Error('Conversion failed'));
          else resolve({ blob, filename: file.name.replace(/\.[^.]+$/, '') + '.' + ext });
        });
      };
      img.onerror = function() { reject(new Error('Image load failed')); };
      img.src = URL.createObjectURL(file);
    });
  }
  
  // In-browser conversion for all file sizes
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = function() {
      const w = img.width, h = img.height;
      const scale = Math.min(maxW / w, maxH / h, 1);
      const nw = Math.round(w * scale), nh = Math.round(h * scale);
      const canvas = document.createElement('canvas');
      canvas.width = nw;
      canvas.height = nh;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, nw, nh);
      const mime = `image/${format}`;
      const ext = format === 'jpeg' ? 'jpg' : format;
      
      // Apply format-specific options
      if (format === 'webp') {
        const isLossless = document.getElementById('webp-lossless')?.checked;
        compressToTargetSize(canvas, mime, isLossless ? 0 : targetBytes).then(blob => {
          if (!blob) reject(new Error('Conversion failed'));
          else resolve({ blob, filename: file.name.replace(/\.[^.]+$/, '') + `.${ext}` });
        });
      } else if (format === 'png') {
        // For PNG, we can't control compression directly with canvas API
        canvas.toBlob(blob => {
          if (!blob) reject(new Error('Conversion failed'));
          else resolve({ blob, filename: file.name.replace(/\.[^.]+$/, '') + `.${ext}` });
        }, mime);
      } else {
        compressToTargetSize(canvas, mime, targetBytes).then(blob => {
          if (!blob) reject(new Error('Conversion failed'));
          else resolve({ blob, filename: file.name.replace(/\.[^.]+$/, '') + `.${ext}` });
        });
      }
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = URL.createObjectURL(file);
  });
}

// Batch processing function (extracted from main script)
export async function processImages(files, maxW, maxH, targetBytes, format) {
  if (!files || !Array.isArray(files) || files.length === 0) {
    showNotification('No valid files to process', 'error');
    return;
  }
  
  const zip = new JSZip();
  let processed = 0;
  window._webpImages = window._webpImages || [];
  
  // Show progress bar and status
  const progressStatus = document.getElementById('progress-status');
  const progressBar = document.getElementById('progress-bar');
  const progressContainer = document.getElementById('progress-bar-container');

  if (progressContainer) progressContainer.style.display = 'block';
  if (progressStatus) progressStatus.textContent = `Converting 1 of ${files.length}`;
  if (progressBar) progressBar.style.width = '0%';
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file) {
      console.error(`Skipping undefined file at index ${i}`);
      continue;
    }
    
    try {
      const { blob, filename } = await hybridConvert(file, maxW, maxH, targetBytes, format);
      
      // Add to ZIP
      zip.file(filename, blob);
      
      // Update status and table
      if (progressStatus) progressStatus.textContent = `Converting ${i + 1} of ${files.length}`;

      // Update table with file size
      const sizeCell = document.querySelector(`#preview-tbody tr:nth-child(${i+1}) .size-cell`);
      if (sizeCell) {
        const size = formatFileSize(blob.size);
        const reduction = (100 - (blob.size / file.size * 100)).toFixed(1);
        sizeCell.innerHTML = `${size}<br><span style="color:#7fd7c4;font-size:0.85em;">${reduction}% smaller</span>`;
      }
      
      // Enable download button
      const downloadBtn = document.querySelector(`#preview-tbody tr:nth-child(${i+1}) .download-btn`);
      if (downloadBtn) {
        downloadBtn.style.display = 'inline-block';
        downloadBtn.href = URL.createObjectURL(blob);
        downloadBtn.download = filename;
        downloadBtn.textContent = 'Download';
      }
      
      processed++;
      
      // Update progress bar
      if (progressBar) progressBar.style.width = `${Math.round((processed / files.length) * 100)}%`;
      
    } catch (err) {
      console.error(`Error processing ${file.name}:`, err);
      showError(i, file.name, err);
    }
  }
  
  // Update progress status
  if (progressStatus) {
    progressStatus.textContent = processed === files.length ?
      `Successfully converted ${processed} of ${files.length} images!` :
      `Converted ${processed} of ${files.length} images. Check errors above.`;
  }
  if (progressContainer) progressContainer.style.display = 'none';
  if (progressBar) progressBar.style.width = '0%';
  
  // Create download link for all files
  if (processed > 0) {
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const downloadLink = document.getElementById('download-link');
    const downloadSelected = document.getElementById('download-selected');
    const bulkRenameLink = document.getElementById('show-bulk-rename');
    
    // Show the download buttons container
    const downloadButtonsContainer = document.querySelector('.download-btns-responsive');
    if (downloadButtonsContainer) {
      downloadButtonsContainer.style.display = 'flex';
    }
    
    if (downloadLink) {
      downloadLink.href = URL.createObjectURL(zipBlob);
      
      // Make the ZIP download more prominent
      downloadLink.style.fontWeight = 'bold';
      downloadLink.style.padding = '0.75rem 1.5rem';
      
      // Animate to draw attention
      setTimeout(() => {
        downloadLink.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
        downloadLink.style.transform = 'scale(1.05)';
        downloadLink.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        
        setTimeout(() => {
          downloadLink.style.transform = 'scale(1)';
        }, 300);
      }, 500);
      
      // Show notification about the ZIP
      showNotification(`${processed} images processed! You can download them individually or as a ZIP archive.`, 'success');
    }
    
    // Show the "Bulk Rename Tool" link
    if (bulkRenameLink) {
      bulkRenameLink.classList.remove('hidden');
    }
  }
  
  // Fix download buttons display
  fixDownloadButtonDisplay();
  
  // Increment quota counter
  const quota = getQuotaInfo();
  quota.used += processed;
  setQuotaInfo(quota);
  updateQuotaStatus();
  
  return processed;
} 