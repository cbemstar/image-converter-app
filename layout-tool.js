// Simple in-browser layout tool
import { PDFDocument } from 'https://cdn.skypack.dev/pdf-lib@1.17.1';

function canvasToPng(canvas) {
  return canvas.toDataURL('image/png');
}

function canvasToJpg(canvas, quality = 0.92) {
  return canvas.toDataURL('image/jpeg', quality);
}

function canvasToSvg(canvas) {
  const dataUrl = canvas.toDataURL('image/png');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}"><image href="${dataUrl}" width="100%" height="100%"/></svg>`;
}

async function canvasToPdf(canvas) {
  const pdf = await PDFDocument.create();
  const pngData = canvas.toDataURL('image/png');
  const pngBytes = Uint8Array.from(atob(pngData.split(',')[1]), c => c.charCodeAt(0));
  const img = await pdf.embedPng(pngBytes);
  const page = pdf.addPage([canvas.width, canvas.height]);
  page.drawImage(img, { x: 0, y: 0, width: canvas.width, height: canvas.height });
  return pdf.save();
}

function mmToPx(mm, dpi) {
  return Math.round((mm / 25.4) * dpi);
}

let presets = [];
const state = {
  pages: [],
  pageIndex: 0,
  history: [],
  future: []
};

function currentPage() {
  return state.pages[state.pageIndex];
}

function pushHistory() {
  state.history.push(JSON.stringify(state));
  state.future = [];
}

function applyPreset(page, preset) {
  const dpi = preset.dpi || 72;
  page.preset = preset.name;
  page.width = preset.units === 'mm' ? mmToPx(preset.width, dpi) : preset.width;
  page.height = preset.units === 'mm' ? mmToPx(preset.height, dpi) : preset.height;
}

function createPage(preset) {
  const page = { objects: [] };
  applyPreset(page, preset);
  return page;
}

