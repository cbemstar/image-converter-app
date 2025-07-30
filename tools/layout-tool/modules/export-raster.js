import { getMode } from './colour-manager.js';

/**
 * Export the canvas to a raster image at the given DPI.
 * @param {HTMLCanvasElement} canvas
 * @param {number} dpi
 * @param {'image/png'|'image/jpeg'} type
 * @returns {string} data URL
 */
export function exportRaster(canvas, dpi, type) {
  const scale = dpi / 72;
  const off = document.createElement('canvas');
  off.width = canvas.width * scale;
  off.height = canvas.height * scale;
  const ctx = off.getContext('2d');
  ctx.drawImage(canvas, 0, 0, off.width, off.height);
  if (getMode() === 'CMYK' && type !== 'image/png') {
    console.warn('Exporting JPEG in RGB when document is in CMYK');
  }
  return off.toDataURL(type);
}
