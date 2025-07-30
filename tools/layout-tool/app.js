import { getPresets } from './modules/preset-manager.js';
import { initSidebar } from './modules/ui-sidebar.js';
import { initTopbar } from './modules/ui-topbar.js';
import { commandStack } from './modules/command-stack.js';
import { setMode } from './modules/colour-manager.js';
import { createArtboard } from './modules/canvas-engine.js';
import { exportZip } from './modules/export-raster.js';
import { showDialog } from './modules/ui-dialog.js';

const masterCanvas = document.getElementById('master-canvas');
const masterCtx = masterCanvas.getContext('2d');
const artboardContainer = document.getElementById('artboards');

const master = {
  hero: null,
  objects: [],
  width: masterCanvas.width,
  height: masterCanvas.height
};

let presets = [];
let dpi = 72;

function renderMaster() {
  masterCtx.clearRect(0,0,masterCanvas.width,masterCanvas.height);
  if (master.hero) {
    masterCtx.drawImage(master.hero,0,0,masterCanvas.width,masterCanvas.height);
  }
  for (const obj of master.objects) {
    if (obj.type === 'text') {
      masterCtx.fillStyle = obj.color || '#fff';
      masterCtx.font = `${obj.size||20}px sans-serif`;
      masterCtx.fillText(obj.text,obj.x,obj.y);
    }
    if (obj.type === 'logo' && obj.image) {
      masterCtx.drawImage(obj.image,obj.x,obj.y,obj.w,obj.h);
    }
  }
}

async function init() {
  presets = await getPresets();
  initSidebar(document.getElementById('sidebar'), {
    presets,
    onUpload: async file => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await img.decode();
      master.hero = img;
      renderMaster();
    },
    onAddText: text => {
      const obj = { type: 'text', text, x: 50, y: 50 };
      master.objects.push(obj);
      commandStack.push({ undo: () => { master.objects.pop(); renderMaster(); }, redo: () => { master.objects.push(obj); renderMaster(); } });
      renderMaster();
    },
    onAddLogo: async file => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await img.decode();
      const obj = { type: 'logo', image: img, x: 50, y: 50, w: img.width/2, h: img.height/2 };
      master.objects.push(obj);
      commandStack.push({ undo: () => { master.objects.pop(); renderMaster(); }, redo: () => { master.objects.push(obj); renderMaster(); } });
      renderMaster();
    },
    onGenerate: selectedNames => {
      artboardContainer.innerHTML = '';
      const boards = [];
      selectedNames.forEach(name => {
        const preset = presets.find(p=>p.name===name);
        if (!preset) return;
        const board = createArtboard(preset, master, dpi/25.4); // scale mm to px
        boards.push(board);
        artboardContainer.appendChild(board);
      });
      currentArtboards = boards;
    }
  });

  initTopbar(document.getElementById('topbar'), {
    onUndo: () => commandStack.undo(),
    onRedo: () => commandStack.redo(),
    onChannel: ch => { currentChannel = ch; renderMaster(); },
    onColour: mode => { setMode(mode); renderMaster(); },
    onDpi: v => { dpi = v; },
    onExport: async () => {
      if (!currentArtboards.length) return showDialog('No artboards');
      const zipBlob = await exportZip(currentArtboards, dpi, true);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'artboards.zip';
      a.click();
    }
  });
}

let currentArtboards = [];
let currentChannel = 'all';

window.addEventListener('DOMContentLoaded', init);
