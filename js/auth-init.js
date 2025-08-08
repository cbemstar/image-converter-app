/**
 * Authentication Initialization Script
 * Include this script in any page to add authentication functionality
 * This script will automatically add navigation and auth features
 */

(function() {
  'use strict';

  // Check if already initialized
  if (window.authInitialized) {
    return;
  }

  // Load required scripts
  function loadScript(src, callback) {
    const script = document.createElement('script');
    script.src = src;
    script.onload = callback;
    script.onerror = () => console.error(`Failed to load script: ${src}`);
    document.head.appendChild(script);
  }

  // Load CSS if needed
  function loadCSS(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  // Initialize authentication system
  function initializeAuth() {
    // Determine the correct path to JS files based on current location
    const pathDepth = window.location.pathname.split('/').length - 2; // -2 for empty string and filename
    const basePath = '../'.repeat(Math.max(0, pathDepth - 1));
    
    // Load required scripts in sequence
    const scripts = [
      'https://unpkg.com/@supabase/supabase-js@2',
      `${basePath}js/supabase-config.js`,
      `${basePath}js/config.js`,
      `${basePath}js/supabase-client.js`,
      `${basePath}js/auth-manager.js`,
      `${basePath}js/auth-modal.js`,
      `${basePath}js/auth-guards.js`,
      `${basePath}js/shared-navigation.js`
    ];

    let loadedCount = 0;
    
    function loadNext() {
      if (loadedCount >= scripts.length) {
        // All scripts loaded, initialize
        setTimeout(finalizeInit, 100);
        return;
      }

      loadScript(scripts[loadedCount], () => {
        loadedCount++;
        loadNext();
      });
    }

    loadNext();
  }

  // Finalize initialization
  function finalizeInit() {
    // Ensure shared navigation is added
    if (window.SharedNavigation) {
      window.SharedNavigation.ensure();
    }

    // Mark as initialized
    window.authInitialized = true;

    // Dispatch event for other scripts to listen to
    window.dispatchEvent(new CustomEvent('auth-initialized'));
  }

  // Add basic styles for authentication elements
  function addBasicStyles() {
    const styles = `
      <style id="auth-init-styles">
        /* Basic dropdown styles */
        .dropdown {
          position: relative;
          display: inline-block;
        }
        
        .dropdown-content {
          display: none;
          position: absolute;
          right: 0;
          background-color: white;
          min-width: 200px;
          box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
          border-radius: 8px;
          z-index: 1000;
          border: 1px solid #e5e7eb;
        }
        
        .dropdown-content.show {
          display: block;
        }
        
        .menu {
          list-style: none;
          padding: 8px 0;
          margin: 0;
        }
        
        .menu li {
          margin: 0;
        }
        
        .menu li a {
          display: flex;
          align-items: center;
          padding: 8px 16px;
          text-decoration: none;
          color: #374151;
          transition: background-color 0.2s;
        }
        
        .menu li a:hover {
          background-color: #f3f4f6;
        }
        
        .menu li a i {
          margin-right: 8px;
          width: 16px;
        }
        
        /* Button styles */
        .btn {
          display: inline-flex;
          align-items: center;
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: 500;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid transparent;
        }
        
        .btn-outline {
          border-color: #d1d5db;
          background: transparent;
          color: #374151;
        }
        
        .btn-outline:hover {
          background: #f3f4f6;
          border-color: #9ca3af;
        }
        
        .btn-sm {
          padding: 6px 12px;
          font-size: 14px;
        }
        
        /* Hidden utility */
        .hidden {
          display: none !important;
        }
        
        /* Avatar styles */
        .rounded-full {
          border-radius: 50%;
        }
        
        /* Responsive utilities */
        @media (max-width: 640px) {
          .sm\\:inline {
            display: none;
          }
        }
        
        @media (min-width: 641px) {
          .sm\\:inline {
            display: inline;
          }
        }
      </style>
    `;

    if (!document.getElementById('auth-init-styles')) {
      document.head.insertAdjacentHTML('beforeend', styles);
    }
  }

  // Add Font Awesome if not present
  function ensureFontAwesome() {
    if (document.querySelector('link[href*="font-awesome"]')) return;
    
    loadCSS('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css');
  }

  // Start initialization when DOM is ready
  function start() {
    addBasicStyles();
    ensureFontAwesome();
    initializeAuth();
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

})();