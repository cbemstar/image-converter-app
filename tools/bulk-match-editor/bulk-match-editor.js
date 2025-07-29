import { showNotification } from '../../utils.js';

document.addEventListener('DOMContentLoaded', () => {
  const textarea = document.getElementById('keywords-input');
  const convertBtn = document.getElementById('convert-btn');
  const resultsSection = document.getElementById('results-section');
  const mbOption = document.getElementById('mb-option');
  const negOption = document.getElementById('neg-option');
  const exportBtn = document.getElementById('export-csv-btn');

  const sections = {
    broad: {
      container: document.getElementById('broad-col'),
      body: document.getElementById('broad-body'),
      count: document.getElementById('broad-count'),
      copyBtn: document.getElementById('copy-broad-btn')
    },
    mb: {
      container: document.getElementById('mb-col'),
      body: document.getElementById('mb-body'),
      count: document.getElementById('mb-count'),
      copyBtn: document.getElementById('copy-mb-btn')
    },
    phrase: {
      container: null,
      body: document.getElementById('phrase-body'),
      count: document.getElementById('phrase-count'),
      copyBtn: document.getElementById('copy-phrase-btn')
    },
    exact: {
      container: null,
      body: document.getElementById('exact-body'),
      count: document.getElementById('exact-count'),
      copyBtn: document.getElementById('copy-exact-btn')
    },
    nbroad: {
      container: document.getElementById('nbroad-col'),
      body: document.getElementById('nbroad-body'),
      count: document.getElementById('nbroad-count'),
      copyBtn: document.getElementById('copy-nbroad-btn')
    },
    nmb: {
      container: document.getElementById('nmb-col'),
      body: document.getElementById('nmb-body'),
      count: document.getElementById('nmb-count'),
      copyBtn: document.getElementById('copy-nmb-btn')
    },
    nphrase: {
      container: document.getElementById('nphrase-col'),
      body: document.getElementById('nphrase-body'),
      count: document.getElementById('nphrase-count'),
      copyBtn: document.getElementById('copy-nphrase-btn')
    },
    nexact: {
      container: document.getElementById('nexact-col'),
      body: document.getElementById('nexact-body'),
      count: document.getElementById('nexact-count'),
      copyBtn: document.getElementById('copy-nexact-btn')
    }
  };

  function updateCounts() {
    Object.values(sections).forEach(sec => {
      if (!sec.body) return;
      const visible = !sec.container || !sec.container.classList.contains('hidden');
      if (!visible) return;
      const selected = sec.body.querySelectorAll('.kw-select:checked').length;
      const total = sec.body.querySelectorAll('tr').length;
      if (sec.count) sec.count.textContent = `${selected} selected`;
      if (sec.copyBtn) {
        sec.copyBtn.textContent = selected > 0 ? `Copy ${selected} selected` : 'Copy all';
        sec.copyBtn.disabled = total === 0;
      }
    });
    exportBtn.disabled = resultsSection.classList.contains('hidden');
  }

  function makeRow(text) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="border border-[var(--foreground)]/20 p-2 kw">${text}</td>
      <td class="border border-[var(--foreground)]/20 p-2 text-center">
        <input type="checkbox" class="kw-select">
        <button class="copy-single ml-2" title="Copy"><i class="fas fa-copy"></i></button>
      </td>`;
    return tr;
  }

  function renderRows(keywords) {
    Object.values(sections).forEach(sec => {
      if (sec.body) sec.body.innerHTML = '';
    });

    // Show/hide modified broad and negative sections
    sections.broad.container.classList.remove('hidden');
    if (mbOption.checked) {
      sections.mb.container.classList.remove('hidden');
    } else {
      sections.mb.container.classList.add('hidden');
    }

    if (negOption.checked) {
      document.getElementById('negative-wrapper').classList.remove('hidden');
      sections.nbroad.container.classList.remove('hidden');
      sections.nphrase.container.classList.remove('hidden');
      sections.nexact.container.classList.remove('hidden');
      if (mbOption.checked) {
        sections.nmb.container.classList.remove('hidden');
      } else {
        sections.nmb.container.classList.add('hidden');
      }
    } else {
      document.getElementById('negative-wrapper').classList.add('hidden');
    }

    keywords.forEach(kw => {
      sections.broad.body.appendChild(makeRow(kw));
      if (mbOption.checked) {
        const mbk = kw.split(/\s+/).map(w => `+${w}`).join(' ');
        sections.mb.body.appendChild(makeRow(mbk));
      }
      const phrase = `"${kw}"`;
      const exact = `[${kw}]`;
      sections.phrase.body.appendChild(makeRow(phrase));
      sections.exact.body.appendChild(makeRow(exact));

      if (negOption.checked) {
        sections.nbroad.body.appendChild(makeRow(`-${kw}`));
        if (mbOption.checked) {
          const mbNeg = kw.split(/\s+/).map(w => `+${w}`).join(' ');
          sections.nmb.body.appendChild(makeRow(`-${mbNeg}`));
        }
        sections.nphrase.body.appendChild(makeRow(`-"${kw}"`));
        sections.nexact.body.appendChild(makeRow(`-[${kw}]`));
      }
    });
    resultsSection.classList.remove('hidden');
    exportBtn.disabled = false;
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
    const raw = textarea.value.split(/\n+/).map(k => k.trim()).filter(Boolean);
    const seen = new Set();
    const keywords = [];
    raw.forEach(k => {
      const lower = k.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        keywords.push(k);
      }
    });
    if (!keywords.length) return;
    renderRows(keywords);
  });

  Object.values(sections).forEach(sec => {
    if (!sec.body) return;
    sec.body.addEventListener('change', updateCounts);
    sec.body.addEventListener('click', e => {
      if (e.target.closest('.copy-single')) {
        const text = e.target.closest('tr').querySelector('.kw').textContent;
        navigator.clipboard.writeText(text).then(() => showNotification('Copied keyword', 'success'));
      }
    });
    if (sec.copyBtn) {
      sec.copyBtn.addEventListener('click', () => copySelected(sec.body));
    }
  });

  exportBtn.addEventListener('click', () => {
    const rows = [['Match Type', 'Keyword']];
    const addSection = (label, sec) => {
      if (sec.container && sec.container.classList.contains('hidden')) return;
      Array.from(sec.body.querySelectorAll('.kw')).forEach(td => {
        rows.push([label, td.textContent]);
      });
    };
    addSection('Broad', sections.broad);
    if (mbOption.checked) addSection('Modified Broad', sections.mb);
    addSection('Phrase', sections.phrase);
    addSection('Exact', sections.exact);
    if (negOption.checked) {
      addSection('Negative Broad', sections.nbroad);
      if (mbOption.checked) addSection('Negative Modified Broad', sections.nmb);
      addSection('Negative Phrase', sections.nphrase);
      addSection('Negative Exact', sections.nexact);
    }
    if (rows.length <= 1) return;
    const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'keywords.csv';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
});
