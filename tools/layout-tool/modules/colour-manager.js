let mode = 'RGB';

/**
 * Set the current colour mode.
 * @param {'RGB'|'CMYK'} m
 */
export function setMode(m) {
  mode = m;
}

/**
 * Convert RGB to CMYK.
 * @param {[number,number,number]} rgb Array of 0-255 values.
 * @returns {[number,number,number,number]}
 */
export function toCmyk([r, g, b]) {
  const c = 1 - r / 255;
  const m = 1 - g / 255;
  const y = 1 - b / 255;
  const k = Math.min(c, m, y);
  return [
    Math.round((c - k) / (1 - k) * 100) || 0,
    Math.round((m - k) / (1 - k) * 100) || 0,
    Math.round((y - k) / (1 - k) * 100) || 0,
    Math.round(k * 100)
  ];
}

/**
 * Convert CMYK to RGB.
 * @param {[number,number,number,number]} cmyk
 * @returns {[number,number,number]}
 */
export function toRgb([c, m, y, k]) {
  const r = 255 * (1 - c / 100) * (1 - k / 100);
  const g = 255 * (1 - m / 100) * (1 - k / 100);
  const b = 255 * (1 - y / 100) * (1 - k / 100);
  return [Math.round(r), Math.round(g), Math.round(b)];
}

/**
 * Draw soft proof overlay on canvas context.
 * @param {CanvasRenderingContext2D} ctx
 */
export function applySoftProof(ctx) {
  if (mode === 'CMYK') {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,0,0.1)';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  }
}

export function getMode() {
  return mode;
}
