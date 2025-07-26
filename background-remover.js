import { showNotification } from './utils.js';

// Update this URL to point to your FastAPI deployment
const API_BASE = 'http://localhost:8000';

async function processImage(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/api/remove-background`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Server error');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
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
