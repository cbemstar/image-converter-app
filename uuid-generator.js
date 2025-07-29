import { showNotification } from './utils.js';
import { v1 as uuidv1, v3 as uuidv3, v4 as uuidv4, v5 as uuidv5, validate as validateUuid } from 'https://cdn.jsdelivr.net/npm/uuid@9.0.0/dist/esm-browser/index.js';

document.addEventListener('DOMContentLoaded', () => {
  const versionSelect = document.getElementById('uuid-version');
  const nsFields = document.getElementById('ns-fields');
  const nsInput = document.getElementById('uuid-namespace');
  const nameInput = document.getElementById('uuid-name');
  const countInput = document.getElementById('uuid-count');
  const output = document.getElementById('uuid-output');
  const generateBtn = document.getElementById('uuid-generate');
  const copyBtn = document.getElementById('uuid-copy');

  function toggleNs() {
    const show = versionSelect.value === 'v3' || versionSelect.value === 'v5';
    if (nsFields) nsFields.classList.toggle('hidden', !show);
  }

  function generate() {
    const count = Math.max(1, Math.min(50, parseInt(countInput.value, 10) || 1));
    const ver = versionSelect.value;
    const uuids = [];
    if (ver === 'v3' || ver === 'v5') {
      const ns = nsInput.value.trim();
      if (!validateUuid(ns)) {
        showNotification('Invalid namespace UUID', 'error');
        return;
      }
      const name = nameInput.value;
      for (let i = 0; i < count; i++) {
        uuids.push(ver === 'v3' ? uuidv3(name, ns) : uuidv5(name, ns));
      }
    } else {
      for (let i = 0; i < count; i++) {
        uuids.push(ver === 'v1' ? uuidv1() : uuidv4());
      }
    }
    output.value = uuids.join('\n');
  }

  if (versionSelect) versionSelect.addEventListener('change', toggleNs);
  if (generateBtn) generateBtn.addEventListener('click', generate);
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      if (!output.value) return;
      navigator.clipboard.writeText(output.value).then(() => {
        showNotification('Copied to clipboard', 'success');
      });
    });
  }

  toggleNs();
  generate();
});
