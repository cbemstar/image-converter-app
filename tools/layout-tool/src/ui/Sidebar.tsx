import React from 'react';
import PresetList from './PresetList';

interface Props {
  onPresetSelect?: (id: string) => void;
}

export default function Sidebar({ onPresetSelect }: Props) {
  return (
    <aside className="w-48 bg-gray-800 p-2 overflow-y-auto">
      <PresetList onSelect={(p) => onPresetSelect?.(p.id)} />
    </aside>
  );
}
