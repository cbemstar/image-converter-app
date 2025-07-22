document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  const toolSearch = document.getElementById('tool-search');
  const toolList = document.getElementById('tool-list');
  const mainContent = document.getElementById('main-content');

  function updateMainOffset() {
    if (!mainContent) return;
    const isOpen = !sidebar.classList.contains('-translate-x-full');
    if (isOpen) {
      mainContent.classList.add('md:pl-64');
    } else {
      mainContent.classList.remove('md:pl-64');
    }
  }

  function openSidebar() {
    sidebar.classList.remove('-translate-x-full');
    sidebarToggle.innerHTML = '<i class="fas fa-times"></i>';
    if (window.innerWidth < 768 && sidebarOverlay) sidebarOverlay.classList.remove('hidden');
    updateMainOffset();
  }

  function closeSidebar() {
    sidebar.classList.add('-translate-x-full');
    sidebarToggle.innerHTML = '<i class="fas fa-bars"></i>';
    if (sidebarOverlay) sidebarOverlay.classList.add('hidden');
    updateMainOffset();
  }

  if (sidebar && sidebarToggle) {
    if (window.innerWidth >= 768) {
      openSidebar();
    } else {
      closeSidebar();
    }

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
