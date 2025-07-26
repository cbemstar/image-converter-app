import { showNotification } from './utils.js';

function summarize(text, count) {
  if (!text) return '';
  const sentences = text.match(/[^.!?]+[.!?]*/g) || [];
  const words = text.toLowerCase().match(/\w+/g) || [];
  const freq = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  const scored = sentences.map((s, i) => {
    const ws = s.toLowerCase().match(/\w+/g) || [];
    const score = ws.reduce((sum, w) => sum + (freq[w] || 0), 0) / (ws.length || 1);
    return { index: i, sentence: s.trim(), score };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, Math.min(count, scored.length)).sort((a, b) => a.index - b.index);
  return top.map(s => s.sentence).join(' ');
}

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('text-input');
  const lengthSelect = document.getElementById('summary-length');
  const btn = document.getElementById('summarize-btn');
  const output = document.getElementById('summary-output');
  const copyBtn = document.getElementById('copy-summary-btn');

  if (!input || !lengthSelect || !btn || !output) return;

  btn.addEventListener('click', () => {
    const text = input.value.trim();
    if (!text) {
      showNotification('Please enter text to summarize', 'error');
      return;
    }
    const count = parseInt(lengthSelect.value, 10);
    const summary = summarize(text, count);
    output.value = summary || 'Unable to generate summary.';
  });

  copyBtn.addEventListener('click', () => {
    if (!output.value) return;
    navigator.clipboard.writeText(output.value).then(() => {
      showNotification('Summary copied!', 'success');
    });
  });
});
