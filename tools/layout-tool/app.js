import { createArtboard, addText, addImage, draw } from './modules/canvas-engine.js';
import { initSidebar } from './modules/ui-sidebar.js';
import { initTopbar } from './modules/ui-topbar.js';
import { showExportDialog } from './modules/ui-dialog.js';
import { exportPNG } from './modules/export-raster.js';

let master = null;
const clones = [];

document.addEventListener('DOMContentLoaded', async () => {
  const sidebar = document.getElementById('sidebar');
  const topbar = document.getElementById('topbar');
  const workspace = document.getElementById('workspace');
  const dialog = document.getElementById('dialog');

  master = createArtboard({ w: 400, h: 300 });
  workspace.appendChild(master.wrapper);
  addText(master, 'Sample');

  initSidebar(sidebar, presets => {
    presets.forEach(p => {
      const board = createArtboard(p);
      clones.push(board);
      workspace.appendChild(board.wrapper);
      board.elements = master.elements.map(el => ({ ...el }));
      draw(board);
    });
  });

  initTopbar(topbar, () => {
    showExportDialog(dialog, async dpi => {
      const zip = await exportPNG([master, ...clones], dpi, true);
      const url = URL.createObjectURL(zip);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'artboards.zip';
      a.click();
      URL.revokeObjectURL(url);
    });
  });
});
