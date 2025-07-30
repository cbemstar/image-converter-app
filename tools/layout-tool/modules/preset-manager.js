/**
 * Load a preset JSON file from the presets folder.
 * @param {string} name
 * @returns {Promise<object>}
 */
export async function loadPreset(name) {
  const res = await fetch(`presets/${name}.json`);
  if (!res.ok) throw new Error('Failed to load preset');
  return res.json();
}

/**
 * Load all available presets defined in the presets folder.
 * @returns {Promise<Array<object>>}
 */
export async function listPresets() {
  const names = ['poster-a4', 'dle-flyer', 'billboard'];
  const all = await Promise.all(names.map(n => loadPreset(n)));
  return all;
}
