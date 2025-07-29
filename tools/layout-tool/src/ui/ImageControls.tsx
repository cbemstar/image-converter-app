import React, { useRef, useCallback, useState, useEffect } from 'react';
import CanvasEngine from '@canvas/CanvasEngine';
import { loadImageFile, createImageObject, ImageObject, ImageTransform } from '@core/ImageObject';

interface Props {
  engine: CanvasEngine;
}

export default function ImageControls({ engine }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<ImageObject | null>(null);
  const [transform, setTransform] = useState<ImageTransform | null>(null);
  const start = useRef<{x:number,y:number}|null>(null);

  useEffect(() => {
    engine.setImageEditHandler((obj) => {
      setEditing(obj);
      setTransform({ ...obj.transform });
    });
  }, [engine]);

  const handleFile = useCallback(async (file: File) => {
    const data = await loadImageFile(file);
    if (editing) {
      engine.replaceImage(editing.id, data);
    } else {
      const obj = createImageObject('img-' + Date.now(), data, 50, 50, 200, 150);
      engine.addObject(obj);
    }
    setEditing(null);
  }, [editing, engine]);

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
  };

  const openPicker = () => inputRef.current?.click();

  const onMouseDown = (e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseMove = (e: React.PointerEvent) => {
    if (!start.current || !transform) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    const newT = { ...transform, offsetX: transform.offsetX + dx, offsetY: transform.offsetY + dy };
    setTransform(newT);
    start.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseUp = () => {
    if (editing && transform) engine.updateImageTransform(editing.id, transform);
    start.current = null;
  };
  const onWheel = (e: React.WheelEvent) => {
    if (!transform) return;
    const scale = Math.max(0.1, transform.scale - e.deltaY * 0.001);
    setTransform({ ...transform, scale });
  };
  useEffect(() => {
    if (editing && transform) {
      engine.updateImageTransform(editing.id, transform);
    }
  }, [transform]);

  return (
    <div className="mt-4" onDragOver={(e)=>e.preventDefault()} onDrop={onDrop}>
      <input type="file" accept="image/*" ref={inputRef} onChange={onChange} className="hidden" />
      <button className="bg-blue-600 px-3 py-1 rounded" onClick={openPicker}>Add Image</button>
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center" onPointerUp={onMouseUp} onPointerMove={onMouseMove} onWheel={onWheel}>
          <div className="bg-gray-800 p-2 text-sm text-white rounded">
            <p className="mb-2">Drag to pan, scroll to zoom. Double-click image to exit.</p>
            <img
              src={editing.data}
              style={{ transform: `translate(${transform?.offsetX}px,${transform?.offsetY}px) scale(${transform?.scale})` }}
              onPointerDown={onMouseDown}
              onDoubleClick={() => setEditing(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
