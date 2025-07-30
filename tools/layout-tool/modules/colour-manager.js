let mode = 'RGB';

/**
 * Get the current colour mode.
 * @returns {'RGB'|'CMYK'}
 */
export function getMode() {
  return mode;
}

/**
 * Toggle colour mode between RGB and CMYK.
 * @returns {'RGB'|'CMYK'} new mode
 */
export function toggleMode() {
  mode = mode === 'RGB' ? 'CMYK' : 'RGB';
  document.body.dataset.colourMode = mode;
  return mode;
}

/**
 * Convert RGB colour to CMYK.
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {[number,number,number,number]}
 */
export function rgbToCmyk(r, g, b) {
  const c = 1 - r / 255;
  const m = 1 - g / 255;
  const y = 1 - b / 255;
  const k = Math.min(c, m, y);
  return [
    Math.round(((c - k) / (1 - k)) * 100) || 0,
    Math.round(((m - k) / (1 - k)) * 100) || 0,
    Math.round(((y - k) / (1 - k)) * 100) || 0,
    Math.round(k * 100)
  ];
}

/**
 * Convert CMYK colour to RGB.
 * @param {number} c
 * @param {number} m
 * @param {number} y
 * @param {number} k
 * @returns {[number,number,number]}
 */
export function cmykToRgb(c, m, y, k) {
  const r = 255 * (1 - c / 100) * (1 - k / 100);
  const g = 255 * (1 - m / 100) * (1 - k / 100);
  const b = 255 * (1 - y / 100) * (1 - k / 100);
  return [Math.round(r), Math.round(g), Math.round(b)];
}
