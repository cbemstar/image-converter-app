import React, { useRef, useEffect, useState } from 'react';
import NewDocumentDialog, { DocumentSpec } from './NewDocumentDialog';
import CanvasEngine, { Document as Doc, RectObject } from '@canvas/CanvasEngine';
import { TextObject } from '@core/TextObject';
import ImageControls from './ImageControls';
import ViewMenu from './ViewMenu';
import ExportDialog from './ExportDialog';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import CommandStack from '@core/CommandStack';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<Doc | null>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const [showExport, setShowExport] = useState(false);
  const commandStackRef = useRef(new CommandStack());

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
    <div className="flex h-screen bg-zinc-900 text-sm text-white">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar stack={commandStackRef.current} onExport={() => setShowExport(true)} />
        <div className="p-4 flex-1 overflow-auto">
          {!doc && (
            <NewDocumentDialog open onClose={() => {}} onCreate={handleCreate} />
          )}
          {engineRef.current && <ViewMenu engine={engineRef.current} />}
          <div ref={containerRef} className="mt-2" />
          {engineRef.current && <ImageControls engine={engineRef.current} />}
        </div>
      </div>
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
