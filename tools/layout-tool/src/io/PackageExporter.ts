import JSZip from 'jszip';
import SvgExporter from './SvgExporter';
import { Document } from '@canvas/CanvasEngine';

export interface PackageOptions {
  outline?: boolean;
}

export default async function exportPackage(svg: SVGSVGElement, doc: Document, options: PackageOptions): Promise<Blob> {
  const zip = new JSZip();
  const svgExporter = new SvgExporter(svg);
  const svgStr = svgExporter.exportString({ outline: options.outline });
  zip.file('project.svg', svgStr);
  zip.file('project.json', JSON.stringify(doc, null, 2));
  const blob = await zip.generateAsync({ type: 'blob' });
  return blob;
}
