import { showNotification } from '../../utils.js';

document.addEventListener('DOMContentLoaded', () => {
  const base = document.getElementById('base-url');
  const source = document.getElementById('utm-source');
  const medium = document.getElementById('utm-medium');
  const campaign = document.getElementById('utm-campaign');
  const term = document.getElementById('utm-term');
  const content = document.getElementById('utm-content');
  const result = document.getElementById('utm-result');
  const copyBtn = document.getElementById('copy-btn');

  function update() {
    const baseVal = base.value.trim();
    if (!baseVal) {
      result.value = '';
      return;
    }
    let url;
    try {
      url = new URL(baseVal);
    } catch {
      try {
        url = new URL('https://' + baseVal);
      } catch {
        result.value = '';
        return;
      }
    }
    const params = url.searchParams;
    const set = (k, v) => {
      if (v) params.set(k, v); else params.delete(k);
    };
    set('utm_source', source.value.trim());
    set('utm_medium', medium.value.trim());
    set('utm_campaign', campaign.value.trim());
    set('utm_term', term.value.trim());
    set('utm_content', content.value.trim());
    result.value = url.toString();
  }

  [base, source, medium, campaign, term, content].forEach(el => {
    if (el) el.addEventListener('input', update);
  });

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      if (!result.value) return;
      navigator.clipboard.writeText(result.value).then(() => {
        showNotification('Copied to clipboard', 'success');
      });
    });
  }

  update();
});
