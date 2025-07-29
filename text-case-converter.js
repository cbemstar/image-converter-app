import { showNotification } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('tcc-input');
  const outputs = {
    upper: document.getElementById('tcc-upper'),
    lower: document.getElementById('tcc-lower'),
    title: document.getElementById('tcc-title'),
    sentence: document.getElementById('tcc-sentence'),
    alternate: document.getElementById('tcc-alternate')
  };

  function titleCase(str) {
    return str.toLowerCase().replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1));
  }

  function sentenceCase(str) {
    const lower = str.toLowerCase();
    return lower.replace(/(^\s*\w|[.!?]\s*\w)/g, c => c.toUpperCase());
  }

  function alternatingCase(str) {
    let result = '';
    let upper = true;
    for (const ch of str) {
      if (/[a-z]/i.test(ch)) {
        result += upper ? ch.toUpperCase() : ch.toLowerCase();
        upper = !upper;
      } else {
        result += ch;
      }
    }
    return result;
  }

  function update() {
    const text = input.value;
    outputs.upper.value = text.toUpperCase();
    outputs.lower.value = text.toLowerCase();
    outputs.title.value = titleCase(text);
    outputs.sentence.value = sentenceCase(text);
    outputs.alternate.value = alternatingCase(text);
  }

  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.target;
      const el = document.getElementById(id);
      if (!el || !el.value) return;
      navigator.clipboard.writeText(el.value).then(() => {
        showNotification('Copied to clipboard', 'success');
      });
    });
  });

  if (input) input.addEventListener('input', update);
  update();
});
