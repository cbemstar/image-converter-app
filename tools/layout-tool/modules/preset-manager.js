/**
 * Load an artboard preset definition.
 * @param {string} id Preset filename without extension.
 * @returns {Promise<{w:number,h:number,bleed:number,safe:number}>}
 */
export async function loadPreset(id) {
  const res = await fetch(`presets/${id}.json`);
  if (!res.ok) throw new Error('Preset not found');
  return res.json();
}

/**
 * Get available preset ids.
 * @returns {Promise<string[]>}
 */
export async function listPresets() {
  // The list is static; derive from hardcoded array to avoid extra fetch.
  return [
    'social-1080x1080',
    'social-1080x1350',
    'social-1080x566',
    'poster-a1',
    'poster-a2',
    'poster-a3',
    'poster-a4',
    'dle-flyer',
    'pullup-850x2000',
    'billboard-3600x2400'
  ];
}
