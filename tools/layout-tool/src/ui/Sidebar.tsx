import React from 'react';
import PresetList from './PresetList';

interface Props {
  onPresetSelect?: (id: string) => void;
}

export default function Sidebar({ onPresetSelect }: Props) {
  return (
    <aside className="w-64 bg-zinc-800 border-r overflow-y-auto">
      <PresetList onSelect={(p) => onPresetSelect?.(p.id)} />
    </aside>
  );
}
