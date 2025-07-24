// bulk-match-editor.js - Convert multiple keywords to a chosen match type
import { showNotification } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
  const textarea = document.getElementById('keywords-input');
  const loadBtn = document.getElementById('load-keywords-btn');
  const editor = document.getElementById('editor');
  const list = document.getElementById('keyword-list');
  const selectAll = document.getElementById('select-all');
  const matchType = document.getElementById('match-type');
  const convertBtn = document.getElementById('convert-btn');
  const resultsSection = document.getElementById('results-section');
  const resultsBody = document.getElementById('results-body');
  const copyBtn = document.getElementById('copy-btn');
  const selectedCountLabel = document.getElementById('selected-count');

  let keywords = [];
  const results = [];

  function updateCopyText() {
    const count = resultsBody.querySelectorAll('.result-select:checked').length;
    selectedCountLabel.textContent = `${count} selected`;
    copyBtn.textContent = `Copy ${count} selected keyword${count === 1 ? '' : 's'}`;
    copyBtn.disabled = count === 0;
  }

  function renderResults() {
    resultsBody.innerHTML = '';
    results.forEach((kw, idx) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="border border-[var(--foreground)]/20 p-2">
          <input type="text" class="result-input w-full bg-transparent outline-none" data-index="${idx}" value="${kw}">
        </td>
        <td class="border border-[var(--foreground)]/20 p-2 text-center">
          <input type="checkbox" class="result-select" data-index="${idx}">
        </td>`;
      resultsBody.appendChild(row);
    });
    resultsSection.classList.remove('hidden');
    updateCopyText();
  }

  function renderList() {
    list.innerHTML = '';
    keywords.forEach((kw, idx) => {
      const li = document.createElement('li');
      li.innerHTML = `<label class="flex items-center gap-2"><input type="checkbox" data-index="${idx}" class="kw-box">${kw}</label>`;
      list.appendChild(li);
    });
  }

  loadBtn.addEventListener('click', () => {
    keywords = textarea.value.split(/\n+/).map(k => k.trim()).filter(Boolean);
    if (!keywords.length) return;
    renderList();
    editor.classList.remove('hidden');
    resultsSection.classList.add('hidden');
  });

  selectAll.addEventListener('change', () => {
    list.querySelectorAll('input.kw-box').forEach(cb => {
      cb.checked = selectAll.checked;
    });
  });

  convertBtn.addEventListener('click', () => {
    const selected = [];
    list.querySelectorAll('input.kw-box').forEach(cb => {
      if (cb.checked) selected.push(keywords[cb.dataset.index]);
    });
    if (!selected.length) return;
    const type = matchType.value;
    const converted = selected.map(k => {
      if (type === 'exact') return `[${k}]`;
      if (type === 'phrase') return `"${k}"`;
      return k;
    });

    results.push(...converted);
    renderResults();
    // uncheck boxes after processing
    list.querySelectorAll('input.kw-box').forEach(cb => {
      if (cb.checked) cb.checked = false;
    });
    selectAll.checked = false;
  });

  resultsBody.addEventListener('input', (e) => {
    if (e.target.classList.contains('result-input')) {
      results[e.target.dataset.index] = e.target.value;
    }
  });

  resultsBody.addEventListener('change', (e) => {
    if (e.target.classList.contains('result-select')) {
      updateCopyText();
    }
  });

  copyBtn.addEventListener('click', () => {
    const selected = [];
    resultsBody.querySelectorAll('.result-select:checked').forEach(cb => {
      selected.push(results[cb.dataset.index]);
    });
    if (!selected.length) return;
    navigator.clipboard.writeText(selected.join('\n')).then(() => {
      showNotification(`Copied ${selected.length} keywords`, 'success');
    });
  });
});