function saveState() {
  localStorage.setItem('layoutProject', JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem('layoutProject');
  if (raw) {
    Object.assign(state, JSON.parse(raw));
  } else {
    state.pages.push(createPage(presets[0]));
  }
}

function render(canvas) {
  const ctx = canvas.getContext('2d');
  const page = currentPage();
  canvas.width = page.width;
  canvas.height = page.height;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  for (const obj of page.objects) {
    if (obj.type === 'text') {
      ctx.font = obj.font;
      ctx.fillStyle = obj.color || 'black';
      ctx.fillText(obj.text, obj.x, obj.y);
    } else if (obj.type === 'image') {
      if (obj.img.complete) {
        ctx.drawImage(obj.img, obj.x, obj.y, obj.w, obj.h);
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const presetSel = document.getElementById('preset-select');
  const pageSel = document.getElementById('page-select');
  const addPageBtn = document.getElementById('add-page');
  const addTextBtn = document.getElementById('add-text');
  const addImgBtn = document.getElementById('add-image');
  const undoBtn = document.getElementById('undo');
  const redoBtn = document.getElementById('redo');
  const imgInput = document.getElementById('img-input');
  const exportPngBtn = document.getElementById('export-png');
  const exportJpgBtn = document.getElementById('export-jpg');
  const exportSvgBtn = document.getElementById('export-svg');
  const exportPdfBtn = document.getElementById('export-pdf');
  const progress = document.getElementById('progress');
  const canvas = document.getElementById('canvas');
  const container = document.getElementById('canvas-container');

  presets = await fetch('presets.json').then(r => r.json());
  presets.forEach((p,i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = p.name;
    presetSel.appendChild(opt);
  });

  function refreshPageList() {
    pageSel.innerHTML = '';
    state.pages.forEach((p,i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `Page ${i+1}`;
      pageSel.appendChild(opt);
    });
    pageSel.value = state.pageIndex;
  }

  loadState();
  if (state.pages.length === 0) {
    state.pages.push(createPage(presets[0]));
  }
  refreshPageList();
  render(canvas);
  container.style.width = canvas.width + 'px';
  container.style.height = canvas.height + 'px';

  presetSel.addEventListener('change', () => {
    pushHistory();
    applyPreset(currentPage(), presets[presetSel.value]);
    render(canvas);
    saveState();
  });

  pageSel.addEventListener('change', () => {
    state.pageIndex = parseInt(pageSel.value,10);
    render(canvas);
  });

  addPageBtn.addEventListener('click', () => {
    pushHistory();
    state.pages.push(createPage(presets[presetSel.value] || presets[0]));
    state.pageIndex = state.pages.length -1;
    refreshPageList();
    render(canvas);
    saveState();
  });

  addTextBtn.addEventListener('click', () => {
    const text = prompt('Enter text');
    if (!text) return;
    pushHistory();
    currentPage().objects.push({ type:'text', text, x:50, y:50, font:'20px sans-serif' });
    render(canvas);
    saveState();
  });

  addImgBtn.addEventListener('click', () => imgInput.click());

  imgInput.addEventListener('change', () => {
    const file = imgInput.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      pushHistory();
      currentPage().objects.push({ type:'image', img, x:50, y:100, w:img.width, h:img.height });
      render(canvas);
      saveState();
    };
    img.src = URL.createObjectURL(file);
    imgInput.value = '';
  });

  canvas.addEventListener('mousedown', e => {
    const page = currentPage();
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    for (let i = page.objects.length -1; i>=0; i--) {
      const obj = page.objects[i];
      if (obj.type === 'text') {
        const width = canvas.getContext('2d').measureText(obj.text).width;
        const height = 20;
        if (x>=obj.x && x<=obj.x+width && y>=obj.y-height && y<=obj.y) {
          startDrag(obj, x, y);
          return;
        }
      } else if (obj.type === 'image') {
        if (x>=obj.x && x<=obj.x+obj.w && y>=obj.y && y<=obj.y+obj.h) {
          startDrag(obj, x, y);
          return;
        }
      }
    }
  });

  let dragObj = null; let dragStartX = 0; let dragStartY = 0;
  function startDrag(obj, sx, sy) {
    dragObj = obj;
    dragStartX = sx - obj.x;
    dragStartY = sy - obj.y;
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', endDrag);
  }

  function onDrag(e) {
    if (!dragObj) return;
    const rect = canvas.getBoundingClientRect();
    dragObj.x = e.clientX - rect.left - dragStartX;
    dragObj.y = e.clientY - rect.top - dragStartY;
    render(canvas);
  }

  function endDrag() {
    if (dragObj) {
      pushHistory();
      saveState();
    }
    dragObj = null;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', endDrag);
  }

  undoBtn.addEventListener('click', () => {
    if (state.history.length) {
      state.future.push(JSON.stringify(state));
      const prev = JSON.parse(state.history.pop());
      Object.assign(state, prev);
      refreshPageList();
      render(canvas);
      saveState();
    }
  });

  redoBtn.addEventListener('click', () => {
    if (state.future.length) {
      state.history.push(JSON.stringify(state));
      const next = JSON.parse(state.future.pop());
      Object.assign(state, next);
      refreshPageList();
      render(canvas);
      saveState();
    }
  });

  function download(name, dataUrl) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = name;
    link.click();
  }

  exportPngBtn.addEventListener('click', () => {
    progress.classList.remove('hidden');
    setTimeout(() => {
      download('design.png', canvasToPng(canvas));
      progress.classList.add('hidden');
    }, 10);
  });

  exportJpgBtn.addEventListener('click', () => {
    progress.classList.remove('hidden');
    setTimeout(() => {
      download('design.jpg', canvasToJpg(canvas));
      progress.classList.add('hidden');
    }, 10);
  });

  exportSvgBtn.addEventListener('click', () => {
    progress.classList.remove('hidden');
    setTimeout(() => {
      const svg = canvasToSvg(canvas);
      const blob = new Blob([svg], {type:'image/svg+xml'});
      download('design.svg', URL.createObjectURL(blob));
      progress.classList.add('hidden');
    }, 10);
  });

  exportPdfBtn.addEventListener('click', async () => {
    progress.classList.remove('hidden');
    const bytes = await canvasToPdf(canvas);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    download('design.pdf', URL.createObjectURL(blob));
    progress.classList.add('hidden');
  });
});
