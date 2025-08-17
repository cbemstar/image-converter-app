// Universal Navigation System for reformately.com
// This script provides consistent navigation across all pages

class UniversalNavigation {
  constructor() {
    this.init();
  }

  init() {
    this.createNavigation();
    this.createSidebar();
    this.createCommandMenu();
    this.bindEvents();
    this.initializeIcons();
  }

  createNavigation() {
    const navHTML = `
      <nav class="nav">
        <div class="nav-container">
          <div class="flex items-center gap-4">
            <button id="sidebar-toggle" class="btn btn-outline btn-sm" aria-label="Open sidebar">
              <i data-lucide="menu" class="w-4 h-4"></i>
            </button>
            <a href="/" class="text-xl font-bold">reformately</a>
          </div>
          
          <div class="flex items-center gap-2">
            <button id="search-button" class="btn btn-outline btn-sm" aria-label="Search" title="Search (⌘K)">
              <i data-lucide="search" class="w-4 h-4"></i>
              <span class="hidden sm:inline ml-2">Search</span>
            </button>
            <button id="theme-toggle" class="btn btn-outline btn-sm" aria-label="Toggle theme" title="Toggle Theme (⌘T)">
              <i data-lucide="sun" id="theme-toggle-icon" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      </nav>
    `;

    // Insert navigation at the beginning of the body
    document.body.insertAdjacentHTML('afterbegin', navHTML);
  }

