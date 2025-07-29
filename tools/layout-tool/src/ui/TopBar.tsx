import React from 'react';
import CommandStack from '@core/CommandStack';

interface Props {
  stack: CommandStack;
  onExport: () => void;
}

export default function TopBar({ stack, onExport }: Props) {
  return (
    <header className="h-12 bg-zinc-800 border-b flex items-center px-3 gap-2">
      <button onClick={() => stack.undo()}>Undo</button>
      <button onClick={() => stack.redo()}>Redo</button>
      <button onClick={onExport}>Export</button>
    </header>
  );
}
