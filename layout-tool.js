import { canvasToPng, canvasToPdf } from './layout-export.js';

async function loadPresets() {
  const res = await fetch('presets.json');
  return res.json();
}

function mmToPx(mm, dpi) {
  return Math.round((mm / 25.4) * dpi);
}

function createTextObject(ctx, text, x, y) {
  return { type: 'text', text, x, y, font: '20px sans-serif' };
}

function createImageObject(img, x, y, w, h) {
  return { type: 'image', img, x, y, w, h };
}

function render(canvas, objects) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  for (const obj of objects) {
    if (obj.type === 'text') {
      ctx.font = obj.font;
      ctx.fillText(obj.text, obj.x, obj.y);
    } else if (obj.type === 'image') {
      ctx.drawImage(obj.img, obj.x, obj.y, obj.w, obj.h);
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const presetSel = document.getElementById('preset-select');
  const addTextBtn = document.getElementById('add-text');
  const addImgBtn = document.getElementById('add-image');
  const imgInput = document.getElementById('img-input');
  const exportPngBtn = document.getElementById('export-png');
  const exportPdfBtn = document.getElementById('export-pdf');
  const canvas = document.getElementById('canvas');
  const container = document.getElementById('canvas-container');

  const presets = await loadPresets();
  presets.forEach((p,i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = p.name;
    presetSel.appendChild(opt);
  });

  let objects = [];

  function applyPreset(p) {
    const dpi = p.dpi || 72;
    const width = p.units === 'mm' ? mmToPx(p.width, dpi) : p.width;
    const height = p.units === 'mm' ? mmToPx(p.height, dpi) : p.height;
    canvas.width = width;
    canvas.height = height;
    container.style.width = width + 'px';
    container.style.height = height + 'px';
    render(canvas, objects);
  }

  presetSel.addEventListener('change', () => {
    applyPreset(presets[presetSel.value]);
  });

  applyPreset(presets[0]);

  addTextBtn.addEventListener('click', () => {
    const text = prompt('Enter text');
    if (!text) return;
    objects.push(createTextObject(canvas.getContext('2d'), text, 50, 50));
    render(canvas, objects);
  });

  addImgBtn.addEventListener('click', () => imgInput.click());

  imgInput.addEventListener('change', () => {
    const file = imgInput.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      objects.push(createImageObject(img, 50, 100, img.width, img.height));
      render(canvas, objects);
    };
    img.src = URL.createObjectURL(file);
    imgInput.value = '';
  });

  exportPngBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.href = canvasToPng(canvas);
    link.download = 'design.png';
    link.click();
  });

  exportPdfBtn.addEventListener('click', async () => {
    const bytes = await canvasToPdf(canvas);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'design.pdf';
    link.click();
  });
});
