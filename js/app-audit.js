/**
 * App Audit Script - Checks for common issues and fixes them
 * Run this to identify and fix navigation, authentication, and styling issues
 */

class AppAudit {
  constructor() {
    this.issues = [];
    this.fixes = [];
    this.init();
  }

  init() {
    console.log('🔍 Starting app audit...');
    
    this.checkNavigation();
    this.checkAuthentication();
    this.checkButtonHovers();
    this.checkThemeToggle();
    this.checkResponsiveness();
    
    this.reportResults();
  }

  checkNavigation() {
    console.log('📋 Checking navigation...');
    
    // Check for duplicate navigation
    const navElements = document.querySelectorAll('nav');
    if (navElements.length > 1) {
      this.issues.push('Multiple navigation elements found');
      this.fixDuplicateNavigation();
    }

    // Check for missing navigation on non-auth pages
    if (navElements.length === 0 && !window.location.pathname.includes('auth.html')) {
      this.issues.push('Missing navigation on page');
      this.fixes.push('Auto-navigation script should add navigation');
    }

    // Check for proper navigation structure
    navElements.forEach((nav, index) => {
      const hasLogo = nav.querySelector('a[href="/"], a[href="index.html"]');
      const hasThemeToggle = nav.querySelector('#theme-toggle');
      
      if (!hasLogo) {
        this.issues.push(`Navigation ${index + 1} missing logo/home link`);
      }
      
      if (!hasThemeToggle) {
        this.issues.push(`Navigation ${index + 1} missing theme toggle`);
      }
    });
  }

  checkAuthentication() {
    console.log('🔐 Checking authentication...');
    
    // Check for auth elements
    const authRequired = document.querySelectorAll('[data-auth-required]');
    const guestOnly = document.querySelectorAll('[data-guest-only]');
    
    if (authRequired.length === 0 && guestOnly.length === 0) {
      this.issues.push('No authentication UI elements found');
      this.fixes.push('Unified navigation should add auth elements');
    }

    // Check for sign out buttons
    const signOutBtns = document.querySelectorAll('#signOutBtn, [data-action="signout"]');
    signOutBtns.forEach(btn => {
      if (!btn.onclick && !this.hasEventListener(btn, 'click')) {
        this.issues.push('Sign out button missing event listener');
        this.fixSignOutButton(btn);
      }
    });
  }

  checkButtonHovers() {
    console.log('🎨 Checking button hover states...');
    
    const buttons = document.querySelectorAll('button, .btn, #theme-toggle, #sidebar-toggle');
    let inconsistentHovers = 0;
    
    buttons.forEach(button => {
      const computedStyle = window.getComputedStyle(button);
      const transition = computedStyle.transition;
      
      if (!transition.includes('background-color')) {
        inconsistentHovers++;
      }
    });

    if (inconsistentHovers > 0) {
      this.issues.push(`${inconsistentHovers} buttons with inconsistent hover states`);
      this.fixes.push('CSS hover styles should be applied');
    }
  }

  checkThemeToggle() {
    console.log('🌙 Checking theme toggle...');
    
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-toggle-icon');
    
    if (!themeToggle) {
      this.issues.push('Theme toggle button not found');
      return;
    }

    if (!themeIcon) {
      this.issues.push('Theme toggle icon not found');
      return;
    }

    // Check if theme toggle has proper event listener
    if (!this.hasEventListener(themeToggle, 'click')) {
      this.issues.push('Theme toggle missing event listener');
      this.fixThemeToggle();
    }
  }

  checkResponsiveness() {
    console.log('📱 Checking responsiveness...');
    
    // Check for mobile menu
    const mobileMenuBtn = document.getElementById('mobile-menu-button');
    const sidebar = document.getElementById('sidebar');
    
    if (!mobileMenuBtn && !sidebar) {
      this.issues.push('No mobile navigation found');
    }

    // Check viewport meta tag
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!viewportMeta) {
      this.issues.push('Missing viewport meta tag');
    }
  }

  fixDuplicateNavigation() {
    const navElements = document.querySelectorAll('nav');
    if (navElements.length > 1) {
      // Keep the first navigation, remove others
      for (let i = 1; i < navElements.length; i++) {
        navElements[i].remove();
        this.fixes.push(`Removed duplicate navigation ${i + 1}`);
      }
    }
  }

  fixSignOutButton(btn) {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (window.authManager) {
        try {
          await window.authManager.signOut();
          this.fixes.push('Fixed sign out button event listener');
        } catch (error) {
          console.error('Sign out error:', error);
        }
      }
    });
  }

  fixThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-toggle-icon');
    
    if (!themeToggle || !themeIcon) return;

    themeToggle.addEventListener('click', () => {
      const html = document.documentElement;
      const currentTheme = html.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      
      html.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      themeIcon.textContent = newTheme === 'dark' ? '🌙' : '☀️';
      
      this.fixes.push('Fixed theme toggle functionality');
    });
  }

  hasEventListener(element, eventType) {
    // This is a simplified check - in reality, it's hard to detect event listeners
    // We'll assume if onclick is set or if the element has certain attributes
    return element.onclick !== null || 
           element.getAttribute('onclick') !== null ||
           element.hasAttribute('data-action');
  }

  reportResults() {
    console.log('\n📊 Audit Results:');
    console.log('================');
    
    if (this.issues.length === 0) {
      console.log('✅ No issues found! App looks good.');
    } else {
      console.log(`❌ Found ${this.issues.length} issues:`);
      this.issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue}`);
      });
    }

    if (this.fixes.length > 0) {
      console.log(`\n🔧 Applied ${this.fixes.length} fixes:`);
      this.fixes.forEach((fix, index) => {
        console.log(`${index + 1}. ${fix}`);
      });
    }

    console.log('\n💡 Recommendations:');
    console.log('- Ensure all pages include unified-navigation.js');
    console.log('- Use auto-navigation.js for pages without navigation');
    console.log('- Test authentication flow on all pages');
    console.log('- Verify button hover states are consistent');
    console.log('- Check mobile responsiveness');
  }

  // Public method to run audit manually
  static runAudit() {
    return new AppAudit();
  }
}

// Auto-run audit in development
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      AppAudit.runAudit();
    }, 2000); // Wait 2 seconds for everything to load
  });
}

// Make available globally
window.AppAudit = AppAudit;

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AppAudit;
}