import { toggleMode, getMode } from './colour-manager.js';
import { exportRaster } from './export-raster.js';

/**
 * Initialise topbar controls.
 * @param {CanvasEngine} engine
 */
export function initTopbar(engine) {
  const modeBtn = document.getElementById('colour-toggle');
  const dpiSelect = document.getElementById('dpi-select');
  const exportBtn = document.getElementById('export-btn');

  if (modeBtn) {
    modeBtn.textContent = getMode();
    modeBtn.addEventListener('click', () => {
      modeBtn.textContent = toggleMode();
      engine.render();
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const dpi = parseInt(dpiSelect.value, 10) || 72;
      const type = 'image/png';
      const url = exportRaster(engine.canvas, dpi, type);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'layout.png';
      a.click();
    });
  }
}
