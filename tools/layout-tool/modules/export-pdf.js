import { PDFDocument, rgb } from 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm';
import { getMode, toCmyk } from './colour-manager.js';

/**
 * Export artboards to a multi-page PDF.
 * @param {Array} artboards
 * @param {string} iccProfileUrl
 * @returns {Promise<Blob>}
 */
export async function exportPDF(artboards, iccProfileUrl = '') {
  const pdfDoc = await PDFDocument.create();
  for (const board of artboards) {
    const imgData = board.canvas.toDataURL('image/png');
    const img = await pdfDoc.embedPng(imgData);
    const page = pdfDoc.addPage([board.canvas.width, board.canvas.height]);
    page.drawImage(img, { x: 0, y: 0, width: board.canvas.width, height: board.canvas.height });
    if (getMode() === 'CMYK') {
      // simple overlay to indicate CMYK page
      page.drawRectangle({ x: 0, y: 0, width: 10, height: 10, color: rgb(1, 0, 0) });
    }
  }
  if (iccProfileUrl && getMode() === 'CMYK') {
    try {
      const icc = await fetch(iccProfileUrl).then(r => r.arrayBuffer());
      pdfDoc.setProducer('layout-tool');
      pdfDoc.setCreator('layout-tool');
      pdfDoc.registerFontkit(undefined);
      pdfDoc.embedIccProfile(new Uint8Array(icc));
    } catch (e) {
      console.warn('ICC load failed', e);
    }
  }
  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}
