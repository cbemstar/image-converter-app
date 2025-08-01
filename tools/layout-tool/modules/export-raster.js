/**
 * Export artboards to ZIP of PNG images with proper naming.
 * @param {Array<{canvas: HTMLCanvasElement, preset: object}>} artboards
 * @param {number} dpi
 * @param {boolean} transparent
 * @returns {Promise<Blob>}
 */
export async function exportZip(artboards, dpi = 72, transparent = false) {
  const { default: JSZip } = await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm');
  const zip = new JSZip();
  
  for (const artboard of artboards) {
    const { canvas, preset } = artboard;
    
    // Create high-resolution canvas if DPI > 72
    let exportCanvas = canvas;
    if (dpi > 72) {
      const scale = dpi / 72;
      exportCanvas = document.createElement('canvas');
      exportCanvas.width = canvas.width * scale;
      exportCanvas.height = canvas.height * scale;
      
      const ctx = exportCanvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height);
    }
    
    // Generate filename from preset name
    const filename = `${preset.name.replace(/[^a-zA-Z0-9]/g, '_')}_${preset.width || Math.round(preset.width_mm * 11.811)}x${preset.height || Math.round(preset.height_mm * 11.811)}_${dpi}dpi.png`;
    
    const blob = await new Promise(resolve => {
      exportCanvas.toBlob(resolve, transparent ? 'image/png' : 'image/jpeg', 0.95);
    });
    
    zip.file(filename, blob);
  }
  
  return zip.generateAsync({ 
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
}

/**
 * Export single artboard as PNG
 * @param {HTMLCanvasElement} canvas
 * @param {object} preset
 * @param {number} dpi
 * @returns {Promise<Blob>}
 */
export async function exportSingle(canvas, preset, dpi = 72) {
  let exportCanvas = canvas;
  
  if (dpi > 72) {
    const scale = dpi / 72;
    exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width * scale;
    exportCanvas.height = canvas.height * scale;
    
    const ctx = exportCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height);
  }
  
  return new Promise(resolve => {
    exportCanvas.toBlob(resolve, 'image/png', 0.95);
  });
}
