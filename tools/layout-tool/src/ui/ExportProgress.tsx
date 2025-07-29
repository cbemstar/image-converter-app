import React from 'react';

interface Props {
  message: string;
}

export default function ExportProgress({ message }: Props) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50">
      <div className="bg-gray-800 px-4 py-2 rounded text-sm">{message}</div>
    </div>
  );
}
