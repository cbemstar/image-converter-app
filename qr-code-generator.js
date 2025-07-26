import { showNotification } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('qr-input');
  const sizeInput = document.getElementById('qr-size');
  const levelSelect = document.getElementById('qr-level');
  const generateBtn = document.getElementById('generate-btn');
  const preview = document.getElementById('qr-preview');
  const downloadPng = document.getElementById('download-png');
  const downloadSvg = document.getElementById('download-svg');

  let svgUrl = null;

  function revokeUrls() {
    if (svgUrl) {
      URL.revokeObjectURL(svgUrl);
      svgUrl = null;
    }
  }

  function generate() {
    if (!input) return;
    const text = input.value.trim();
    if (!text) {
      showNotification('Please enter text or a URL', 'error');
      return;
    }
    const size = parseInt(sizeInput.value, 10) || 256;
    const level = levelSelect.value || 'M';
    revokeUrls();

    if (downloadPng) downloadPng.style.display = 'none';
    if (downloadSvg) downloadSvg.style.display = 'none';

    QRCode.toDataURL(text, { errorCorrectionLevel: level, width: size })
      .then(url => {
        if (preview) {
          preview.src = url;
          preview.style.display = 'block';
        }
        if (downloadPng) {
          downloadPng.href = url;
          downloadPng.style.display = 'inline-block';
        }
      })
      .catch(err => {
        console.error(err);
        showNotification('Failed to generate PNG', 'error');
      });

    QRCode.toString(text, { type: 'svg', errorCorrectionLevel: level, width: size })
      .then(svg => {
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        svgUrl = URL.createObjectURL(blob);
        if (downloadSvg) {
          downloadSvg.href = svgUrl;
          downloadSvg.style.display = 'inline-block';
        }
      })
      .catch(err => {
        console.error(err);
        showNotification('Failed to generate SVG', 'error');
      });
  }

  if (generateBtn) generateBtn.addEventListener('click', generate);
});
