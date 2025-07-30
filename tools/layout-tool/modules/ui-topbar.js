import { undo, redo } from './command-stack.js';
import { setMode, getMode } from './colour-manager.js';

/**
 * Initialise topbar controls.
 * @param {HTMLElement} container
 * @param {Function} onExport
 */
export function initTopbar(container, onExport) {
  const undoBtn = document.createElement('button');
  undoBtn.textContent = 'Undo';
  undoBtn.className = 'btn mr-2';
  undoBtn.addEventListener('click', undo);

  const redoBtn = document.createElement('button');
  redoBtn.textContent = 'Redo';
  redoBtn.className = 'btn mr-2';
  redoBtn.addEventListener('click', redo);

  const modeBtn = document.createElement('button');
  modeBtn.textContent = 'RGB';
  modeBtn.className = 'btn mr-2';
  modeBtn.addEventListener('click', () => {
    const m = getMode() === 'RGB' ? 'CMYK' : 'RGB';
    setMode(m);
    modeBtn.textContent = m;
  });

  const exportBtn = document.createElement('button');
  exportBtn.textContent = 'Export';
  exportBtn.className = 'btn';
  exportBtn.addEventListener('click', onExport);

  container.append(undoBtn, redoBtn, modeBtn, exportBtn);
}
