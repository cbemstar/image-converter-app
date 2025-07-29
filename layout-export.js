const { PDFDocument } = require('pdf-lib');

function canvasToPng(canvas) {
  return canvas.toDataURL('image/png');
}

function canvasToJpg(canvas, quality = 0.92) {
  return canvas.toDataURL('image/jpeg', quality);
}

function canvasToSvg(canvas) {
  const dataUrl = canvas.toDataURL('image/png');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}"><image href="${dataUrl}" width="100%" height="100%"/></svg>`;
  return svg;
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

module.exports = { canvasToPng, canvasToJpg, canvasToSvg, canvasToPdf };
