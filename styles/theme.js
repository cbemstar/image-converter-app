function setTheme(theme) {
  // Support both data-theme attribute and class-based theming
  document.documentElement.setAttribute('data-theme', theme);
  
  // Remove existing theme classes
  document.documentElement.classList.remove('light', 'dark');
  
  // Add new theme class for OKLCH support
  document.documentElement.classList.add(theme);
  
  localStorage.setItem('theme', theme);
  const icon = document.getElementById('theme-toggle-icon');
  if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  
  // Apply letter spacing to body
  document.body.style.letterSpacing = 'var(--tracking-normal)';
  
  // Dispatch custom event for theme change (useful for components that need to react)
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
}

function getPreferredTheme() {
  const stored = localStorage.getItem('theme');
  if (stored) return stored;
  // Default to the dark (blue) theme if no preference is stored
  return 'dark';
}

const preferred = getPreferredTheme();
document.documentElement.setAttribute('data-theme', preferred);
document.documentElement.classList.add(preferred);

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('theme-toggle');
  if (!toggle) return;
  const icon = document.getElementById('theme-toggle-icon');
  if (icon) icon.textContent = preferred === 'dark' ? '☀️' : '🌙';
  toggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
  });
});

