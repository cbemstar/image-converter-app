import { PDFDocument, StandardFonts, RGB, PDFName } from 'pdf-lib';
import RasterExporter from './RasterExporter';
import { Document } from '@canvas/CanvasEngine';

const MM_TO_PT = 72 / 25.4;

export interface PdfExportOptions {
  dpi: 72 | 150 | 300;
  outline?: boolean;
  cropMarks?: boolean;
}

export default async function exportPdf(svg: SVGSVGElement, doc: Document, options: PdfExportOptions): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const { width, height, bleed = 0 } = doc;
  const pageWidth = (width + bleed * 2) * MM_TO_PT;
  const pageHeight = (height + bleed * 2) * MM_TO_PT;
  const page = pdf.addPage([pageWidth, pageHeight]);

  const exporter = new RasterExporter(svg);
  const dataUrl = await exporter.exportDataURL({ dpi: options.dpi, format: 'png' });
  const pngBytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
  const png = await pdf.embedPng(pngBytes);
  page.drawImage(png, {
    x: bleed * MM_TO_PT,
    y: bleed * MM_TO_PT,
    width: width * MM_TO_PT,
    height: height * MM_TO_PT,
  });

  // trim and bleed boxes
  const trim = pdf.context.obj([bleed * MM_TO_PT, bleed * MM_TO_PT, (bleed + width) * MM_TO_PT, (bleed + height) * MM_TO_PT]);
  const bleedBox = pdf.context.obj([0, 0, pageWidth, pageHeight]);
  page.node.set(PDFName.of('TrimBox'), trim);
  page.node.set(PDFName.of('BleedBox'), bleedBox);

  if (options.cropMarks) {
    const mark = 10; // pt length
    const offset = bleed * MM_TO_PT;
    const t = width * MM_TO_PT;
    const r = height * MM_TO_PT;
    const c = page.drawLine.bind(page);
    const color: RGB = { r: 0, g: 0, b: 0 };
    c({ start: { x: offset - mark, y: offset }, end: { x: offset, y: offset }, color });
    c({ start: { x: offset, y: offset - mark }, end: { x: offset, y: offset }, color });
    c({ start: { x: offset + t, y: offset - mark }, end: { x: offset + t, y: offset }, color });
    c({ start: { x: offset + t, y: offset }, end: { x: offset + t + mark, y: offset }, color });
    c({ start: { x: offset - mark, y: offset + r }, end: { x: offset, y: offset + r }, color });
    c({ start: { x: offset, y: offset + r }, end: { x: offset, y: offset + r + mark }, color });
    c({ start: { x: offset + t, y: offset + r }, end: { x: offset + t + mark, y: offset + r }, color });
    c({ start: { x: offset + t, y: offset + r }, end: { x: offset + t, y: offset + r + mark }, color });
  }

  return pdf.save();
}
