/**
 * Export artboards to ZIP of PNG images.
 * @param {HTMLCanvasElement[]} artboards
 * @param {number} dpi
 * @param {boolean} transparent
 * @returns {Promise<Blob>}
 */
export async function exportZip(artboards, dpi = 72, transparent = false) {
  const { default: JSZip } = await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm');
  const zip = new JSZip();
  let index = 1;
  for (const canvas of artboards) {
    const blob = await new Promise(r => canvas.toBlob(r, transparent ? 'image/png' : 'image/jpeg'));
    zip.file(`artboard-${index}.png`, blob);
    index++;
  }
  return zip.generateAsync({ type: 'blob' });
}
