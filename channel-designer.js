import { showNotification } from './utils.js';

let layers = [];
let layerId = 1;
let selectedLayer = null;
let currentChannel = 'digital';
let colorMode = 'RGB';

const designArea = document.getElementById('design-area');
const layerTableBody = document.getElementById('layer-table-body');
const colorModeSelect = document.getElementById('color-mode');
const channelSelect = document.getElementById('channel-select');
const addTextBtn = document.getElementById('add-text');
const addImageInput = document.getElementById('add-image');
const textControls = document.getElementById('text-controls');
const imageControls = document.getElementById('image-controls');
const textContentInput = document.getElementById('text-content');
const textColorInput = document.getElementById('text-color');
const fontSizeInput = document.getElementById('font-size');
const imgWidthInput = document.getElementById('img-width');
const imgHeightInput = document.getElementById('img-height');
const imgBrightnessInput = document.getElementById('img-brightness');
const imgContrastInput = document.getElementById('img-contrast');
const exportFormat = document.getElementById('export-format');
const exportScale = document.getElementById('export-scale');
const exportBtn = document.getElementById('export-digital');
const exportPdfBtn = document.getElementById('export-pdf');

function rgbToCmyk(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const k = 1 - Math.max(r, g, b);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 1 };
  const c = (1 - r - k) / (1 - k);
  const m = (1 - g - k) / (1 - k);
  const y = (1 - b - k) / (1 - k);
  return { c, m, y, k };
}

function cmykToRgb(c, m, y, k) {
  const r = 255 * (1 - c) * (1 - k);
  const g = 255 * (1 - m) * (1 - k);
  const b = 255 * (1 - y) * (1 - k);
  return { r, g, b };
}

