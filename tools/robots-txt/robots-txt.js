document.addEventListener('DOMContentLoaded', () => {
  const editor = ace.edit('robots-editor');
  editor.session.setMode('ace/mode/text');
  editor.setOptions({
    showLineNumbers: true,
    tabSize: 2,
    useSoftTabs: true
  });

  const defaultTemplate = `User-agent: *\nDisallow:`;
  const templates = {
    default: defaultTemplate,
    wordpress: `User-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php\nSitemap: https://example.com/sitemap.xml`,
    joomla: `User-agent: *\nDisallow: /administrator/\nSitemap: https://example.com/sitemap.xml`
  };

  editor.setValue(defaultTemplate, -1);

  const validationEl = document.getElementById('validation');

  function validate() {
    const lines = editor.getValue().split(/\n/);
    const messages = [];
    const allowed = ['User-agent', 'Disallow', 'Allow', 'Sitemap'];
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const parts = trimmed.split(':');
      if (parts.length < 2) {
        messages.push(`Line ${idx + 1}: Missing ':' separator`);
        return;
      }
      const directive = parts[0].trim();
      const value = parts.slice(1).join(':').trim();
      if (!allowed.includes(directive)) {
        messages.push(`Line ${idx + 1}: Unknown directive '${directive}'`);
      } else if (!value) {
        messages.push(`Line ${idx + 1}: No value for ${directive}`);
      }
    });
    if (messages.length) {
      validationEl.innerHTML = messages.map(m => `<p class='text-red-500'>${m}</p>`).join('');
    } else {
      validationEl.innerHTML = '<p class="text-green-600">No syntax errors found.</p>';
    }
  }

  editor.session.on('change', validate);
  validate();

  const directiveType = document.getElementById('directive-type');
  const directiveValue = document.getElementById('directive-value');
  const addDirectiveBtn = document.getElementById('add-directive');
  if (addDirectiveBtn) {
    addDirectiveBtn.addEventListener('click', () => {
      const value = directiveValue.value.trim();
      if (!value) return;
      editor.session.insert({ row: editor.session.getLength(), column: 0 }, `${directiveType.value}: ${value}\n`);
      directiveValue.value = '';
      validate();
    });
  }

  const templateSelect = document.getElementById('template-select');
  const applyTemplate = document.getElementById('apply-template');
  if (applyTemplate) {
    applyTemplate.addEventListener('click', () => {
      const tpl = templates[templateSelect.value] || defaultTemplate;
      editor.setValue(tpl, -1);
      validate();
    });
  }

  const downloadBtn = document.getElementById('download-btn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      const blob = new Blob([editor.getValue()], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'robots.txt';
      a.click();
      URL.revokeObjectURL(url);
    });
  }
});
