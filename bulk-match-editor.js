import { showNotification } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
  const textarea = document.getElementById('keywords-input');
  const convertBtn = document.getElementById('convert-btn');
  const resultsSection = document.getElementById('results-section');
  const phraseBody = document.getElementById('phrase-body');
  const exactBody = document.getElementById('exact-body');
  const phraseCount = document.getElementById('phrase-count');
  const exactCount = document.getElementById('exact-count');
  const copyPhraseBtn = document.getElementById('copy-phrase-btn');
  const copyExactBtn = document.getElementById('copy-exact-btn');

  function updateCounts() {
    const phraseSelected = phraseBody.querySelectorAll('.kw-select:checked').length;
    const exactSelected = exactBody.querySelectorAll('.kw-select:checked').length;
    phraseCount.textContent = `${phraseSelected} selected`;
    exactCount.textContent = `${exactSelected} selected`;
    copyPhraseBtn.textContent = phraseSelected > 0 ? `Copy ${phraseSelected} selected` : 'Copy all';
    copyExactBtn.textContent = exactSelected > 0 ? `Copy ${exactSelected} selected` : 'Copy all';
    copyPhraseBtn.disabled = phraseBody.querySelectorAll('tr').length === 0;
    copyExactBtn.disabled = exactBody.querySelectorAll('tr').length === 0;
  }

  function renderRows(keywords) {
    phraseBody.innerHTML = '';
    exactBody.innerHTML = '';
    keywords.forEach(kw => {
      const phrase = `"${kw}"`;
      const exact = `[${kw}]`;
      const pRow = document.createElement('tr');
      pRow.innerHTML = `
        <td class="border border-[var(--foreground)]/20 p-2 kw">${phrase}</td>
        <td class="border border-[var(--foreground)]/20 p-2 text-center">
          <input type="checkbox" class="kw-select">
          <button class="copy-single ml-2" title="Copy"><i class="fas fa-copy"></i></button>
        </td>`;
      phraseBody.appendChild(pRow);

      const eRow = document.createElement('tr');
      eRow.innerHTML = `
        <td class="border border-[var(--foreground)]/20 p-2 kw">${exact}</td>
        <td class="border border-[var(--foreground)]/20 p-2 text-center">
          <input type="checkbox" class="kw-select">
          <button class="copy-single ml-2" title="Copy"><i class="fas fa-copy"></i></button>
        </td>`;
      exactBody.appendChild(eRow);
    });
    resultsSection.classList.remove('hidden');
    updateCounts();
  }

  function copySelected(body) {
    const rows = body.querySelectorAll('.kw-select:checked');
    let items;
    if (rows.length) {
      items = Array.from(rows).map(cb => cb.closest('tr').querySelector('.kw').textContent);
    } else {
      items = Array.from(body.querySelectorAll('.kw')).map(td => td.textContent);
    }
    if (!items.length) return;
    navigator.clipboard.writeText(items.join('\n')).then(() => {
      showNotification(`Copied ${items.length} keywords`, 'success');
    });
  }

  convertBtn.addEventListener('click', () => {
    const keywords = textarea.value.split(/\n+/).map(k => k.trim()).filter(Boolean);
    if (!keywords.length) return;
    renderRows(keywords);
  });

  phraseBody.addEventListener('change', updateCounts);
  exactBody.addEventListener('change', updateCounts);

  phraseBody.addEventListener('click', (e) => {
    if (e.target.closest('.copy-single')) {
      const text = e.target.closest('tr').querySelector('.kw').textContent;
      navigator.clipboard.writeText(text).then(() => showNotification('Copied keyword', 'success'));
    }
  });

  exactBody.addEventListener('click', (e) => {
    if (e.target.closest('.copy-single')) {
      const text = e.target.closest('tr').querySelector('.kw').textContent;
      navigator.clipboard.writeText(text).then(() => showNotification('Copied keyword', 'success'));
    }
  });

  copyPhraseBtn.addEventListener('click', () => copySelected(phraseBody));
  copyExactBtn.addEventListener('click', () => copySelected(exactBody));
});
