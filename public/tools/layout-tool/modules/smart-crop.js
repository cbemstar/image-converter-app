/**
 * Calculate cover fit crop box.
 * @param {HTMLImageElement} img
 * @param {number} artW
 * @param {number} artH
 * @returns {{sx:number,sy:number,sw:number,sh:number}}
 */
export function coverFit(img, artW, artH) {
  const imgRatio = img.width / img.height;
  const artRatio = artW / artH;
  let sw, sh, sx, sy;
  if (imgRatio > artRatio) {
    sh = img.height;
    sw = sh * artRatio;
    sy = 0;
    sx = (img.width - sw) / 2;
  } else {
    sw = img.width;
    sh = sw / artRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  return { sx, sy, sw, sh };
}
