import { showNotification } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('json-input');
  const output = document.getElementById('json-output');
  const formatBtn = document.getElementById('format-btn');
  const minifyBtn = document.getElementById('minify-btn');
  const copyBtn = document.getElementById('copy-btn');
  const downloadBtn = document.getElementById('download-btn');

  function format(pretty) {
    if (!input || !output) return;
    try {
      const parsed = JSON.parse(input.value);
      output.value = JSON.stringify(parsed, null, pretty ? 2 : 0);
    } catch (err) {
      output.value = '';
      showNotification('Invalid JSON: ' + err.message, 'error');
    }
  }

  if (formatBtn) formatBtn.addEventListener('click', () => format(true));
  if (minifyBtn) minifyBtn.addEventListener('click', () => format(false));

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      if (!output || !output.value) return;
      navigator.clipboard.writeText(output.value).then(() => {
        showNotification('Copied to clipboard', 'success');
      });
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      if (!output || !output.value) return;
      const blob = new Blob([output.value], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'formatted.json';
      a.click();
      URL.revokeObjectURL(url);
    });
  }
});
