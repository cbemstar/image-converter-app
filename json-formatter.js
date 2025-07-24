import { showNotification } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('json-input');
  const output = document.getElementById('json-output');
  const formatBtn = document.getElementById('format-btn');
  const minifyBtn = document.getElementById('minify-btn');
  const copyBtn = document.getElementById('copy-btn');
  const downloadBtn = document.getElementById('download-btn');
  const csvInput = document.getElementById('csv-input');
  const csvOutput = document.getElementById('csv-output');
  const csvConvertBtn = document.getElementById('csv-convert-btn');
  const csvCopyBtn = document.getElementById('csv-copy-btn');
  const csvDownloadBtn = document.getElementById('csv-download-btn');

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

  function convertCsv() {
    if (!csvInput || !csvOutput) return;
    try {
      const lines = csvInput.value.trim().split(/\r?\n/).filter(Boolean);
      if (lines.length === 0) {
        csvOutput.value = '';
        return;
      }
      const headers = lines[0].split(',').map(h => h.trim());
      const data = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const obj = {};
        headers.forEach((h, i) => {
          obj[h] = values[i] || '';
        });
        return obj;
      });
      csvOutput.value = JSON.stringify(data, null, 2);
    } catch (err) {
      csvOutput.value = '';
      showNotification('Failed to parse CSV: ' + err.message, 'error');
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

  if (csvConvertBtn) csvConvertBtn.addEventListener('click', convertCsv);

  if (csvCopyBtn) {
    csvCopyBtn.addEventListener('click', () => {
      if (!csvOutput || !csvOutput.value) return;
      navigator.clipboard.writeText(csvOutput.value).then(() => {
        showNotification('Copied to clipboard', 'success');
      });
    });
  }

  if (csvDownloadBtn) {
    csvDownloadBtn.addEventListener('click', () => {
      if (!csvOutput || !csvOutput.value) return;
      const blob = new Blob([csvOutput.value], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'data.json';
      a.click();
      URL.revokeObjectURL(url);
    });
  }
});
