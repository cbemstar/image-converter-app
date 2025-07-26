import { showNotification } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('input');
  const fileInput = document.getElementById('file-input');
  const encodeBtn = document.getElementById('encode-btn');
  const decodeBtn = document.getElementById('decode-btn');
  const output = document.getElementById('output');
  const copyBtn = document.getElementById('copy-btn');
  const downloadBtn = document.getElementById('download-btn');

  let outputBlob = null;
  let outputName = 'output';

  async function encode() {
    try {
      let text;
      if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const buf = await file.arrayBuffer();
        const binary = String.fromCharCode(...new Uint8Array(buf));
        text = btoa(binary);
        outputName = file.name + '.b64';
      } else {
        text = btoa(unescape(encodeURIComponent(input.value)));
        outputName = 'text.b64';
      }
      output.value = text;
      outputBlob = new Blob([text], { type: 'text/plain' });
    } catch (err) {
      showNotification('Failed to encode', 'error');
    }
  }

  async function decode() {
    try {
      let base64;
      if (fileInput.files.length > 0) {
        base64 = await fileInput.files[0].text();
        outputName = fileInput.files[0].name.replace(/\.b64$/, '') || 'output';
      } else {
        base64 = input.value.trim();
        outputName = 'output';
      }
      const binary = atob(base64);
      const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
      outputBlob = new Blob([bytes]);
      let text;
      try {
        text = new TextDecoder().decode(bytes);
      } catch {
        text = null;
      }
      if (text && /[\x09-\x0d\x20-\x7e]/.test(text)) {
        output.value = text;
      } else {
        output.value = '[binary data]';
      }
    } catch (err) {
      showNotification('Invalid Base64 input', 'error');
      outputBlob = null;
      output.value = '';
    }
  }

  if (encodeBtn) encodeBtn.addEventListener('click', encode);
  if (decodeBtn) decodeBtn.addEventListener('click', decode);

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      if (!output.value) return;
      navigator.clipboard.writeText(output.value).then(() => {
        showNotification('Copied to clipboard', 'success');
      });
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      if (!outputBlob) return;
      const url = URL.createObjectURL(outputBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = outputName;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
});
