import { showNotification } from '../../utils.js';

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('json-input');
  const output = document.getElementById('json-output');
  const formatBtn = document.getElementById('format-btn');
  const minifyBtn = document.getElementById('minify-btn');
  const copyBtn = document.getElementById('copy-btn');
  const downloadBtn = document.getElementById('download-btn');
  const shareBtn = document.getElementById('share-btn');
  const jsonCsvBtn = document.getElementById('json-csv-btn');
  const jsonCsvOutput = document.getElementById('json-csv-output');
  const jsonCsvCopy = document.getElementById('json-csv-copy');
  const jsonCsvDownload = document.getElementById('json-csv-download');
  const jsonFileInput = document.getElementById('json-file-input');
  const indentSelect = document.getElementById('indent-select');
  const sortKeysCheckbox = document.getElementById('sort-keys');
  const jsonSearch = document.getElementById('json-search');
  const jsonTree = document.getElementById('json-tree');
  const csvInput = document.getElementById('csv-input');
  const csvOutput = document.getElementById('csv-output');
  const csvConvertBtn = document.getElementById('csv-convert-btn');
  const csvCopyBtn = document.getElementById('csv-copy-btn');
  const csvDownloadBtn = document.getElementById('csv-download-btn');
  const csvFileInput = document.getElementById('csv-file-input');

  let currentText = '';
  let currentData = null;

  function getIndent() {
    if (!indentSelect) return 2;
    const val = indentSelect.value;
    return val === 'tab' ? '\t' : parseInt(val, 10);
  }

  function sortObjectKeys(obj) {
    if (Array.isArray(obj)) return obj.map(sortObjectKeys);
    if (obj && typeof obj === 'object') {
      return Object.keys(obj).sort().reduce((acc, key) => {
        acc[key] = sortObjectKeys(obj[key]);
        return acc;
      }, {});
    }
    return obj;
  }

  function syntaxHighlight(str) {
    return str.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(?=:)|"(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, match => {
        let cls = 'json-number';
        if (/^"/.test(match)) {
          cls = /:$/.test(match) ? 'json-key' : 'json-string';
        } else if (/true|false/.test(match)) {
          cls = 'json-boolean';
        } else if (/null/.test(match)) {
          cls = 'json-null';
        }
        return `<span class="${cls}">${match}</span>`;
      });
  }

  function parseWithPos(text) {
    try {
      return { data: JSON.parse(text) };
    } catch (err) {
      const m = err.message.match(/position (\d+)/i);
      if (m) {
        const pos = parseInt(m[1], 10);
        const before = text.slice(0, pos);
        const line = before.split(/\n/).length;
        const col = before.length - before.lastIndexOf('\n');
        return { error: `${err.message} at line ${line}, column ${col}` };
      }
      return { error: err.message };
    }
  }

  function renderTree(data) {
    if (!jsonTree || !window.JSONFormatter) return;
    jsonTree.innerHTML = '';
    const formatter = new JSONFormatter(data, 1, { theme: document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark' });
    jsonTree.appendChild(formatter.render());
  }

  function format(pretty) {
    if (!input || !output) return;
    const { data, error } = parseWithPos(input.value);
    if (error) {
      output.innerHTML = '';
      currentText = '';
      currentData = null;
      jsonTree.innerHTML = '';
      showNotification('Invalid JSON: ' + error, 'error');
      return;
    }
    let parsed = data;
    if (sortKeysCheckbox && sortKeysCheckbox.checked) {
      parsed = sortObjectKeys(parsed);
    }
    currentText = JSON.stringify(parsed, null, pretty ? getIndent() : 0);
    currentData = parsed;
    output.innerHTML = syntaxHighlight(currentText);
    renderTree(parsed);
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

  function jsonToCsv() {
    if (!jsonCsvOutput) return;
    if (!Array.isArray(currentData) || currentData.length === 0 || typeof currentData[0] !== 'object') {
      showNotification('JSON must be an array of objects', 'error');
      return;
    }
    const keys = Object.keys(currentData[0]);
    const rows = currentData.map(obj => keys.map(k => `"${String(obj[k] ?? '').replace(/"/g,'""')}"`).join(','));
    rows.unshift(keys.join(','));
    jsonCsvOutput.value = rows.join('\n');
  }

  if (formatBtn) formatBtn.addEventListener('click', () => format(true));
  if (minifyBtn) minifyBtn.addEventListener('click', () => format(false));

  if (jsonFileInput) {
    jsonFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        if (file.size > 10 * 1024 * 1024) {
          showNotification('JSON file exceeds 10MB limit', 'error');
          return;
        }
        file.text().then(text => {
          if (input) {
            input.value = text;
            format(true);
          }
        });
      }
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      if (!currentText) return;
      navigator.clipboard.writeText(currentText).then(() => {
        showNotification('Copied to clipboard', 'success');
      });
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      if (!currentText) return;
      const blob = new Blob([currentText], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'formatted.json';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  if (csvConvertBtn) csvConvertBtn.addEventListener('click', convertCsv);

  if (csvFileInput) {
    csvFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        if (file.size > 10 * 1024 * 1024) {
          showNotification('CSV file exceeds 10MB limit', 'error');
          return;
        }
        file.text().then(text => {
          if (csvInput) {
            csvInput.value = text;
            convertCsv();
          }
        });
      }
    });
  }

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

  if (jsonCsvBtn) jsonCsvBtn.addEventListener('click', jsonToCsv);

  if (jsonCsvCopy) {
    jsonCsvCopy.addEventListener('click', () => {
      if (!jsonCsvOutput || !jsonCsvOutput.value) return;
      navigator.clipboard.writeText(jsonCsvOutput.value).then(() => {
        showNotification('Copied to clipboard', 'success');
      });
    });
  }

  if (jsonCsvDownload) {
    jsonCsvDownload.addEventListener('click', () => {
      if (!jsonCsvOutput || !jsonCsvOutput.value) return;
      const blob = new Blob([jsonCsvOutput.value], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'data.csv';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      if (!currentText) return;
      const id = 'share_json_' + Date.now();
      localStorage.setItem(id, currentText);
      const url = `${location.origin}${location.pathname}?share=${id}`;
      navigator.clipboard.writeText(url).then(() => {
        showNotification('Share link copied', 'success');
      });
    });
  }

  if (jsonSearch && jsonTree) {
    jsonSearch.addEventListener('input', () => {
      const term = jsonSearch.value.toLowerCase();
      jsonTree.querySelectorAll('.json-formatter-row').forEach(row => {
        row.style.display = term && !row.textContent.toLowerCase().includes(term) ? 'none' : '';
      });
    });
  }

  const params = new URLSearchParams(location.search);
  const shareId = params.get('share');
  if (shareId) {
    const stored = localStorage.getItem(shareId);
    if (stored && input) {
      input.value = stored;
      format(true);
    }
  }
});
