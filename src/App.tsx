import React from 'react';
import { PresetList } from './ui/PresetList';
import { TopBar } from './ui/TopBar';
import { CanvasArea } from './ui/CanvasArea';

export function App() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <TopBar />
      <div style={{ display: 'flex', flex: 1 }}>
        <PresetList />
        <CanvasArea />
      </div>
    </div>
  );
}

export default App;