  createSidebar() {
    const sidebarHTML = `
      <div id="sidebar-overlay" class="sidebar-overlay"></div>
      <aside id="sidebar" class="sidebar">
        <div class="sidebar-header">
          <a href="/" class="text-xl font-bold">reformately</a>
          <button id="sidebar-close" class="btn btn-outline btn-sm" aria-label="Close sidebar">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>
        
        <div class="sidebar-content">
          <div class="sidebar-group">
            <div class="sidebar-group-label">Search</div>
            <input id="tool-search" type="text" placeholder="Search tools..." class="input" />
          </div>
          
          <div class="sidebar-group">
            <div class="sidebar-group-label">Tools</div>
            <ul class="sidebar-menu">
              <li class="sidebar-menu-item">
                <a href="/tools/image-converter/index.html" class="sidebar-menu-button">
                  <i data-lucide="image" class="w-4 h-4"></i>
                  <span>Image Converter</span>
                </a>
              </li>
              <li class="sidebar-menu-item">
                <a href="/tools/background-remover/index.html" class="sidebar-menu-button">
                  <i data-lucide="scissors" class="w-4 h-4"></i>
                  <span>Background Remover</span>
                </a>
              </li>
              <li class="sidebar-menu-item">
                <a href="/tools/google-ads-rsa-preview/index.html" class="sidebar-menu-button">
                  <i data-lucide="bar-chart-3" class="w-4 h-4"></i>
                  <span>Google Ads RSA Preview</span>
                </a>
              </li>
              <li class="sidebar-menu-item">
                <a href="/tools/campaign-structure/index.html" class="sidebar-menu-button">
                  <i data-lucide="layers" class="w-4 h-4"></i>
                  <span>Campaign Structure</span>
                </a>
              </li>
              <li class="sidebar-menu-item">
                <a href="/tools/bulk-match-editor/index.html" class="sidebar-menu-button">
                  <i data-lucide="edit-3" class="w-4 h-4"></i>
                  <span>Bulk Match Type Editor</span>
                </a>
              </li>
              <li class="sidebar-menu-item">
                <a href="/tools/json-formatter/index.html" class="sidebar-menu-button">
                  <i data-lucide="braces" class="w-4 h-4"></i>
                  <span>JSON Formatter</span>
                </a>
              </li>
              <li class="sidebar-menu-item">
                <a href="/tools/color-palette/index.html" class="sidebar-menu-button">
                  <i data-lucide="palette" class="w-4 h-4"></i>
                  <span>Colour Palette Extractor</span>
                </a>
              </li>
              <li class="sidebar-menu-item">
                <a href="/tools/pdf-merger/index.html" class="sidebar-menu-button">
                  <i data-lucide="file-text" class="w-4 h-4"></i>
                  <span>PDF Merger</span>
                </a>
              </li>
              <li class="sidebar-menu-item">
                <a href="/tools/utm-builder/index.html" class="sidebar-menu-button">
                  <i data-lucide="link" class="w-4 h-4"></i>
                  <span>UTM Builder</span>
                </a>
              </li>
              <li class="sidebar-menu-item">
                <a href="/tools/qr-generator/index.html" class="sidebar-menu-button">
                  <i data-lucide="qr-code" class="w-4 h-4"></i>
                  <span>QR Code Generator</span>
                </a>
              </li>
              <li class="sidebar-menu-item">
                <a href="/tools/pdf-ocr/index.html" class="sidebar-menu-button">
                  <i data-lucide="file-search" class="w-4 h-4"></i>
                  <span>PDF OCR</span>
                </a>
              </li>
              <li class="sidebar-menu-item">
                <a href="/tools/uuid-generator/index.html" class="sidebar-menu-button">
                  <i data-lucide="hash" class="w-4 h-4"></i>
                  <span>UUID Generator</span>
                </a>
              </li>
              <li class="sidebar-menu-item">
                <a href="/tools/timestamp-converter/index.html" class="sidebar-menu-button">
                  <i data-lucide="clock" class="w-4 h-4"></i>
                  <span>Timestamp Converter</span>
                </a>
              </li>
              <li class="sidebar-menu-item">
                <a href="/tools/meta-tag-generator/index.html" class="sidebar-menu-button">
                  <i data-lucide="tag" class="w-4 h-4"></i>
                  <span>Meta Tag Generator</span>
                </a>
              </li>
              <li class="sidebar-menu-item">
                <a href="/tools/robots-txt/index.html" class="sidebar-menu-button">
                  <i data-lucide="bot" class="w-4 h-4"></i>
                  <span>Robots.txt Tool</span>
                </a>
              </li>
              <li class="sidebar-menu-item">
                <a href="/tools/text-case-converter/index.html" class="sidebar-menu-button">
                  <i data-lucide="type" class="w-4 h-4"></i>
                  <span>Text Case Converter</span>
                </a>
              </li>
              <li class="sidebar-menu-item">
                <a href="/tools/layout-tool/index.html" class="sidebar-menu-button">
                  <i data-lucide="layout" class="w-4 h-4"></i>
                  <span>Layout Generator</span>
                </a>
              </li>
            </ul>
          </div>
          
          <div class="sidebar-group">
            <div class="sidebar-group-label">Actions</div>
            <a href="/tools/request-tool/index.html" class="sidebar-menu-button">
              <i data-lucide="message-square" class="w-4 h-4"></i>
              <span>Request a Tool</span>
            </a>
            <a href="#" class="sidebar-menu-button">
              <i data-lucide="plus" class="w-4 h-4"></i>
              <span>More coming soon</span>
            </a>
          </div>
        </div>
      </aside>
    `;

    // Insert sidebar after navigation
    document.body.insertAdjacentHTML('afterbegin', sidebarHTML);
  }

