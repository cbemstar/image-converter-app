import { showNotification } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
  const dropArea = document.getElementById('drop-area');
  const fileInput = document.getElementById('file-input');
  const selectBtn = document.getElementById('select-btn');
  const output = document.getElementById('text-output');
  const progressStatus = document.getElementById('progress-status');
  const progressContainer = document.getElementById('progress-bar-container');
  const progressBar = document.getElementById('progress-bar');
  const downloadBtn = document.getElementById('download-btn');

  function dragOver(e) {
    e.preventDefault();
    dropArea.classList.add('border-blue-300');
  }

  function dragLeave() {
    dropArea.classList.remove('border-blue-300');
  }

  async function processFile(file) {
    if (!file) return;
    if (!(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
      showNotification('Please upload a PDF file', 'error');
      return;
    }
    output.value = '';
    progressStatus.textContent = 'Loading PDF...';
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    downloadBtn.style.display = 'none';

    try {
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      const total = Math.min(pdf.numPages, 50);
      let text = '';
      for (let i = 1; i <= total; i++) {
        progressStatus.textContent = `Processing page ${i} of ${total}`;
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        const result = await Tesseract.recognize(canvas, 'eng');
        text += result.data.text + '\n\n';
        progressBar.style.width = `${Math.round((i / total) * 100)}%`;
        await new Promise(r => setTimeout(r));
      }
      output.value = text.trim();
      progressStatus.textContent = 'Done!';
      progressContainer.style.display = 'none';
      downloadBtn.style.display = 'inline-block';
      downloadBtn.onclick = () => {
        const blob = new Blob([output.value], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name.replace(/\.pdf$/i, '') + '.txt';
        a.click();
        URL.revokeObjectURL(url);
      };
    } catch (err) {
      console.error(err);
      progressContainer.style.display = 'none';
      progressStatus.textContent = '';
      showNotification('OCR failed: ' + err.message, 'error');
    }
  }

  dropArea.addEventListener('dragover', dragOver);
  dropArea.addEventListener('dragleave', dragLeave);
  dropArea.addEventListener('drop', e => {
    e.preventDefault();
    dragLeave();
    processFile(e.dataTransfer.files[0]);
  });

  fileInput.addEventListener('change', () => {
    processFile(fileInput.files[0]);
    fileInput.value = '';
  });

  if (selectBtn) selectBtn.addEventListener('click', () => fileInput.click());
});
