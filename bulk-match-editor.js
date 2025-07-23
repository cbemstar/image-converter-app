// bulk-match-editor.js - Convert multiple keywords to a chosen match type

document.addEventListener('DOMContentLoaded', () => {
  const textarea = document.getElementById('keywords-input');
  const loadBtn = document.getElementById('load-keywords-btn');
  const editor = document.getElementById('editor');
  const list = document.getElementById('keyword-list');
  const selectAll = document.getElementById('select-all');
  const matchType = document.getElementById('match-type');
  const convertBtn = document.getElementById('convert-btn');
  const output = document.getElementById('output');

  let keywords = [];
  const results = [];

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
    output.classList.add('hidden');
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
    output.value = results.join('\n');
    output.classList.remove('hidden');
    // uncheck boxes after processing
    list.querySelectorAll('input.kw-box').forEach(cb => {
      if (cb.checked) cb.checked = false;
    });
    selectAll.checked = false;
  });
});
