import { showNotification } from './utils.js';

let segmenter;

async function loadModel() {
  if (!segmenter) {
    segmenter = new SelfieSegmentation({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1/${file}`,
    });
    segmenter.setOptions({ modelSelection: 1 });
    await segmenter.initialize();
  }
  return segmenter;
}

async function runSegmentation(image) {
  await loadModel();
  return new Promise((resolve, reject) => {
    segmenter.onResults((results) => resolve(results.segmentationMask));
    segmenter.send({ image }).catch(reject);
  });
}

async function processImage(file) {
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode();

  const mask = await runSegmentation(img);

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  ctx.globalCompositeOperation = 'destination-in';
  ctx.filter = 'blur(2px)';
  ctx.drawImage(mask, 0, 0, canvas.width, canvas.height);
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-over';

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
