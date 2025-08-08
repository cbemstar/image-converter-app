/**
 * Navigation Component - Reusable navigation system
 * Can be included in any page to provide consistent navigation
 */

class Navigation {
  constructor(options = {}) {
    this.options = {
      showBreadcrumbs: options.showBreadcrumbs !== false,
      showUserMenu: options.showUserMenu !== false,
      brand: options.brand || 'ImageTools',
      brandIcon: options.brandIcon || 'fas fa-image',
      ...options
    };
    
    this.authManager = null;
    this.isInitialized = false;
    
    this.init();
  }

  async init() {
    await this.waitForAuthManager();
    this.createNavigation();
    this.setupEventListeners();
    this.updateAuthUI();
    
    if (this.options.showBreadcrumbs) {
      this.setupBreadcrumbs();
    }
    
    // Listen for auth state changes
    if (this.authManager) {
      this.authManager.addAuthStateListener(() => {
        this.updateAuthUI();
      });
    }
    
    this.isInitialized = true;
  }

  async waitForAuthManager() {
    return new Promise((resolve) => {
      const check = () => {
        if (window.authManager) {
          this.authManager = window.authManager;
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  createNavigation() {
    // Check if navigation already exists
    if (document.querySelector('.main-nav')) return;

    const navHTML = `
      <nav class="main-nav">
        <div class="nav-container">
          <div class="nav-content">
            <!-- Brand -->
            <a href="/" class="nav-brand">
              <div class="nav-brand-icon">
                <i class="${this.options.brandIcon}"></i>
              </div>
              <span>${this.options.brand}</span>
            </a>

            <!-- Desktop Menu -->
            <ul class="nav-menu" id="navMenu">
              <!-- Tools Dropdown -->
              <li class="nav-item">
                <a href="#" class="nav-link">
                  <i class="fas fa-tools"></i>
                  Tools
                  <i class="fas fa-chevron-down text-xs"></i>
                </a>
                <div class="nav-dropdown">
                  <a href="/tools/image-converter/index.html" class="nav-dropdown-item">
                    <i class="fas fa-image mr-2"></i>
                    Image Converter
                  </a>
                  <a href="/tools/pdf-merger/index.html" class="nav-dropdown-item">
                    <i class="fas fa-file-pdf mr-2"></i>
                    PDF Merger
                  </a>
                  <a href="/tools/background-remover/index.html" class="nav-dropdown-item">
                    <i class="fas fa-cut mr-2"></i>
                    Background Remover
                  </a>
                  <a href="/tools/qr-generator/index.html" class="nav-dropdown-item">
                    <i class="fas fa-qrcode mr-2"></i>
                    QR Generator
                  </a>
                  <a href="/tools/text-case-converter/index.html" class="nav-dropdown-item">
                    <i class="fas fa-font mr-2"></i>
                    Text Case Converter
                  </a>
                  <a href="/tools/uuid-generator/index.html" class="nav-dropdown-item">
                    <i class="fas fa-fingerprint mr-2"></i>
                    UUID Generator
                  </a>
                </div>
              </li>

              <!-- Pricing -->
              <li class="nav-item">
                <a href="/pricing.html" class="nav-link">
                  <i class="fas fa-crown"></i>
                  Pricing
                </a>
              </li>

              <!-- User Section -->
              ${this.options.showUserMenu ? this.createUserMenu() : ''}
            </ul>

            <!-- Mobile Menu Button -->
            <button class="mobile-menu-btn" id="mobileMenuBtn">
              <i class="fas fa-bars"></i>
            </button>
          </div>
        </div>
      </nav>
    `;

    // Add navigation to page
    document.body.insertAdjacentHTML('afterbegin', navHTML);

    // Add styles
    this.addNavigationStyles();
  }

  createUserMenu() {
    return `
      <li class="nav-item nav-user">
        <!-- Authenticated User -->
        <div class="nav-user-info" data-auth-required style="display: none;">
          <img id="navAvatar" class="nav-avatar" src="" alt="User">
          <span id="navUserName">User</span>
          <div class="nav-dropdown">
            <a href="/dashboard.html" class="nav-dropdown-item">
              <i class="fas fa-tachometer-alt mr-2"></i>
              Dashboard
            </a>
            <a href="/profile.html" class="nav-dropdown-item">
              <i class="fas fa-user mr-2"></i>
              Profile
            </a>
            <a href="/analytics.html" class="nav-dropdown-item">
              <i class="fas fa-chart-bar mr-2"></i>
              Analytics
            </a>
            <a href="#" class="nav-dropdown-item" id="navSignOut">
              <i class="fas fa-sign-out-alt mr-2"></i>
              Sign Out
            </a>
          </div>
        </div>

        <!-- Guest User -->
        <div class="nav-auth-buttons" data-guest-only>
          <a href="/auth.html" class="nav-btn nav-btn-secondary">
            <i class="fas fa-sign-in-alt"></i>
            Sign In
          </a>
          <a href="/auth.html" class="nav-btn nav-btn-primary">
            <i class="fas fa-user-plus"></i>
            Sign Up
          </a>
        </div>
      </li>
    `;
  }

  addNavigationStyles() {
    if (document.getElementById('navigation-styles')) return;

    const styles = `
      <style id="navigation-styles">
        .main-nav {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          position: sticky;
          top: 0;
          z-index: 1000;
        }

        .nav-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px;
        }

        .nav-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 70px;
        }

        .nav-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          color: white;
          text-decoration: none;
          font-size: 20px;
          font-weight: 700;
        }

        .nav-brand:hover {
          color: rgba(255, 255, 255, 0.9);
        }

        .nav-brand-icon {
          width: 32px;
          height: 32px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .nav-menu {
          display: flex;
          align-items: center;
          gap: 8px;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .nav-item {
          position: relative;
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          color: rgba(255, 255, 255, 0.9);
          text-decoration: none;
          border-radius: 6px;
          transition: all 0.2s;
          font-weight: 500;
        }

        .nav-link:hover {
          background: rgba(255, 255, 255, 0.1);
          color: white;
        }

        .nav-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          min-width: 200px;
          opacity: 0;
          visibility: hidden;
          transform: translateY(-10px);
          transition: all 0.2s;
          z-index: 1000;
        }

        .nav-item:hover .nav-dropdown {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
        }

        .nav-dropdown-item {
          display: block;
          padding: 12px 16px;
          color: #374151;
          text-decoration: none;
          border-bottom: 1px solid #f3f4f6;
          transition: background-color 0.2s;
        }

        .nav-dropdown-item:hover {
          background: #f8fafc;
        }

        .nav-dropdown-item:last-child {
          border-bottom: none;
        }

        .nav-user {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .nav-user-info {
          display: flex;
          align-items: center;
          gap: 8px;
          color: white;
        }

        .nav-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.3);
        }

        .nav-auth-buttons {
          display: flex;
          gap: 8px;
        }

        .nav-btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 14px;
        }

        .nav-btn-primary {
          background: white;
          color: #3b82f6;
        }

        .nav-btn-primary:hover {
          background: rgba(255, 255, 255, 0.9);
        }

        .nav-btn-secondary {
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.3);
        }

        .nav-btn-secondary:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .mobile-menu-btn {
          display: none;
          background: none;
          border: none;
          color: white;
          font-size: 20px;
          cursor: pointer;
          padding: 8px;
        }

        .breadcrumb {
          background: #f8fafc;
          padding: 12px 0;
          border-bottom: 1px solid #e5e7eb;
        }

        .breadcrumb-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px;
        }

        .breadcrumb-nav {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
        }

        .breadcrumb-item {
          color: #6b7280;
          text-decoration: none;
        }

        .breadcrumb-item:hover {
          color: #3b82f6;
        }

        .breadcrumb-item.active {
          color: #1f2937;
          font-weight: 500;
        }

        .breadcrumb-separator {
          color: #9ca3af;
        }

        /* Mobile Responsive */
        @media (max-width: 768px) {
          .mobile-menu-btn {
            display: block;
          }

          .nav-menu {
            display: none;
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            flex-direction: column;
            padding: 20px;
            gap: 4px;
          }

          .nav-menu.show {
            display: flex;
          }

          .nav-link {
            width: 100%;
            justify-content: flex-start;
          }

          .nav-dropdown {
            position: static;
            opacity: 1;
            visibility: visible;
            transform: none;
            box-shadow: none;
            background: rgba(255, 255, 255, 0.1);
            margin-top: 8px;
          }

          .nav-dropdown-item {
            color: rgba(255, 255, 255, 0.9);
            border-color: rgba(255, 255, 255, 0.1);
          }

          .nav-user {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
            width: 100%;
          }

          .nav-auth-buttons {
            width: 100%;
          }

          .nav-btn {
            flex: 1;
            justify-content: center;
          }
        }
      </style>
    `;

    document.head.insertAdjacentHTML('beforeend', styles);
  }

  setupEventListeners() {
    // Mobile menu toggle
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navMenu = document.getElementById('navMenu');
    
    if (mobileMenuBtn && navMenu) {
      mobileMenuBtn.addEventListener('click', () => {
        navMenu.classList.toggle('show');
        const icon = mobileMenuBtn.querySelector('i');
        icon.className = navMenu.classList.contains('show') ? 'fas fa-times' : 'fas fa-bars';
      });
    }

    // Sign out handler
    const signOutBtn = document.getElementById('navSignOut');
    if (signOutBtn) {
      signOutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (this.authManager) {
          await this.authManager.signOut();
        }
      });
    }

    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.nav-content') && navMenu?.classList.contains('show')) {
        navMenu.classList.remove('show');
        const icon = mobileMenuBtn?.querySelector('i');
        if (icon) icon.className = 'fas fa-bars';
      }
    });
  }

