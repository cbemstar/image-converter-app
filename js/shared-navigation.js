/**
 * Shared Navigation Component
 * Provides consistent navigation and authentication UI across all pages
 */

class SharedNavigation {
  constructor() {
    this.isInitialized = false;
    this.init();
  }

  async init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  async setup() {
    // Wait for auth manager to be available
    await this.waitForAuthManager();
    
    // Add navigation to page if it doesn't exist
    this.ensureNavigation();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Initialize auth state
    this.updateAuthUI();
    
    this.isInitialized = true;
  }

  async waitForAuthManager() {
    return new Promise((resolve) => {
      const checkAuthManager = () => {
        if (window.authManager) {
          resolve();
        } else {
          setTimeout(checkAuthManager, 100);
        }
      };
      checkAuthManager();
    });
  }

  ensureNavigation() {
    // Check if navigation already exists
    const existingNav = document.querySelector('nav[role="navigation"]');
    if (existingNav) {
      // Navigation exists, just ensure auth elements are present
      this.ensureAuthElements(existingNav);
      return;
    }

    // Create navigation if it doesn't exist
    this.createNavigation();
  }

  ensureAuthElements(nav) {
    // Check if auth elements exist in the navigation
    const authElements = nav.querySelector('[data-auth-required], [data-guest-only]');
    if (!authElements) {
      // Add auth elements to existing navigation
      const navRight = nav.querySelector('.flex.items-center.gap-2') || 
                      nav.querySelector('.navbar-end') ||
                      this.createNavRight(nav);
      
      this.addAuthElements(navRight);
    }
  }

  createNavRight(nav) {
    const navContainer = nav.querySelector('.max-w-7xl') || nav.querySelector('.container') || nav;
    const flexContainer = navContainer.querySelector('.flex') || navContainer;
    
    const navRight = document.createElement('div');
    navRight.className = 'flex items-center gap-2';
    flexContainer.appendChild(navRight);
    
    return navRight;
  }

