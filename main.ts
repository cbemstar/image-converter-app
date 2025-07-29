import { createRoot } from 'react-dom/client';
import React from 'react';
import App from './src/App';
import './src/style.css';

const container = document.getElementById('app');
if (container) {
  const root = createRoot(container);
  root.render(React.createElement(App));
}
