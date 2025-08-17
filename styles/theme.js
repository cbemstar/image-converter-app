function setTheme(theme) {
  try {
    // Validate theme value
    if (theme !== 'light' && theme !== 'dark') {
      console.error(`Invalid theme value: ${theme}. Using 'dark' as fallback.`);
      theme = 'dark';
    }
    
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    // Update all theme toggle icons on the page
    const icons = document.querySelectorAll('#theme-toggle-icon');
    icons.forEach(icon => {
      // Only update if the icon doesn't have the correct icon already
      const currentIcon = icon.getAttribute('data-lucide');
      const expectedIcon = theme === 'dark' ? 'sun' : 'moon';
      
      if (currentIcon !== expectedIcon) {
        // Remove existing Lucide icon and create new one
        icon.innerHTML = '';
        icon.setAttribute('data-lucide', expectedIcon);
        // Recreate the icon
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
          lucide.createIcons();
        }
      }
    });
    
    // Update button aria-label for accessibility
    const toggles = document.querySelectorAll('#theme-toggle');
    toggles.forEach(toggle => {
      toggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
    });
    
    // Dispatch custom event for theme change
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
    
    console.log(`Theme changed to: ${theme}`);
  } catch (error) {
    console.error('Error setting theme:', error);
  }
}

function getPreferredTheme() {
  const stored = localStorage.getItem('theme');
  if (stored) return stored;
  
  // Check system preference if no stored theme
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  
  // Default to dark theme
  return 'dark';
}

function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || getPreferredTheme();
}

function handleThemeToggle(event) {
  if (event) {
    event.preventDefault();
  }
  
  const current = getCurrentTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
}

function initializeThemeToggle() {
  const currentTheme = getCurrentTheme();
  
  // Update all theme toggle icons to reflect current state
  const icons = document.querySelectorAll('#theme-toggle-icon');
  icons.forEach(icon => {
    // Only update if the icon doesn't have the correct icon already
    const currentIcon = icon.getAttribute('data-lucide');
    const expectedIcon = currentTheme === 'dark' ? 'sun' : 'moon';
    
    if (currentIcon !== expectedIcon) {
      // Remove existing content and set appropriate Lucide icon
      icon.innerHTML = '';
      icon.setAttribute('data-lucide', expectedIcon);
    }
  });
  
  // Ensure Lucide icons are created after setting the data-lucide attribute
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
  
  // Add click handlers to all theme toggles
  const toggles = document.querySelectorAll('#theme-toggle');
  toggles.forEach(toggle => {
    // Check if already has event listener to prevent duplicates
    if (!toggle.hasAttribute('data-theme-initialized')) {
      toggle.setAttribute('data-theme-initialized', 'true');
      toggle.addEventListener('click', handleThemeToggle);
      
      // Also add keyboard support
      toggle.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleThemeToggle(event);
        }
      });
    }
  });
  
  console.log(`Theme toggle initialized with theme: ${currentTheme}`);
}

function initializeTheme() {
  // Set initial theme
  const preferred = getPreferredTheme();
  document.documentElement.setAttribute('data-theme', preferred);
  
  // Initialize theme toggle functionality
  initializeThemeToggle();
  
  // Listen for system theme changes
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      // Only update if no theme is stored (user hasn't made a choice)
      if (!localStorage.getItem('theme')) {
        const newTheme = e.matches ? 'dark' : 'light';
        setTheme(newTheme);
      }
    });
  }
}

// Initialize theme immediately if possible
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeTheme);
} else {
  // DOM is already loaded
  initializeTheme();
}

// Also set up a fallback initialization for different browsers
document.addEventListener('DOMContentLoaded', () => {
  // Re-initialize if elements weren't found before
  const toggles = document.querySelectorAll('#theme-toggle');
  if (toggles.length > 0) {
    initializeThemeToggle();
  }
});

// Additional fallback for browsers that might load scripts differently
window.addEventListener('load', () => {
  // Final fallback initialization
  setTimeout(() => {
    const toggles = document.querySelectorAll('#theme-toggle');
    if (toggles.length > 0) {
      toggles.forEach(toggle => {
        if (!toggle.hasAttribute('data-theme-initialized')) {
          initializeThemeToggle();
        }
      });
    }
  }, 100);
});

// Export functions for global use
window.setTheme = setTheme;
window.getPreferredTheme = getPreferredTheme;
window.getCurrentTheme = getCurrentTheme;
window.initializeThemeToggle = initializeThemeToggle;

