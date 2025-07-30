import React, { useEffect, useState } from 'react';
import PresetManager, { Preset } from '@core/PresetManager';

export interface DocumentSpec {
  width: number;
  height: number;
  bleed?: number;
  safe?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (doc: DocumentSpec) => void;
}

export default function NewDocumentDialog({ open, onClose, onCreate }: Props) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selected, setSelected] = useState<string>('');

  useEffect(() => {
    PresetManager.getAll().then(setPresets);
  }, []);

  const handleCreate = () => {
    const preset = presets.find(p => p.id === selected);
    if (preset) {
      const { width, height, bleed, safe } = preset;
      onCreate({ width, height, bleed, safe });
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50">
      <div className="bg-gray-800 p-4 rounded shadow">
        <h2 className="text-lg mb-2">New Document</h2>
        <select
          className="w-full mb-4 px-2 py-1 text-black"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="" disabled>
            Select preset
          </option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <div className="flex justify-end gap-2">
          <button className="bg-blue-600 px-3 py-1 rounded" onClick={handleCreate}>
            Create
          </button>
          <button className="px-3 py-1" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
