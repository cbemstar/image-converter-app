/**
 * Auto Navigation - Automatically adds navigation to pages that don't have it
 * This ensures all pages have consistent navigation and authentication
 */

(function() {
  'use strict';

  // Check if navigation already exists
  if (document.querySelector('nav')) {
    return; // Navigation already exists, don't add another
  }

  // Don't add navigation to auth page (it's standalone)
  if (window.location.pathname.includes('auth.html')) {
    return;
  }

  // Create navigation HTML
  const navHTML = `
    <nav class="bg-background shadow-md border-b border-border">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex items-center gap-4">
            <button id="sidebar-toggle" class="btn btn-outline btn-sm" aria-label="Open sidebar" style="display: none;">
              <i class="fas fa-bars"></i>
            </button>
            <a href="/" class="flex items-center gap-2">
              <span class="text-foreground text-xl font-bold">reformately</span>
            </a>
          </div>
          <div class="flex items-center gap-2">
            <!-- Auth elements will be added by unified-navigation.js -->
            <button id="theme-toggle" class="btn btn-outline btn-sm" aria-label="Toggle theme">
              <span id="theme-toggle-icon">🌙</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  `;

  // Add navigation to the page
  document.addEventListener('DOMContentLoaded', function() {
    // Insert navigation at the beginning of body
    document.body.insertAdjacentHTML('afterbegin', navHTML);

    // Initialize theme toggle
    initializeThemeToggle();
  });

  function initializeThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-toggle-icon');
    
    if (!themeToggle || !themeIcon) return;

    // Set initial theme icon
    const currentTheme = localStorage.getItem('theme') || 'dark';
    themeIcon.textContent = currentTheme === 'dark' ? '🌙' : '☀️';

    themeToggle.addEventListener('click', function() {
      const html = document.documentElement;
      const currentTheme = html.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      
      html.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      themeIcon.textContent = newTheme === 'dark' ? '🌙' : '☀️';
    });
  }
})();