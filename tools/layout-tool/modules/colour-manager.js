let mode = 'RGB';

/**
 * Set colour mode.
 * @param {'RGB'|'CMYK'} m
 */
export function setMode(m) {
  mode = m;
}

/**
 * Convert RGB to CMYK.
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
    Math.round(((c - k) / (1 - k)) * 100),
    Math.round(((m - k) / (1 - k)) * 100),
    Math.round(((y - k) / (1 - k)) * 100),
    Math.round(k * 100)
  ];
}

/**
 * Apply CMYK soft proof overlay.
 * @param {CanvasRenderingContext2D} ctx
 */
export function softProof(ctx) {
  if (mode === 'CMYK') {
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
}
