function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  const icon = document.getElementById('theme-toggle-icon');
  if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function getPreferredTheme() {
  const stored = localStorage.getItem('theme');
  if (stored) return stored;
  // Default to the dark (blue) theme if no preference is stored
  return 'dark';
}

const preferred = getPreferredTheme();
document.documentElement.setAttribute('data-theme', preferred);

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

