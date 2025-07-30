/**
 * Export artboards to a multi-page PDF.
 * @param {HTMLCanvasElement[]} artboards
 * @param {Uint8Array} iccProfile
 * @returns {Promise<Blob>}
 */
export async function exportPDF(artboards, iccProfile) {
  const { PDFDocument } = await import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm');
  const pdfDoc = await PDFDocument.create();
  for (const canvas of artboards) {
    const page = pdfDoc.addPage([canvas.width, canvas.height]);
    const png = await pdfDoc.embedPng(canvas.toDataURL('image/png'));
    page.drawImage(png, { x: 0, y: 0, width: canvas.width, height: canvas.height });
  }
  // pdf-lib doesn't yet support embedding ICC profiles directly
  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}
