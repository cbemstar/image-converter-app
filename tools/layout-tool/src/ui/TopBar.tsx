import React from 'react';
import CommandStack from '@core/CommandStack';

interface Props {
  stack: CommandStack;
  onExport: () => void;
}

export default function TopBar({ stack, onExport }: Props) {
  return (
    <div className="flex gap-2 p-2 bg-gray-800">
      <button className="px-2 py-1 bg-gray-700 rounded" onClick={() => stack.undo()}>
        Undo
      </button>
      <button className="px-2 py-1 bg-gray-700 rounded" onClick={() => stack.redo()}>
        Redo
      </button>
      <button className="px-2 py-1 bg-blue-600 rounded" onClick={onExport}>
        Export
      </button>
    </div>
  );
}
