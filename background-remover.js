import { showNotification } from './utils.js';

let net;

async function loadModel() {
  if (!net) {
    try {
      net = await bodyPix.load();
    } catch (e) {
      showNotification('Failed to load model', 'error');
      throw e;
    }
  }
  return net;
}

async function processImage(file) {
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode();

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  await loadModel();
  const segmentation = await net.segmentPerson(img);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const mask = segmentation.data;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === 0) {
      data[i * 4 + 3] = 0;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  URL.revokeObjectURL(img.src);
  return canvas.toDataURL('image/png');
}

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('image-input');
  const preview = document.getElementById('result-preview');
  const downloadBtn = document.getElementById('download-btn');

  if (!input) return;

  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      showNotification('Only PNG and JPG images are supported. Use the Image Converter tool first.', 'error');
      input.value = '';
      return;
    }
    preview.src = '';
    downloadBtn.style.display = 'none';
    try {
      showNotification('Processing image...', 'info');
      const url = await processImage(file);
      preview.src = url;
      downloadBtn.href = url;
      downloadBtn.style.display = 'inline-flex';
      showNotification('Background removed!', 'success');
    } catch (e) {
      console.error(e);
      showNotification('Failed to process image', 'error');
    }
  });
});
