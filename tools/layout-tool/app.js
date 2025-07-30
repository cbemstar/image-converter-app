import { CanvasEngine } from './modules/canvas-engine.js';
import { initSidebar } from './modules/ui-sidebar.js';
import { initTopbar } from './modules/ui-topbar.js';

window.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('layout-canvas');
  if (!canvas) return;
  const engine = new CanvasEngine(canvas);

  const sidebar = document.getElementById('preset-list');
  if (sidebar) initSidebar(sidebar, preset => {
    canvas.width = preset.w;
    canvas.height = preset.h;
    engine.render();
  });

  initTopbar(engine);

  const imageInput = document.getElementById('image-input');
  if (imageInput) {
    imageInput.addEventListener('change', ( ) => {
      const file = imageInput.files[0];
      if (!file) return;
      const img = new Image();
      img.onload = () => engine.addImage(img);
      img.src = URL.createObjectURL(file);
    });
  }

  const addTextBtn = document.getElementById('add-text');
  if (addTextBtn) {
    addTextBtn.addEventListener('click', () => {
      const text = prompt('Text content');
      if (text) engine.addText(text);
    });
  }
});
