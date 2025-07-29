import { showNotification } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
  const get = id => document.getElementById(id);

  const fields = [
    'meta-title','meta-description','meta-author','meta-keywords','meta-canonical',
    'og-title','og-description','og-image','og-url','og-type',
    'twitter-card','twitter-title','twitter-description','twitter-image'
  ].map(get);

  const code = get('meta-code');
  const previewTitle = get('preview-title');
  const previewUrl = get('preview-url');
  const previewDesc = get('preview-desc');
  const previewImage = get('preview-image');
  const previewOgTitle = get('preview-og-title');
  const previewOgDesc = get('preview-og-desc');
  const copyBtn = get('copy-meta');

  function esc(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function update() {
    const title = fields[0].value.trim();
    const desc = fields[1].value.trim();
    const author = fields[2].value.trim();
    const keywords = fields[3].value.trim();
    const canonical = fields[4].value.trim();

    const ogTitle = fields[5].value.trim() || title;
    const ogDesc = fields[6].value.trim() || desc;
    const ogImage = fields[7].value.trim();
    const ogUrl = fields[8].value.trim() || canonical;
    const ogType = fields[9].value.trim();

    const twCard = fields[10].value.trim();
    const twTitle = fields[11].value.trim() || title;
    const twDesc = fields[12].value.trim() || desc;
    const twImage = fields[13].value.trim();

    let tags = [];
    if (title) tags.push(`<title>${esc(title)}</title>`);
    if (desc) tags.push(`<meta name="description" content="${esc(desc)}">`);
    if (author) tags.push(`<meta name="author" content="${esc(author)}">`);
    if (keywords) tags.push(`<meta name="keywords" content="${esc(keywords)}">`);
    if (canonical) tags.push(`<link rel="canonical" href="${esc(canonical)}">`);
    if (ogTitle) tags.push(`<meta property="og:title" content="${esc(ogTitle)}">`);
    if (ogDesc) tags.push(`<meta property="og:description" content="${esc(ogDesc)}">`);
    if (ogImage) tags.push(`<meta property="og:image" content="${esc(ogImage)}">`);
    if (ogUrl) tags.push(`<meta property="og:url" content="${esc(ogUrl)}">`);
    if (ogType) tags.push(`<meta property="og:type" content="${esc(ogType)}">`);
    if (twCard) tags.push(`<meta name="twitter:card" content="${esc(twCard)}">`);
    if (twTitle) tags.push(`<meta name="twitter:title" content="${esc(twTitle)}">`);
    if (twDesc) tags.push(`<meta name="twitter:description" content="${esc(twDesc)}">`);
    if (twImage) tags.push(`<meta name="twitter:image" content="${esc(twImage)}">`);

    code.value = tags.join('\n');

    previewTitle.textContent = title;
    previewDesc.textContent = desc;
    previewUrl.textContent = canonical || ogUrl;
    previewOgTitle.textContent = ogTitle;
    previewOgDesc.textContent = ogDesc;
    if (ogImage) {
      previewImage.src = ogImage;
      previewImage.classList.remove('hidden');
    } else {
      previewImage.classList.add('hidden');
    }
  }

  fields.forEach(el => {
    if (el) el.addEventListener('input', update);
  });

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      if (!code.value) return;
      navigator.clipboard.writeText(code.value).then(() => {
        showNotification('Copied to clipboard', 'success');
      });
    });
  }

  update();
});
