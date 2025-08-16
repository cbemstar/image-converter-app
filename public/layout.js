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

  const toolIconBySlug = {
    'image-converter': 'fa-image',
    'background-remover': 'fa-scissors',
    'google-ads-rsa-preview': 'fa-bullhorn',
    'campaign-structure': 'fa-sitemap',
    'bulk-match-editor': 'fa-list',
    'json-formatter': 'fa-code',
    'color-palette': 'fa-palette',
    'pdf-merger': 'fa-file-pdf',
    'utm-builder': 'fa-link',
    'qr-generator': 'fa-qrcode',
    'pdf-ocr': 'fa-file-lines',
    'uuid-generator': 'fa-fingerprint',
    'timestamp-converter': 'fa-clock',
    'meta-tag-generator': 'fa-tags',
    'robots-txt': 'fa-robot',
    'text-case-converter': 'fa-font',
    'layout-tool': 'fa-object-group'
  };

  if (toolList) {
    const basePath = slug ? '../' : 'tools/';
    toolList.innerHTML = '';
    tools.forEach(tool => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `${basePath}${tool.slug}/index.html`;
      a.className = 'text-[var(--foreground)] hover:text-[var(--primary)] flex items-center gap-2';
      const icon = document.createElement('i');
      icon.className = `fas ${toolIconBySlug[tool.slug] || 'fa-toolbox'}`;
      icon.setAttribute('aria-hidden', 'true');
      a.appendChild(icon);
      const span = document.createElement('span');
      span.textContent = tool.name;
      a.appendChild(span);
      a.setAttribute('aria-label', `${tool.name} tool`);
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

  // Notifications bell + panel
  (function initializeNotificationsUI() {
    try {
      const nav = document.querySelector('nav .flex.justify-between .flex.items-center.gap-2');
      if (!nav || document.getElementById('notifications-button')) return;
      const btn = document.createElement('button');
      btn.id = 'notifications-button';
      btn.className = 'btn btn-outline btn-sm';
      btn.setAttribute('aria-label', 'Notifications (F8)');
      btn.title = 'Notifications (F8)';
      btn.innerHTML = '<i class="fas fa-bell"></i><span id="notifications-dot" aria-hidden="true"></span>';
      nav.insertBefore(btn, nav.querySelector('#theme-toggle'));

      const panel = document.createElement('div');
      panel.id = 'notifications-panel';
      panel.setAttribute('role', 'region');
      panel.setAttribute('aria-label', 'Notifications');
      panel.setAttribute('aria-hidden', 'true');
      panel.innerHTML = `
        <div class="p-3 border-b border-[var(--border)] flex items-center justify-between">
          <div class="font-semibold">Notifications</div>
          <div class="text-xs text-[var(--muted-foreground)]">Press F8 to toggle</div>
        </div>
        <div id="notifications-list" class="p-3 space-y-2">
          <div class="text-sm text-[var(--muted-foreground)]">No notifications yet</div>
        </div>
      `;
      document.body.appendChild(panel);

      const state = {
        items: []
      };
      function render() {
        const list = document.getElementById('notifications-list');
        if (!list) return;
        list.innerHTML = '';
        if (state.items.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'text-sm text-[var(--muted-foreground)]';
          empty.textContent = 'No notifications yet';
          list.appendChild(empty);
        } else {
          state.items.forEach(item => {
            const row = document.createElement('div');
            row.className = 'text-sm border border-[var(--border)] rounded p-2 bg-[var(--card)]';
            const time = new Date(item.time).toLocaleTimeString();
            row.textContent = `[${time}] ${item.type.toUpperCase()}: ${item.message}`;
            list.appendChild(row);
          });
        }
        const dot = document.getElementById('notifications-dot');
        if (dot) dot.style.display = state.items.length > 0 ? 'block' : 'none';
      }

      window.__notificationsStore = {
        add(message, type = 'info') {
          state.items.unshift({ message, type, time: Date.now() });
          // keep last 50
          state.items = state.items.slice(0, 50);
          render();
        }
      };

      function togglePanel(force) {
        const isHidden = panel.getAttribute('aria-hidden') !== 'false';
        const nextHidden = typeof force === 'boolean' ? !force : !isHidden;
        panel.setAttribute('aria-hidden', nextHidden ? 'true' : 'false');
      }
      btn.addEventListener('click', () => togglePanel(true));
      document.addEventListener('keydown', (e) => {
        if (e.key === 'F8') {
          e.preventDefault();
          togglePanel();
        }
      });

      render();
    } catch (e) {
      console.warn('Notifications UI not initialized:', e);
    }
  })();

  // Generic a11y for action buttons
  (function enhanceActionButtonsA11y() {
    try {
      // Copy buttons
      document.querySelectorAll('.copy-btn').forEach(btn => {
        if (!btn.getAttribute('aria-label')) {
          const target = btn.getAttribute('data-target') || '';
          btn.setAttribute('aria-label', target ? `Copy ${target} to clipboard` : 'Copy to clipboard');
          btn.title = btn.getAttribute('aria-label');
        }
      });
      // Download buttons/links
      document.querySelectorAll('a[download], .download-btn, #download-btn').forEach(el => {
        if (!el.getAttribute('aria-label')) {
          const name = el.getAttribute('download') || el.textContent.trim() || 'Download';
          el.setAttribute('aria-label', name);
          el.setAttribute('title', name);
        }
      });
    } catch (e) {
      // no-op
    }
  })();
});