  createNavigation() {
    const nav = document.createElement('nav');
    nav.className = 'bg-background shadow-md border-b border-border';
    nav.setAttribute('role', 'navigation');
    nav.setAttribute('aria-label', 'Main navigation');
    
    nav.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex items-center gap-4">
            <button id="sidebar-toggle" class="btn btn-outline btn-sm" aria-label="Open sidebar" aria-controls="sidebar" aria-expanded="false">
              <i class="fas fa-bars"></i>
            </button>
            <a href="/" class="flex items-center gap-2">
              <span class="text-foreground text-xl font-bold">reformately</span>
            </a>
          </div>
          <div class="flex items-center gap-2" id="nav-right">
          </div>
        </div>
      </div>
    `;

    // Insert navigation at the top of the body
    document.body.insertBefore(nav, document.body.firstChild);
    
    // Add auth elements
    const navRight = nav.querySelector('#nav-right');
    this.addAuthElements(navRight);
  }

  addAuthElements(container) {
    // Clear existing auth elements
    const existingAuth = container.querySelectorAll('[data-auth-required], [data-guest-only]');
    existingAuth.forEach(el => el.remove());

    // Add guest-only elements
    const guestElements = document.createElement('div');
    guestElements.setAttribute('data-guest-only', '');
    guestElements.className = 'flex items-center gap-2';
    // Determine correct path to auth.html
    const pathDepth = window.location.pathname.split('/').length - 2;
    const basePath = '../'.repeat(Math.max(0, pathDepth - 1));
    
    guestElements.innerHTML = `
      <a href="${basePath}auth.html" class="btn btn-outline btn-sm">
        <i class="fas fa-sign-in-alt mr-1"></i>
        Sign In
      </a>
    `;

    // Add authenticated user elements
    const authElements = document.createElement('div');
    authElements.setAttribute('data-auth-required', '');
    authElements.className = 'flex items-center gap-2';
    authElements.style.display = 'none';
    authElements.innerHTML = `
      <div class="dropdown dropdown-end">
        <button class="btn btn-outline btn-sm" aria-label="User menu" tabindex="0">
          <img data-user-info="avatar" class="w-6 h-6 rounded-full mr-2" alt="User avatar">
          <span data-user-info="name" class="hidden sm:inline"></span>
          <i class="fas fa-chevron-down ml-1"></i>
        </button>
        <ul class="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52 z-50" tabindex="0">
          <li><a href="${basePath}dashboard.html"><i class="fas fa-tachometer-alt mr-2"></i>Dashboard</a></li>
          <li><a href="${basePath}profile.html"><i class="fas fa-user mr-2"></i>Profile</a></li>
          <li><a href="#" id="nav-signout-btn"><i class="fas fa-sign-out-alt mr-2"></i>Sign Out</a></li>
        </ul>
      </div>
    `;

    // Add theme toggle if it doesn't exist
    let themeToggle = container.querySelector('#theme-toggle');
    if (!themeToggle) {
      themeToggle = document.createElement('button');
      themeToggle.id = 'theme-toggle';
      themeToggle.className = 'btn btn-outline btn-sm';
      themeToggle.setAttribute('aria-label', 'Toggle theme');
      themeToggle.innerHTML = '<span id="theme-toggle-icon">🌙</span>';
    }

    // Append elements
    container.appendChild(guestElements);
    container.appendChild(authElements);
    container.appendChild(themeToggle);
  }

  setupEventListeners() {
    // Handle sign out
    document.addEventListener('click', async (e) => {
      if (e.target.id === 'nav-signout-btn' || e.target.closest('#nav-signout-btn')) {
        e.preventDefault();
        if (window.authManager) {
          try {
            await window.authManager.signOut();
          } catch (error) {
            console.error('Sign out error:', error);
          }
        }
      }
    });

    // Listen for auth state changes
    if (window.authManager) {
      window.authManager.addAuthStateListener((event, session) => {
        this.updateAuthUI();
      });
    }

    // Handle dropdown clicks (for accessibility)
    document.addEventListener('click', (e) => {
      const dropdown = e.target.closest('.dropdown');
      if (dropdown) {
        const content = dropdown.querySelector('.dropdown-content');
        if (content) {
          // Toggle dropdown visibility
          const isVisible = content.style.display !== 'none';
          content.style.display = isVisible ? 'none' : 'block';
        }
      } else {
        // Close all dropdowns when clicking outside
        document.querySelectorAll('.dropdown-content').forEach(content => {
          content.style.display = 'none';
        });
      }
    });

    // Handle keyboard navigation for dropdowns
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.dropdown-content').forEach(content => {
          content.style.display = 'none';
        });
      }
    });
  }

  updateAuthUI() {
    if (!window.authManager) return;

    const isAuthenticated = window.authManager.isAuthenticated();
    const user = window.authManager.getCurrentUser();

    // Update visibility of auth elements
    const authRequiredElements = document.querySelectorAll('[data-auth-required]');
    const guestOnlyElements = document.querySelectorAll('[data-guest-only]');

    authRequiredElements.forEach(element => {
      if (isAuthenticated) {
        element.style.display = element.dataset.authDisplay || 'flex';
        element.classList.remove('hidden');
      } else {
        element.style.display = 'none';
        element.classList.add('hidden');
      }
    });

    guestOnlyElements.forEach(element => {
      if (isAuthenticated) {
        element.style.display = 'none';
        element.classList.add('hidden');
      } else {
        element.style.display = element.dataset.guestDisplay || 'flex';
        element.classList.remove('hidden');
      }
    });

    // Update user info elements
    if (isAuthenticated && user) {
      this.updateUserInfoElements(user);
    }
  }

  updateUserInfoElements(user) {
    const userInfoElements = document.querySelectorAll('[data-user-info]');
    
    userInfoElements.forEach(element => {
      const infoType = element.dataset.userInfo;
      
      switch (infoType) {
        case 'email':
          element.textContent = user.email;
          break;
        case 'name':
          const name = user.user_metadata?.full_name || user.email.split('@')[0];
          element.textContent = name;
          break;
        case 'avatar':
          if (element.tagName === 'IMG') {
            element.src = user.user_metadata?.avatar_url || 
                         this.generateAvatarUrl(user.email);
          }
          break;
        case 'initials':
          const displayName = user.user_metadata?.full_name || user.email;
          element.textContent = this.getInitials(displayName);
          break;
      }
    });
  }

  generateAvatarUrl(email) {
    const name = encodeURIComponent(email);
    return `https://ui-avatars.com/api/?name=${name}&background=3b82f6&color=fff&size=40`;
  }

  getInitials(nameOrEmail) {
    if (nameOrEmail.includes('@')) {
      return nameOrEmail.charAt(0).toUpperCase();
    }
    
    return nameOrEmail
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  /**
   * Add navigation to a page that doesn't have it
   */
  static addToPage() {
    if (!window.sharedNavigation) {
      window.sharedNavigation = new SharedNavigation();
    }
  }

  /**
   * Ensure navigation is present and up to date
   */
  static ensure() {
    if (window.sharedNavigation && window.sharedNavigation.isInitialized) {
      window.sharedNavigation.updateAuthUI();
    } else {
      SharedNavigation.addToPage();
    }
  }
}

// Auto-initialize on pages that include this script
if (typeof window !== 'undefined') {
  window.SharedNavigation = SharedNavigation;
  
  // Initialize immediately
  window.sharedNavigation = new SharedNavigation();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SharedNavigation;
}