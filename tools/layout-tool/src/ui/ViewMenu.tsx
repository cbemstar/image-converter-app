import React, { useState, useEffect } from 'react';
import CanvasEngine from '@canvas/CanvasEngine';

interface Props {
  engine: CanvasEngine;
}

export default function ViewMenu({ engine }: Props) {
  const [bleed, setBleed] = useState(true);
  const [trim, setTrim] = useState(true);
  const [safe, setSafe] = useState(true);

  useEffect(() => {
    engine.setOverlayVisibility('bleed', bleed);
  }, [bleed, engine]);
  useEffect(() => {
    engine.setOverlayVisibility('trim', trim);
  }, [trim, engine]);
  useEffect(() => {
    engine.setOverlayVisibility('safe', safe);
  }, [safe, engine]);

  return (
    <div className="mb-2 space-x-4">
      <label className="inline-flex items-center gap-1">
        <input type="checkbox" checked={trim} onChange={e => setTrim(e.target.checked)} />
        <span>Trim</span>
      </label>
      <label className="inline-flex items-center gap-1">
        <input type="checkbox" checked={bleed} onChange={e => setBleed(e.target.checked)} />
        <span>Bleed</span>
      </label>
      <label className="inline-flex items-center gap-1">
        <input type="checkbox" checked={safe} onChange={e => setSafe(e.target.checked)} />
        <span>Safe</span>
      </label>
    </div>
  );
}
