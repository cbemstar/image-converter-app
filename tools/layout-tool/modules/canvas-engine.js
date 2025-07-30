import { coverFit } from './smart-crop.js';
import { softProof } from './colour-manager.js';

/**
 * Clone master document into preset sized canvas.
 * @param {object} preset
 * @param {object} master
 * @param {number} scale
 * @returns {HTMLCanvasElement}
 */
export function createArtboard(preset, master, scale = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = preset.width || preset.width_mm * scale;
  canvas.height = preset.height || preset.height_mm * scale;
  const ctx = canvas.getContext('2d');
  if (master.hero) {
    const crop = coverFit(master.hero, canvas.width, canvas.height);
    ctx.drawImage(master.hero, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, canvas.width, canvas.height);
  }
  for (const obj of master.objects) {
    if (obj.hidden && obj.hidden[preset.channel]) continue;
    ctx.save();
    ctx.translate(obj.x * (canvas.width / master.width), obj.y * (canvas.height / master.height));
    if (obj.type === 'text') {
      ctx.fillStyle = obj.color || '#fff';
      ctx.font = `${obj.size || 20}px sans-serif`;
      ctx.fillText(obj.text, 0, 0);
    }
    if (obj.type === 'logo' && obj.image) {
      ctx.drawImage(obj.image, 0, 0, obj.w, obj.h);
    }
    ctx.restore();
  }
  softProof(ctx);
  return canvas;
}