  updateAuthUI() {
    if (!this.authManager) return;

    const isAuthenticated = this.authManager.isAuthenticated();
    const user = this.authManager.getCurrentUser();

    // Show/hide auth elements
    const authRequired = document.querySelectorAll('[data-auth-required]');
    const guestOnly = document.querySelectorAll('[data-guest-only]');

    authRequired.forEach(el => {
      el.style.display = isAuthenticated ? 'flex' : 'none';
    });

    guestOnly.forEach(el => {
      el.style.display = isAuthenticated ? 'none' : 'flex';
    });

    // Update user info
    if (isAuthenticated && user) {
      const avatar = document.getElementById('navAvatar');
      const userName = document.getElementById('navUserName');

      if (avatar) {
        avatar.src = user.user_metadata?.avatar_url || 
                   `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}&background=3b82f6&color=fff&size=32`;
      }

      if (userName) {
        userName.textContent = user.user_metadata?.full_name || user.email.split('@')[0];
      }
    }
  }

  setupBreadcrumbs() {
    // Create breadcrumb container if it doesn't exist
    if (!document.getElementById('breadcrumb')) {
      const breadcrumbHTML = `
        <div class="breadcrumb" id="breadcrumb" style="display: none;">
          <div class="breadcrumb-container">
            <nav class="breadcrumb-nav" id="breadcrumbNav">
              <!-- Breadcrumb items will be inserted here -->
            </nav>
          </div>
        </div>
      `;
      
      const nav = document.querySelector('.main-nav');
      if (nav) {
        nav.insertAdjacentHTML('afterend', breadcrumbHTML);
      }
    }

    const path = window.location.pathname;
    const breadcrumb = document.getElementById('breadcrumb');
    const breadcrumbNav = document.getElementById('breadcrumbNav');

    if (!breadcrumb || !breadcrumbNav) return;

    // Don't show breadcrumbs on home page
    if (path === '/' || path === '/index.html') {
      breadcrumb.style.display = 'none';
      return;
    }

    const pathParts = path.split('/').filter(part => part);
    const breadcrumbs = [{ name: 'Home', url: '/' }];

    let currentPath = '';
    pathParts.forEach((part, index) => {
      currentPath += '/' + part;
      
      // Skip file extensions and convert to readable names
      let name = part.replace('.html', '').replace('-', ' ');
      name = name.charAt(0).toUpperCase() + name.slice(1);
      
      // Special cases
      if (part === 'tools') {
        name = 'Tools';
      } else if (pathParts[index - 1] === 'tools') {
        name = this.getToolDisplayName(part);
      }

      breadcrumbs.push({
        name: name,
        url: currentPath,
        active: index === pathParts.length - 1
      });
    });

    // Generate breadcrumb HTML
    breadcrumbNav.innerHTML = breadcrumbs.map((crumb, index) => {
      const isLast = index === breadcrumbs.length - 1;
      const separator = isLast ? '' : '<span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>';
      
      if (isLast) {
        return `<span class="breadcrumb-item active">${crumb.name}</span>`;
      } else {
        return `<a href="${crumb.url}" class="breadcrumb-item">${crumb.name}</a>${separator}`;
      }
    }).join('');

    breadcrumb.style.display = 'block';
  }