  createCommandMenu() {
    const commandMenuHTML = `
      <div id="command-dialog" class="command-dialog">
        <div class="command-input-wrapper">
          <i data-lucide="search" class="w-5 h-5 text-muted-foreground"></i>
          <input 
            id="command-input" 
            type="text" 
            placeholder="Search for tools, commands, or features..." 
            class="command-input"
          />
          <button id="command-close" class="btn btn-ghost btn-sm">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>
        
        <div class="command-list">
          <div class="command-group">
            <div class="command-group-heading">Quick Actions</div>
            <div class="command-item" data-action="explore-tools">
              <i data-lucide="compass" class="w-4 h-4"></i>
              <span>Explore Tools</span>
              <span class="command-shortcut">⌘E</span>
            </div>
            <div class="command-item" data-action="request-tool">
              <i data-lucide="message-square" class="w-4 h-4"></i>
              <span>Request a Tool</span>
              <span class="command-shortcut">⌘R</span>
            </div>
            <div class="command-item" data-action="toggle-theme">
              <i data-lucide="sun" class="w-4 h-4"></i>
              <span>Toggle Theme</span>
              <span class="command-shortcut">⌘T</span>
            </div>
          </div>
          
          <div class="command-group">
            <div class="command-group-heading">Tools</div>
            <div class="command-item" data-action="image-converter">
              <i data-lucide="image" class="w-4 h-4"></i>
              <span>Image Converter</span>
              <span class="command-shortcut">⌘1</span>
            </div>
            <div class="command-item" data-action="background-remover">
              <i data-lucide="scissors" class="w-4 h-4"></i>
              <span>Background Remover</span>
              <span class="command-shortcut">⌘2</span>
            </div>
            <div class="command-item" data-action="google-ads-rsa">
              <i data-lucide="bar-chart-3" class="w-4 h-4"></i>
              <span>Google Ads RSA Preview</span>
              <span class="command-shortcut">⌘3</span>
            </div>
            <div class="command-item" data-action="campaign-structure">
              <i data-lucide="layers" class="w-4 h-4"></i>
              <span>Campaign Structure</span>
              <span class="command-shortcut">⌘4</span>
            </div>
            <div class="command-item" data-action="json-formatter">
              <i data-lucide="braces" class="w-4 h-4"></i>
              <span>JSON Formatter</span>
              <span class="command-shortcut">⌘5</span>
            </div>
            <div class="command-item" data-action="pdf-merger">
              <i data-lucide="file-text" class="w-4 h-4"></i>
              <span>PDF Merger</span>
              <span class="command-shortcut">⌘6</span>
            </div>
            <div class="command-item" data-action="utm-builder">
              <i data-lucide="link" class="w-4 h-4"></i>
              <span>UTM Builder</span>
            </div>
            <div class="command-item" data-action="qr-generator">
              <i data-lucide="qr-code" class="w-4 h-4"></i>
              <span>QR Code Generator</span>
            </div>
            <div class="command-item" data-action="uuid-generator">
              <i data-lucide="hash" class="w-4 h-4"></i>
              <span>UUID Generator</span>
            </div>
          </div>
          
          <div class="command-group">
            <div class="command-group-heading">Navigation</div>
            <div class="command-item" data-action="toggle-sidebar">
              <i data-lucide="menu" class="w-4 h-4"></i>
              <span>Toggle Sidebar</span>
              <span class="command-shortcut">⌘B</span>
            </div>
            <div class="command-item" data-action="go-home">
              <i data-lucide="home" class="w-4 h-4"></i>
              <span>Go to Home</span>
              <span class="command-shortcut">⌘H</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // Insert command menu after sidebar
    document.body.insertAdjacentHTML('afterbegin', commandMenuHTML);
  }

  bindEvents() {
    // Sidebar functionality
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const sidebar = document.getElementById('sidebar');
    const sidebarClose = document.getElementById('sidebar-close');

    if (sidebarToggle && sidebar && sidebarOverlay && sidebarClose) {
      const openSidebar = () => {
        sidebar.classList.add('open');
        sidebarOverlay.classList.add('open');
      };

      const closeSidebar = () => {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('open');
      };

      sidebarToggle.addEventListener('click', openSidebar);
      sidebarClose.addEventListener('click', closeSidebar);
      sidebarOverlay.addEventListener('click', closeSidebar);
    }

    // Command menu functionality
    const commandDialog = document.getElementById('command-dialog');
    const commandInput = document.getElementById('command-input');
    const commandClose = document.getElementById('command-close');
    const commandItems = document.querySelectorAll('.command-item');
    const searchButton = document.getElementById('search-button');

    if (commandDialog && commandInput && commandClose) {
      const openCommandMenu = () => {
        commandDialog.classList.add('open');
        commandInput.focus();
        commandInput.select();
      };

      const closeCommandMenu = () => {
        commandDialog.classList.remove('open');
        commandInput.value = '';
      };

      if (searchButton) {
        searchButton.addEventListener('click', openCommandMenu);
      }

      commandClose.addEventListener('click', closeCommandMenu);

      // Command actions
      const handleCommandAction = (action) => {
        closeCommandMenu();
        
        switch(action) {
          case 'explore-tools':
            const toolsSection = document.querySelector('#tools-section, .search-section');
            if (toolsSection) {
              toolsSection.scrollIntoView({ behavior: 'smooth' });
            }
            break;
          case 'request-tool':
            window.location.href = '/tools/request-tool/index.html';
            break;
          case 'toggle-theme':
            this.toggleTheme();
            break;
          case 'toggle-sidebar':
            if (sidebar && sidebar.classList.contains('open')) {
              sidebar.classList.remove('open');
              sidebarOverlay.classList.remove('open');
            } else if (sidebar) {
              sidebar.classList.add('open');
              sidebarOverlay.classList.add('open');
            }
            break;
          case 'go-home':
            window.scrollTo({ top: 0, behavior: 'smooth' });
            break;
          case 'image-converter':
            window.location.href = '/tools/image-converter/index.html';
            break;
          case 'background-remover':
            window.location.href = '/tools/background-remover/index.html';
            break;
          case 'google-ads-rsa':
            window.location.href = '/tools/google-ads-rsa-preview/index.html';
            break;
          case 'campaign-structure':
            window.location.href = '/tools/campaign-structure/index.html';
            break;
          case 'json-formatter':
            window.location.href = '/tools/json-formatter/index.html';
            break;
          case 'pdf-merger':
            window.location.href = '/tools/pdf-merger/index.html';
            break;
          case 'utm-builder':
            window.location.href = '/tools/utm-builder/index.html';
            break;
          case 'qr-generator':
            window.location.href = '/tools/qr-generator/index.html';
            break;
          case 'uuid-generator':
            window.location.href = '/tools/uuid-generator/index.html';
            break;
          default:
            console.log('Unknown action:', action);
        }
      };

      commandItems.forEach(item => {
        item.addEventListener('click', () => {
          const action = item.getAttribute('data-action');
          handleCommandAction(action);
        });
      });

      // Keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault();
          openCommandMenu();
        } else if (e.key === 'Escape') {
          if (commandDialog.classList.contains('open')) {
            closeCommandMenu();
          } else if (sidebar && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('open');
          }
        } else if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
          e.preventDefault();
          if (sidebar && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('open');
          } else if (sidebar) {
            sidebar.classList.add('open');
            sidebarOverlay.classList.add('open');
          }
        } else if ((e.metaKey || e.ctrlKey) && e.key === 't') {
          e.preventDefault();
          this.toggleTheme();
        }
      });
    }

    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => this.toggleTheme());
    }

    // Sidebar search
    const toolSearchInput = document.getElementById('tool-search');
    if (toolSearchInput) {
      const sidebarMenuItems = document.querySelectorAll('.sidebar-menu-item');
      
      toolSearchInput.addEventListener('input', () => {
        const searchTerm = toolSearchInput.value.toLowerCase();
        
        sidebarMenuItems.forEach(item => {
          const toolName = item.querySelector('span').textContent.toLowerCase();
          const toolIcon = item.querySelector('i');
          
          if (toolName.includes(searchTerm)) {
            item.style.display = 'block';
            if (searchTerm && toolIcon) {
              toolIcon.style.color = 'hsl(var(--primary))';
            }
          } else {
            item.style.display = 'none';
            if (toolIcon) {
              toolIcon.style.color = '';
            }
          }
        });
        
        // Show/hide group labels based on visible items
        const sidebarGroups = document.querySelectorAll('.sidebar-group');
        sidebarGroups.forEach(group => {
          const visibleItems = group.querySelectorAll('.sidebar-menu-item[style="display: block"]');
          const groupLabel = group.querySelector('.sidebar-group-label');
          
          if (visibleItems.length === 0 && searchTerm) {
            groupLabel.style.display = 'none';
          } else {
            groupLabel.style.display = 'block';
          }
        });
      });
    }
  }

  toggleTheme() {
    const html = document.documentElement;
    const themeToggleIcon = document.getElementById('theme-toggle-icon');
    
    if (html.classList.contains('dark')) {
      html.classList.remove('dark');
      if (themeToggleIcon) {
        themeToggleIcon.setAttribute('data-lucide', 'moon');
      }
    } else {
      html.classList.add('dark');
      if (themeToggleIcon) {
        themeToggleIcon.setAttribute('data-lucide', 'sun');
      }
    }
    
    // Recreate icons after theme change
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  initializeIcons() {
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }
}

// Initialize navigation when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new UniversalNavigation();
});