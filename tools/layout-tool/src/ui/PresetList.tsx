import React, { useEffect, useState } from 'react';
import PresetManager, { Preset } from '@core/PresetManager';

interface Props {
  onSelect?: (preset: Preset) => void;
}

export default function PresetList({ onSelect }: Props) {
  const [presets, setPresets] = useState<Preset[]>([]);

  useEffect(() => {
    PresetManager.getAll().then(setPresets);
  }, []);

  return (
    <ul className="space-y-1">
      {presets.length === 0 ? (
        <li className="px-2 text-sm text-zinc-400">No presets loaded</li>
      ) : (
        presets.map((p) => (
          <li key={p.id}>
            <button
              className="w-full text-left px-2 py-1 hover:bg-zinc-700 rounded"
              onClick={() => onSelect?.(p)}
            >
              {p.name}
            </button>
          </li>
        ))
      )}
    </ul>
  );
}
