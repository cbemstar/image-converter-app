import { listPresets } from './preset-manager.js';

/**
 * Initialise the sidebar preset list.
 * @param {HTMLElement} container
 * @param {(preset:object)=>void} onSelect
 */
export async function initSidebar(container, onSelect) {
  const presets = await listPresets();
  container.innerHTML = '';
  presets.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'shad-btn w-full mb-2';
    btn.textContent = p.name;
    btn.addEventListener('click', () => onSelect(p));
    container.appendChild(btn);
  });
}
