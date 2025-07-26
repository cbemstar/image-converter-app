import { showNotification } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
  const baseUrl = document.getElementById('base-url');
  const source = document.getElementById('utm-source');
  const medium = document.getElementById('utm-medium');
  const campaign = document.getElementById('utm-campaign');
  const term = document.getElementById('utm-term');
  const content = document.getElementById('utm-content');
  const generateBtn = document.getElementById('generate-btn');
  const finalUrl = document.getElementById('final-url');
  const resultSection = document.getElementById('result-section');
  const copyBtn = document.getElementById('copy-btn');
  const templateSelect = document.getElementById('template-select');
  const saveTemplateBtn = document.getElementById('save-template-btn');
  const applyTemplateBtn = document.getElementById('apply-template-btn');
  const deleteTemplateBtn = document.getElementById('delete-template-btn');

  function loadTemplates() {
    const templates = JSON.parse(localStorage.getItem('utm_templates') || '{}');
    templateSelect.innerHTML = '<option value="">Select template</option>';
    Object.keys(templates).forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      templateSelect.appendChild(opt);
    });
  }

  function saveTemplate() {
    const name = prompt('Template name?');
    if (!name) return;
    const templates = JSON.parse(localStorage.getItem('utm_templates') || '{}');
    templates[name] = {
      source: source.value,
      medium: medium.value,
      campaign: campaign.value,
      term: term.value,
      content: content.value
    };
    localStorage.setItem('utm_templates', JSON.stringify(templates));
    loadTemplates();
    showNotification('Template saved', 'success');
  }

  function applyTemplate() {
    const name = templateSelect.value;
    if (!name) return;
    const templates = JSON.parse(localStorage.getItem('utm_templates') || '{}');
    const tpl = templates[name];
    if (!tpl) return;
    source.value = tpl.source || '';
    medium.value = tpl.medium || '';
    campaign.value = tpl.campaign || '';
    term.value = tpl.term || '';
    content.value = tpl.content || '';
  }

  function deleteTemplate() {
    const name = templateSelect.value;
    if (!name) return;
    if (!confirm('Delete template?')) return;
    const templates = JSON.parse(localStorage.getItem('utm_templates') || '{}');
    delete templates[name];
    localStorage.setItem('utm_templates', JSON.stringify(templates));
    loadTemplates();
  }

  function generate() {
    let urlObj;
    try {
      urlObj = new URL(baseUrl.value);
    } catch (e) {
      showNotification('Invalid URL', 'error');
      return;
    }
    const params = new URLSearchParams(urlObj.search);
    if (source.value) params.set('utm_source', source.value);
    if (medium.value) params.set('utm_medium', medium.value);
    if (campaign.value) params.set('utm_campaign', campaign.value);
    if (term.value) params.set('utm_term', term.value);
    if (content.value) params.set('utm_content', content.value);
    urlObj.search = params.toString();
    finalUrl.value = urlObj.toString();
    resultSection.classList.remove('hidden');
  }

  generateBtn.addEventListener('click', generate);
  copyBtn.addEventListener('click', () => {
    if (!finalUrl.value) return;
    navigator.clipboard.writeText(finalUrl.value).then(() => {
      showNotification('Copied to clipboard', 'success');
    });
  });
  saveTemplateBtn.addEventListener('click', saveTemplate);
  applyTemplateBtn.addEventListener('click', applyTemplate);
  deleteTemplateBtn.addEventListener('click', deleteTemplate);

  loadTemplates();
});
