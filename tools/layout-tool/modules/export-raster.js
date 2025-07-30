import JSZip from 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';

/**
 * Export artboards as PNG images in a ZIP file.
 * @param {Array} artboards
 * @param {number} dpi
 * @param {boolean} transparent
 * @returns {Promise<Blob>}
 */
export async function exportPNG(artboards, dpi = 72, transparent = true) {
  const zip = new JSZip();
  const scale = dpi / 72;
  for (const board of artboards) {
    const tmp = document.createElement('canvas');
    tmp.width = board.canvas.width * scale;
    tmp.height = board.canvas.height * scale;
    const ctx = tmp.getContext('2d');
    ctx.drawImage(board.canvas, 0, 0, tmp.width, tmp.height);
    if (!transparent) {
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, tmp.width, tmp.height);
    }
    const blob = await new Promise(r => tmp.toBlob(r, 'image/png'));
    zip.file(`${board.id}.png`, blob);
  }
  const content = await zip.generateAsync({ type: 'blob' });
  return content;
}
