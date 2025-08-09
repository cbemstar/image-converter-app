document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebarClose = document.getElementById('sidebar-close');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  const toolSearch = document.getElementById('tool-search');
  const toolList = document.getElementById('tool-list');
  const slug = document.body && document.body.dataset.slug;

  const tools = [
    { slug: 'image-converter', name: 'Image Converter' },
    { slug: 'background-remover', name: 'Background Remover' },
    { slug: 'google-ads-rsa-preview', name: 'Google Ads RSA Preview' },
    { slug: 'campaign-structure', name: 'Campaign Structure' },
    { slug: 'bulk-match-editor', name: 'Bulk Match Type Editor' },
    { slug: 'json-formatter', name: 'JSON Formatter' },
    { slug: 'color-palette', name: 'Colour Palette Extractor' },
    { slug: 'pdf-merger', name: 'PDF Merger' },
    { slug: 'utm-builder', name: 'UTM Builder' },
    { slug: 'qr-generator', name: 'QR Code Generator' },
    { slug: 'pdf-ocr', name: 'PDF OCR' },
    { slug: 'uuid-generator', name: 'UUID Generator' },
    { slug: 'timestamp-converter', name: 'Timestamp Converter' },
    { slug: 'meta-tag-generator', name: 'Meta Tag Generator' },
    { slug: 'robots-txt', name: 'Robots.txt Tool' },
    { slug: 'text-case-converter', name: 'Text Case Converter' },
    { slug: 'layout-tool', name: 'Layout Generator' }
  ];

  if (toolList) {
    const basePath = slug ? '../' : 'tools/';
    toolList.innerHTML = '';
    tools.forEach(tool => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `${basePath}${tool.slug}/index.html`;
      a.textContent = tool.name;
      a.className = 'text-[var(--foreground)] hover:text-[var(--primary)]';
      li.appendChild(a);
      toolList.appendChild(li);
    });
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = 'More coming soon';
    a.className = 'text-[var(--foreground)] hover:text-[var(--primary)]';
    li.appendChild(a);
    toolList.appendChild(li);
  }
  // Sidebar remains overlayed across breakpoints so no main content offset is
  // needed.

  function openSidebar() {
    sidebar.classList.remove('-translate-x-full');
    if (sidebarOverlay) sidebarOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    sidebar.classList.add('-translate-x-full');
    if (sidebarOverlay) sidebarOverlay.classList.add('hidden');
    document.body.style.overflow = '';
  }

  if (sidebar && sidebarToggle) {
    // Sidebar starts hidden via CSS for consistent behavior.

    sidebarToggle.addEventListener('click', () => {
      const isOpen = !sidebar.classList.contains('-translate-x-full');
      if (isOpen) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });
  }

  if (sidebarClose) {
    sidebarClose.addEventListener('click', closeSidebar);
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', closeSidebar);
  }

  if (toolSearch && toolList) {
    toolSearch.addEventListener('input', () => {
      const term = toolSearch.value.toLowerCase();
      toolList.querySelectorAll('li').forEach(li => {
        const text = li.textContent.toLowerCase();
        li.style.display = text.includes(term) ? '' : 'none';
      });
    });
  }

  if (slug) {
    const key = `visits_${slug}`;
    const count = parseInt(localStorage.getItem(key) || '0', 10) + 1;
    localStorage.setItem(key, count);
  }
});
