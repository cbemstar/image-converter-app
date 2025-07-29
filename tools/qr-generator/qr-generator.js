import { showNotification } from '../../utils.js';

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('qr-input');
  const sizeInput = document.getElementById('qr-size');
  const eccSelect = document.getElementById('qr-ecc');
  const fgColor = document.getElementById('qr-fg');
  const bgColor = document.getElementById('qr-bg');
  const container = document.getElementById('qr-container');
  const canvas = document.getElementById('qr-canvas');
  const downloadPNG = document.getElementById('qr-download-png');
  const downloadSVG = document.getElementById('qr-download-svg');
  const urlHint = document.getElementById('url-hint');

  let qr = null;
  let currentSvg = '';

  function validateUrl(value) {
    try {
      new URL(value);
      return true;
    } catch (e) {
      return false;
    }
  }

  function clear() {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    currentSvg = '';
    downloadPNG.style.display = 'none';
    downloadSVG.style.display = 'none';
  }

  function generate() {
    const text = input.value.trim();
    if (!text) {
      clear();
      urlHint.textContent = '';
      return;
    }

    if (/^https?:\/\//i.test(text) && !validateUrl(text)) {
      urlHint.textContent = 'Invalid URL';
      clear();
      return;
    } else {
      urlHint.textContent = '';
    }

    const size = Math.min(1000, Math.max(100, parseInt(sizeInput.value, 10) || 200));
    const ecc = eccSelect.value || 'M';

    canvas.width = canvas.height = size;
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;

    if (!qr) {
      qr = new QRCode(container, {
        text,
        width: size,
        height: size,
        colorDark: fgColor.value,
        colorLight: bgColor.value,
        correctLevel: QRCode.CorrectLevel[ecc]
      });
    } else {
      qr._htOption.width = qr._htOption.height = size;
      qr._htOption.colorDark = fgColor.value;
      qr._htOption.colorLight = bgColor.value;
      qr._htOption.correctLevel = QRCode.CorrectLevel[ecc];
      qr.clear();
      qr.makeCode(text);
    }

    // Convert to canvas for PNG download
    try {
      const img = container.querySelector('img');
      if (img) {
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = size;
        tmpCanvas.height = size;
        const ctx = tmpCanvas.getContext('2d');
        const drawPromise = new Promise(resolve => {
          img.onload = () => resolve();
        });
        ctx.fillStyle = bgColor.value;
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        drawPromise.then(() => {
          const dataUrl = tmpCanvas.toDataURL('image/png');
          const downloadImg = new Image();
          downloadImg.src = dataUrl;
          const ctxMain = canvas.getContext('2d');
          ctxMain.clearRect(0, 0, size, size);
          ctxMain.drawImage(downloadImg, 0, 0, size, size);
          downloadPNG.style.display = 'inline-block';
          downloadSVG.style.display = 'inline-block';
        });
      }
    } catch (err) {
      showNotification('Failed to generate QR code', 'error');
    }

    // Generate SVG string
    try {
      currentSvg = qr.createSvgTag({
        cellSize: 1,
        margin: 0
      });
    } catch (err) {
      currentSvg = '';
    }
  }

  [input, sizeInput, eccSelect, fgColor, bgColor].forEach(el => {
    if (el) el.addEventListener('input', generate);
  });

  if (downloadPNG) {
    downloadPNG.addEventListener('click', () => {
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = 'qrcode.png';
      a.click();
    });
  }

  if (downloadSVG) {
    downloadSVG.addEventListener('click', () => {
      if (!currentSvg) return;
      const blob = new Blob([currentSvg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'qrcode.svg';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  generate();
});
