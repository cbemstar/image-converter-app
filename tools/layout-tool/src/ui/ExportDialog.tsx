import React, { useState } from 'react';
import CanvasEngine, { Document as Doc } from '@canvas/CanvasEngine';
import RasterExporter from '@io/RasterExporter';
import exportPdf from '@io/PdfExporter';
import SvgExporter from '@io/SvgExporter';
import exportPackage from '@io/PackageExporter';
import ExportProgress from './ExportProgress';

interface Props {
  open: boolean;
  onClose: () => void;
  engine: CanvasEngine;
  doc: Doc;
}

export default function ExportDialog({ open, onClose, engine, doc }: Props) {
  const [exportType, setExportType] = useState<'png' | 'jpeg' | 'pdf' | 'svg' | 'package'>('png');
  const [quality, setQuality] = useState(92);
  const [dpi, setDpi] = useState<72 | 150 | 300>(72);
  const [outline, setOutline] = useState(false);
  const [cropMarks, setCropMarks] = useState(false);
  const [progress, setProgress] = useState('');

  const handleExport = async () => {
    setProgress('Preparing export...');
    const svg = engine.getSVGElement();
    try {
      if (exportType === 'png' || exportType === 'jpeg') {
        const exporter = new RasterExporter(svg);
        const dataUrl = await exporter.exportDataURL({
          dpi,
          format: exportType,
          quality: quality / 100,
        });
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `document.${exportType === 'png' ? 'png' : 'jpg'}`;
        link.click();
      } else if (exportType === 'pdf') {
        const pdf = await exportPdf(svg, doc, { dpi, cropMarks, outline });
        const blob = new Blob([pdf], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'document.pdf';
        link.click();
        URL.revokeObjectURL(link.href);
      } else if (exportType === 'svg') {
        const exporter = new SvgExporter(svg);
        const data = exporter.exportString({ outline });
        const blob = new Blob([data], { type: 'image/svg+xml' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'document.svg';
        link.click();
        URL.revokeObjectURL(link.href);
      } else {
        const blob = await exportPackage(svg, doc, { outline });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'package.zip';
        link.click();
        URL.revokeObjectURL(link.href);
      }
    } finally {
      setProgress('');
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50">
      <div className="bg-gray-800 p-4 rounded text-sm space-y-4">
        <h2 className="text-lg">Export</h2>
        <div className="space-y-2">
          <label className="block">
            Format:
            <select
              value={exportType}
              onChange={(e) => setExportType(e.target.value as any)}
              className="ml-2 text-black"
            >
              <option value="png">PNG</option>
              <option value="jpeg">JPG</option>
              <option value="pdf">PDF</option>
              <option value="svg">SVG</option>
              <option value="package">Package (ZIP)</option>
            </select>
          </label>
          {(exportType === 'png' || exportType === 'jpeg') && (
            <label className="block">
              DPI:
              <select
                value={dpi}
                onChange={(e) => setDpi(Number(e.target.value) as 72 | 150 | 300)}
                className="ml-2 text-black"
              >
                <option value={72}>72</option>
                <option value={150}>150</option>
                <option value={300}>300</option>
              </select>
            </label>
          )}
          {exportType === 'jpeg' && (
            <label className="block">
              Quality: {quality}
              <input
                type="range"
                min="10"
                max="100"
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full"
              />
            </label>
          )}
          {(exportType === 'pdf' || exportType === 'svg' || exportType === 'package') && (
            <label className="block">
              <input
                type="checkbox"
                checked={outline}
                onChange={(e) => setOutline(e.target.checked)}
                className="mr-1"
              />
              Outline text
            </label>
          )}
          {exportType === 'pdf' && (
            <label className="block">
              <input
                type="checkbox"
                checked={cropMarks}
                onChange={(e) => setCropMarks(e.target.checked)}
                className="mr-1"
              />
              Crop marks
            </label>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button className="bg-blue-600 px-3 py-1 rounded" onClick={handleExport}>
            Export
          </button>
          <button className="px-3 py-1" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
      {progress && <ExportProgress message={progress} />}
    </div>
  );
}
