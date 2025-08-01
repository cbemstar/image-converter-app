import { coverFit } from './smart-crop.js';
import { softProof } from './colour-manager.js';

/**
 * Clone master document into preset sized canvas with improved rendering.
 * @param {object} preset - The preset configuration
 * @param {object} master - The master document state
 * @param {number} scale - Scale factor for mm to px conversion
 * @returns {HTMLCanvasElement}
 */
export function createArtboard(preset, master, scale = 1) {
  const canvas = document.createElement('canvas');
  
  // Calculate canvas dimensions
  if (preset.width && preset.height) {
    canvas.width = preset.width;
    canvas.height = preset.height;
  } else if (preset.width_mm && preset.height_mm) {
    // Convert mm to pixels at 300 DPI for high quality
    canvas.width = Math.round(preset.width_mm * 11.811);
    canvas.height = Math.round(preset.height_mm * 11.811);
  } else {
    console.warn('Preset missing dimensions:', preset);
    canvas.width = 800;
    canvas.height = 600;
  }
  
  const ctx = canvas.getContext('2d');
  
  // Enable high-quality rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.textRenderingOptimization = 'optimizeQuality';
  
  // Fill background with white
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw hero image if present
  if (master.hero) {
    // Use custom hero settings if available, otherwise use default cover fit
    if (master.heroSettings) {
      drawHeroImageWithSettings(ctx, canvas.width, canvas.height, master.hero, master.heroSettings);
    } else {
      const crop = coverFit(master.hero, canvas.width, canvas.height);
      ctx.drawImage(
        master.hero, 
        crop.sx, crop.sy, crop.sw, crop.sh, 
        0, 0, canvas.width, canvas.height
      );
    }
  }
  
  // Calculate scale factors for positioning elements
  const scaleX = canvas.width / master.width;
  const scaleY = canvas.height / master.height;
  
  // Draw all objects (use custom objects if provided, otherwise use master objects)
  const objectsToRender = master.customObjects || master.objects;
  for (const obj of objectsToRender) {
    // Skip objects hidden for this channel
    if (obj.hidden && obj.hidden[preset.channel]) continue;
    
    ctx.save();
    
    // Scale position and size
    const scaledX = obj.x * scaleX;
    const scaledY = obj.y * scaleY;
    
    if (obj.type === 'text') {
      ctx.fillStyle = obj.color || '#000000';
      
      // Scale font size proportionally
      const scaledSize = (obj.size || 24) * Math.min(scaleX, scaleY);
      ctx.font = `${scaledSize}px Arial, sans-serif`;
      ctx.textBaseline = 'top';
      
      // Apply text shadow for better readability if on image
      if (master.hero) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 2;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
      }
      
      ctx.fillText(obj.text, scaledX, scaledY);
      
      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }
    
    if (obj.type === 'logo' && obj.image) {
      const scaledW = obj.w * scaleX;
      const scaledH = obj.h * scaleY;
      
      ctx.drawImage(obj.image, scaledX, scaledY, scaledW, scaledH);
    }
    
    ctx.restore();
  }
  
  // Apply color mode soft proofing
  softProof(ctx);
  
  return canvas;
}

/**
 * Create a thumbnail version of an artboard for preview
 * @param {HTMLCanvasElement} artboard - The full-size artboard
 * @param {number} maxSize - Maximum width or height for thumbnail
 * @returns {HTMLCanvasElement}
 */
export function createThumbnail(artboard, maxSize = 300) {
  const canvas = document.createElement('canvas');
  const scale = Math.min(maxSize / artboard.width, maxSize / artboard.height);
  
  canvas.width = artboard.width * scale;
  canvas.height = artboard.height * scale;
  
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  ctx.drawImage(artboard, 0, 0, canvas.width, canvas.height);
  
  return canvas;
}

/**
 * Draw hero image with custom settings (fit, fill, crop, position)
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} canvasWidth - Canvas width
 * @param {number} canvasHeight - Canvas height
 * @param {HTMLImageElement} heroImage - Hero image
 * @param {object} heroSettings - Hero image settings
 */
function drawHeroImageWithSettings(ctx, canvasWidth, canvasHeight, heroImage, heroSettings) {
  const { x = 0, y = 0, scale = 1, mode = 'cover' } = heroSettings;
  
  ctx.save();
  
  // Clip to canvas bounds
  ctx.beginPath();
  ctx.rect(0, 0, canvasWidth, canvasHeight);
  ctx.clip();
  
  let destWidth, destHeight, destX, destY;
  
  if (mode === 'fit') {
    // Scale to fit entirely within canvas
    const scaleToFit = Math.min(canvasWidth / heroImage.width, canvasHeight / heroImage.height) * scale;
    destWidth = heroImage.width * scaleToFit;
    destHeight = heroImage.height * scaleToFit;
    destX = (canvasWidth - destWidth) / 2 + (x * canvasWidth * 0.5);
    destY = (canvasHeight - destHeight) / 2 + (y * canvasHeight * 0.5);
  } else if (mode === 'fill') {
    // Scale to fill entire canvas
    const scaleToFill = Math.max(canvasWidth / heroImage.width, canvasHeight / heroImage.height) * scale;
    destWidth = heroImage.width * scaleToFill;
    destHeight = heroImage.height * scaleToFill;
    destX = (canvasWidth - destWidth) / 2 + (x * canvasWidth * 0.5);
    destY = (canvasHeight - destHeight) / 2 + (y * canvasHeight * 0.5);
  } else {
    // Default cover mode with custom positioning
    const crop = coverFit(heroImage, canvasWidth, canvasHeight);
    destWidth = canvasWidth * scale;
    destHeight = canvasHeight * scale;
    destX = (canvasWidth - destWidth) / 2 + (x * canvasWidth * 0.5);
    destY = (canvasHeight - destHeight) / 2 + (y * canvasHeight * 0.5);
    
    // Use crop coordinates for cover mode
    ctx.drawImage(
      heroImage,
      crop.sx, crop.sy, crop.sw, crop.sh,
      destX, destY, destWidth, destHeight
    );
    ctx.restore();
    return;
  }
  
  // Draw the hero image with calculated dimensions
  ctx.drawImage(heroImage, destX, destY, destWidth, destHeight);
  
  ctx.restore();
}

/**
 * Get optimal text size for a given canvas size
 * @param {number} canvasWidth - Canvas width
 * @param {number} canvasHeight - Canvas height
 * @param {number} baseSize - Base font size from master
 * @returns {number} Optimal font size
 */
export function getOptimalTextSize(canvasWidth, canvasHeight, baseSize = 24) {
  const canvasArea = canvasWidth * canvasHeight;
  const baseArea = 800 * 600; // Master canvas area
  const scaleFactor = Math.sqrt(canvasArea / baseArea);
  
  // Ensure minimum readable size and maximum reasonable size
  return Math.max(12, Math.min(baseSize * scaleFactor, 200));
}