function hexToRgb(hex) {
  const m = hex.replace('#', '').match(/.{1,2}/g);
  return { r: parseInt(m[0], 16), g: parseInt(m[1], 16), b: parseInt(m[2], 16) };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function convertColor(hex) {
  if (colorMode === 'RGB') return hex;
  const { r, g, b } = hexToRgb(hex);
  const { c, m, y, k } = rgbToCmyk(r, g, b);
  const rgb = cmykToRgb(c, m, y, k);
  return rgbToHex(Math.round(rgb.r), Math.round(rgb.g), Math.round(rgb.b));
}

function renderLayerList() {
  layerTableBody.innerHTML = '';
  layers.forEach(layer => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="cursor-pointer" data-id="${layer.id}">${layer.name}</td>
      <td><input type="checkbox" data-field="digital" data-id="${layer.id}" ${layer.digital ? 'checked' : ''}></td>
      <td><input type="checkbox" data-field="print" data-id="${layer.id}" ${layer.print ? 'checked' : ''}></td>`;
    layerTableBody.appendChild(tr);
  });
}

function updateChannelVisibility() {
  layers.forEach(layer => {
    const show = currentChannel === 'digital' ? layer.digital : layer.print;
    layer.el.style.display = show ? '' : 'none';
  });
}

function selectLayer(id) {
  selectedLayer = layers.find(l => l.id === id);
  if (!selectedLayer) return;
  if (selectedLayer.type === 'text') {
    textControls.classList.remove('hidden');
    imageControls.classList.add('hidden');
    textContentInput.value = selectedLayer.el.textContent;
    textColorInput.value = selectedLayer.color;
    fontSizeInput.value = parseInt(selectedLayer.el.style.fontSize) || 24;
  } else {
    imageControls.classList.remove('hidden');
    textControls.classList.add('hidden');
    imgWidthInput.value = selectedLayer.el.width;
    imgHeightInput.value = selectedLayer.el.height;
    const filter = selectedLayer.el.style.filter || 'brightness(100%) contrast(100%)';
    const match = /brightness\((\d+)%\) contrast\((\d+)%\)/.exec(filter);
    imgBrightnessInput.value = match ? match[1] : 100;
    imgContrastInput.value = match ? match[2] : 100;
  }
}

function addText() {
  const div = document.createElement('div');
  div.contentEditable = true;
  div.textContent = 'Text';
  div.style.position = 'absolute';
  div.style.left = '10px';
  div.style.top = '10px';
  div.style.fontSize = '24px';
  div.style.color = convertColor('#000000');
  div.dataset.layerId = layerId;
  designArea.appendChild(div);
  const layer = { id: layerId++, name: 'Text ' + layerId, type: 'text', el: div, color: '#000000', digital: true, print: true };
  layers.push(layer);
  renderLayerList();
  selectLayer(layer.id);
}

function addImage(file) {
  const img = document.createElement('img');
  img.src = URL.createObjectURL(file);
  img.style.position = 'absolute';
  img.style.left = '0';
  img.style.top = '0';
  img.onload = () => {
    imgWidthInput.value = img.width;
    imgHeightInput.value = img.height;
    URL.revokeObjectURL(img.src);
  };
  img.dataset.layerId = layerId;
  designArea.appendChild(img);
  const layer = { id: layerId++, name: file.name, type: 'image', el: img, digital: true, print: true };
  layers.push(layer);
  renderLayerList();
  selectLayer(layer.id);
}

layerTableBody.addEventListener('click', (e) => {
  const id = parseInt(e.target.dataset.id, 10);
  if (e.target.tagName === 'TD') {
    selectLayer(id);
  } else if (e.target.type === 'checkbox') {
    const layer = layers.find(l => l.id === id);
    if (!layer) return;
    layer[e.target.dataset.field] = e.target.checked;
    updateChannelVisibility();
  }
});

colorModeSelect.addEventListener('change', () => {
  colorMode = colorModeSelect.value;
  layers.forEach(l => {
    if (l.type === 'text') {
      l.el.style.color = convertColor(l.color);
    }
  });
});

channelSelect.addEventListener('change', () => {
  currentChannel = channelSelect.value;
  updateChannelVisibility();
});

addTextBtn.addEventListener('click', addText);

addImageInput.addEventListener('change', () => {
  const file = addImageInput.files[0];
  if (file) addImage(file);
  addImageInput.value = '';
});

designArea.addEventListener('click', (e) => {
  const id = parseInt(e.target.dataset.layerId, 10);
  if (id) selectLayer(id);
});

textContentInput.addEventListener('input', () => {
  if (selectedLayer && selectedLayer.type === 'text') {
    selectedLayer.el.textContent = textContentInput.value;
  }
});

textColorInput.addEventListener('input', () => {
  if (selectedLayer && selectedLayer.type === 'text') {
    selectedLayer.color = textColorInput.value;
    selectedLayer.el.style.color = convertColor(selectedLayer.color);
  }
});

fontSizeInput.addEventListener('input', () => {
  if (selectedLayer && selectedLayer.type === 'text') {
    selectedLayer.el.style.fontSize = fontSizeInput.value + 'px';
  }
});

imgWidthInput.addEventListener('input', () => {
  if (selectedLayer && selectedLayer.type === 'image') {
    selectedLayer.el.width = parseInt(imgWidthInput.value, 10);
  }
});

imgHeightInput.addEventListener('input', () => {
  if (selectedLayer && selectedLayer.type === 'image') {
    selectedLayer.el.height = parseInt(imgHeightInput.value, 10);
  }
});

function updateImageFilters() {
  if (selectedLayer && selectedLayer.type === 'image') {
    const b = imgBrightnessInput.value;
    const c = imgContrastInput.value;
    selectedLayer.el.style.filter = `brightness(${b}%) contrast(${c}%)`;
  }
}

imgBrightnessInput.addEventListener('input', updateImageFilters);
imgContrastInput.addEventListener('input', updateImageFilters);

async function exportImage() {
  const scale = parseFloat(exportScale.value) || 1;
  const canvas = await html2canvas(designArea, { scale });
  const mime = exportFormat.value === 'jpeg' ? 'image/jpeg' : 'image/png';
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `design.${exportFormat.value === 'jpeg' ? 'jpg' : 'png'}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }, mime, 0.92);
}

async function exportPdf() {
  const canvas = await html2canvas(designArea, { scale: 1 });
  const imgData = canvas.toDataURL('image/png');
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: canvas.width > canvas.height ? 'landscape' : 'portrait', unit: 'pt', format: [canvas.width, canvas.height] });
  doc.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
  doc.save('design.pdf');
}

exportBtn.addEventListener('click', exportImage);
exportPdfBtn.addEventListener('click', exportPdf);

window.addEventListener('DOMContentLoaded', () => {
  updateChannelVisibility();
  renderLayerList();
});
