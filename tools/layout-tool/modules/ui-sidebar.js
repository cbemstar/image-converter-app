import { listPresets, loadPreset } from './preset-manager.js';
import { createArtboard } from './canvas-engine.js';

/**
 * Initialise preset sidebar.
 * @param {HTMLElement} container
 * @param {Function} onGenerate
 */
export async function initSidebar(container, onGenerate) {
  const ids = await listPresets();
  const form = document.createElement('form');
  form.className = 'p-2';
  ids.forEach(id => {
    const label = document.createElement('label');
    label.className = 'flex items-center gap-2 text-sm';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = id;
    label.appendChild(cb);
    label.appendChild(document.createTextNode(id));
    form.appendChild(label);
  });
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Generate sizes';
  btn.className = 'btn mt-2';
  btn.addEventListener('click', async () => {
    const selected = Array.from(form.querySelectorAll('input:checked')).map(
      el => el.value
    );
    const presets = await Promise.all(selected.map(loadPreset));
    onGenerate(presets);
  });
  form.appendChild(btn);
  container.appendChild(form);
}
