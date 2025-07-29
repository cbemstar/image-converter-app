import React, { useRef, useEffect, useState } from 'react';
import NewDocumentDialog, { DocumentSpec } from './NewDocumentDialog';
import CanvasEngine, { Document as Doc, RectObject } from '@canvas/CanvasEngine';
import { TextObject } from '@core/TextObject';
import ImageControls from './ImageControls';
import ViewMenu from './ViewMenu';
import ExportDialog from './ExportDialog';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<Doc | null>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const [showExport, setShowExport] = useState(false);

  useEffect(() => {
    if (containerRef.current && doc) {
      const engine = new CanvasEngine(containerRef.current, doc);
      engineRef.current = engine;
      engine.addObject({
        id: 'rect1',
        type: 'rect',
        x: 20,
        y: 20,
        width: 80,
        height: 60,
        fill: 'orange'
      } as RectObject);
      engine.addObject({
        id: 'text1',
        type: 'text',
        x: 120,
        y: 40,
        width: 150,
        height: 40,
        text: 'Double-click to edit',
        family: 'Arial',
        weight: '400',
        size: 16,
        colour: 'black',
        tracking: 0,
        lineHeight: 18,
        align: 'left'
      } as TextObject);
      return () => engine.destroy();
    }
  }, [doc]);

  const handleCreate = (spec: DocumentSpec) => {
    setDoc(spec);
  };

  return (
    <div className="p-4">
      {!doc && (
        <NewDocumentDialog open onClose={() => {}} onCreate={handleCreate} />
      )}
      {engineRef.current && <ViewMenu engine={engineRef.current} />}
      {engineRef.current && (
        <button
          className="bg-green-600 px-3 py-1 rounded mb-2 ml-2"
          onClick={() => setShowExport(true)}
        >
          Export
        </button>
      )}
      <div ref={containerRef} />
      {engineRef.current && <ImageControls engine={engineRef.current} />}
      {engineRef.current && (
        <ExportDialog
          open={showExport}
          onClose={() => setShowExport(false)}
          engine={engineRef.current}
          doc={doc!}
        />
      )}
    </div>
  );
}
