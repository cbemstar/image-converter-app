document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  const toolSearch = document.getElementById('tool-search');
  const toolList = document.getElementById('tool-list');
  // Sidebar remains overlayed across breakpoints so no main content offset is
  // needed.

  function openSidebar() {
    sidebar.classList.remove('-translate-x-full');
    sidebarToggle.innerHTML = '<i class="fas fa-times"></i>';
    if (sidebarOverlay) sidebarOverlay.classList.remove('hidden');
  }

  function closeSidebar() {
    sidebar.classList.add('-translate-x-full');
    sidebarToggle.innerHTML = '<i class="fas fa-bars"></i>';
    if (sidebarOverlay) sidebarOverlay.classList.add('hidden');
  }

  if (sidebar && sidebarToggle) {
    // Start closed on all screen sizes for consistent behavior.
    closeSidebar();

    sidebarToggle.addEventListener('click', () => {
      const isOpen = !sidebar.classList.contains('-translate-x-full');
      if (isOpen) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });
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
});