  getToolDisplayName(toolName) {
    const toolNames = {
      'image-converter': 'Image Converter',
      'pdf-merger': 'PDF Merger',
      'background-remover': 'Background Remover',
      'qr-generator': 'QR Generator',
      'text-case-converter': 'Text Case Converter',
      'uuid-generator': 'UUID Generator',
      'json-formatter': 'JSON Formatter',
      'timestamp-converter': 'Timestamp Converter',
      'utm-builder': 'UTM Builder',
      'color-palette': 'Color Palette',
      'meta-tag-generator': 'Meta Tag Generator',
      'robots-txt': 'Robots.txt Generator'
    };

    return toolNames[toolName] || toolName.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  // Public methods
  showBreadcrumbs() {
    this.options.showBreadcrumbs = true;
    this.setupBreadcrumbs();
  }

  hideBreadcrumbs() {
    const breadcrumb = document.getElementById('breadcrumb');
    if (breadcrumb) {
      breadcrumb.style.display = 'none';
    }
  }

  updateBrand(brand, icon) {
    const brandElement = document.querySelector('.nav-brand span');
    const iconElement = document.querySelector('.nav-brand-icon i');
    
    if (brandElement) brandElement.textContent = brand;
    if (iconElement) iconElement.className = icon;
  }
}

// Global utility function
window.initializeNavigation = function(options = {}) {
  if (!window.navigationInstance) {
    window.navigationInstance = new Navigation(options);
  }
  return window.navigationInstance;
};

// Auto-initialize navigation
if (typeof window !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.navigationInstance = new Navigation();
    });
  } else {
    window.navigationInstance = new Navigation();
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Navigation;
}