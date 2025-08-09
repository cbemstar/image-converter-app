/**
 * Universal Navigation Component
 * Provides consistent navigation across all pages with global auth integration
 */

class UniversalNav {
  constructor() {
    this.init();
  }

  init() {
    this.createNavigation();
    this.setupEventListeners();
  }

  createNavigation() {
    // Check if navigation already exists
    if (document.querySelector('nav.universal-nav')) {
      return;
    }

    const nav = document.createElement('nav');
    nav.className = 'universal-nav bg-background shadow-md border-b border-border';
    nav.setAttribute('role', 'navigation');
    nav.setAttribute('aria-label', 'Main navigation');

    nav.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex items-center gap-4">
            <button id="sidebar-toggle" class="btn btn-outline btn-sm lg:hidden" aria-label="Open sidebar" aria-controls="sidebar" aria-expanded="false">
              <i class="fas fa-bars"></i>
            </button>
            <a href="index.html" class="flex items-center gap-2">
              <span class="text-foreground text-xl font-bold">reformately</span>
            </a>
          </div>
          <div class="flex items-center gap-2">
            <!-- Authentication Status -->
            <div data-guest-only class="flex items-center gap-2">
              <a href="auth.html" class="btn btn-outline btn-sm">
                <i class="fas fa-sign-in-alt mr-1"></i>
                Sign In
              </a>
            </div>

            <div data-auth-required class="flex items-center gap-2" style="display: none;">
              <div class="dropdown dropdown-end relative">
                <button class="btn btn-outline btn-sm dropdown-toggle" aria-label="User menu" aria-expanded="false">
                  <img data-user-info="avatar" class="w-6 h-6 rounded-full mr-2" alt="User avatar" style="display: none;">
                  <span data-user-info="name" class="hidden sm:inline">User</span>
                  <i class="fas fa-chevron-down ml-1"></i>
                </button>
                <ul class="dropdown-content menu p-2 shadow bg-background border border-border rounded-lg w-52 absolute right-0 top-full mt-1 z-50" style="display: none;">
                  <li><a href="dashboard.html" class="flex items-center gap-2 px-3 py-2 hover:bg-muted rounded"><i class="fas fa-tachometer-alt"></i>Dashboard</a></li>
                  <li><a href="analytics.html" class="flex items-center gap-2 px-3 py-2 hover:bg-muted rounded"><i class="fas fa-chart-bar"></i>Analytics</a></li>
                  <li><a href="profile.html" class="flex items-center gap-2 px-3 py-2 hover:bg-muted rounded"><i class="fas fa-user"></i>Profile</a></li>
                  <li><a href="pricing.html" class="flex items-center gap-2 px-3 py-2 hover:bg-muted rounded"><i class="fas fa-credit-card"></i>Pricing</a></li>
                  <li><hr class="my-1 border-border"></li>
                  <li><a href="#" id="signOutBtn" class="flex items-center gap-2 px-3 py-2 hover:bg-muted rounded"><i class="fas fa-sign-out-alt"></i>Sign Out</a></li>
                </ul>
              </div>
            </div>

            <button id="theme-toggle" class="btn btn-outline btn-sm" aria-label="Toggle theme">
              <span id="theme-toggle-icon">🌙</span>
            </button>
          </div>
        </div>
      </div>
    `;

    // Insert navigation at the beginning of body
    document.body.insertBefore(nav, document.body.firstChild);
  }

  setupEventListeners() {
    // Wait for DOM to be ready
    setTimeout(() => {
      this.initializeDropdown();
      this.initializeTheme();
      this.setupSignOut();
      this.setupSidebar();
    }, 100);
  }

  initializeDropdown() {
    const dropdownToggle = document.querySelector('.dropdown-toggle');
    const dropdownContent = document.querySelector('.dropdown-content');

    if (dropdownToggle && dropdownContent) {
      dropdownToggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const isOpen = dropdownContent.style.display === 'block';
        dropdownContent.style.display = isOpen ? 'none' : 'block';
        dropdownToggle.setAttribute('aria-expanded', !isOpen);
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!dropdownToggle.contains(e.target) && !dropdownContent.contains(e.target)) {
          dropdownContent.style.display = 'none';
          dropdownToggle.setAttribute('aria-expanded', 'false');
        }
      });
    }
  }

  initializeTheme() {
    if (window.initializeThemeToggle) {
      window.initializeThemeToggle();
    } else {
      setTimeout(() => {
        if (window.initializeThemeToggle) {
          window.initializeThemeToggle();
        }
      }, 100);
    }
  }

  setupSignOut() {
    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) {
      signOutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          if (window.globalAuth) {
            await window.globalAuth.signOut();
            setTimeout(() => window.location.href = 'index.html', 1000);
          }
        } catch (error) {
          console.error('Sign out error:', error);
        }
      });
    }
  }

  setupSidebar() {
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const sidebarClose = document.getElementById('sidebar-close');

    if (sidebarToggle && sidebar && sidebarOverlay) {
      sidebarToggle.addEventListener('click', () => {
        sidebar.classList.remove('-translate-x-full');
        sidebarOverlay.classList.remove('hidden');
        sidebarToggle.setAttribute('aria-expanded', 'true');
      });

      const closeSidebar = () => {
        sidebar.classList.add('-translate-x-full');
        sidebarOverlay.classList.add('hidden');
        sidebarToggle.setAttribute('aria-expanded', 'false');
      };

      if (sidebarClose) {
        sidebarClose.addEventListener('click', closeSidebar);
      }

      sidebarOverlay.addEventListener('click', closeSidebar);
    }
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.universalNav = new UniversalNav();
  });
} else {
  window.universalNav = new UniversalNav();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UniversalNav;
}