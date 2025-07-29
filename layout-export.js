const { PDFDocument } = require('pdf-lib');

function canvasToPng(canvas) {
  return canvas.toDataURL('image/png');
}

async function canvasToPdf(canvas) {
  const pdf = await PDFDocument.create();
  const pngData = canvas.toDataURL('image/png');
  const pngBytes = Uint8Array.from(atob(pngData.split(',')[1]), c => c.charCodeAt(0));
  const img = await pdf.embedPng(pngBytes);
  const page = pdf.addPage([canvas.width, canvas.height]);
  page.drawImage(img, { x: 0, y: 0, width: canvas.width, height: canvas.height });
  return pdf.save();
}

module.exports = { canvasToPng, canvasToPdf };
