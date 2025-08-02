document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebarClose = document.getElementById('sidebar-close');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  const toolSearch = document.getElementById('tool-search');
  const toolList = document.getElementById('tool-list');
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

  const slug = document.body && document.body.dataset.slug;
  if (slug) {
    const key = `visits_${slug}`;
    const count = parseInt(localStorage.getItem(key) || '0', 10) + 1;
    localStorage.setItem(key, count);
  }
});
