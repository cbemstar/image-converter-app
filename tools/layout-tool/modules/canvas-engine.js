let idCounter = 0;

/**
 * Create a new artboard element.
 * @param {{w:number,h:number}} preset
 * @returns {{id:string,canvas:HTMLCanvasElement,ctx:CanvasRenderingContext2D,elements:object[],preset:object}}
 */
export function createArtboard(preset) {
  const canvas = document.createElement('canvas');
  canvas.width = preset.w;
  canvas.height = preset.h;
  const ctx = canvas.getContext('2d');
  const wrapper = document.createElement('div');
  wrapper.className = 'artboard';
  wrapper.appendChild(canvas);
  const board = {
    id: `ab${idCounter++}`,
    canvas,
    ctx,
    wrapper,
    preset,
    elements: []
  };
  draw(board);
  return board;
}

/** Add a text object to the artboard. */
export function addText(board, text, opts = {}) {
  const obj = {
    type: 'text',
    text,
    x: opts.x || 0.1,
    y: opts.y || 0.1,
    size: opts.size || 24,
    channels: { print: true, digital: true, social: true }
  };
  board.elements.push(obj);
  draw(board);
  return obj;
}

/** Add an image to the artboard. */
export function addImage(board, image, opts = {}) {
  const obj = {
    type: 'image',
    image,
    x: opts.x || 0,
    y: opts.y || 0,
    w: opts.w || 1,
    h: opts.h || 1,
    channels: { print: true, digital: true, social: true }
  };
  board.elements.push(obj);
  draw(board);
  return obj;
}

/**
 * Draw all objects on the board.
 * @param {*} board
 */
export function draw(board) {
  const { ctx, canvas, elements } = board;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  elements.forEach(el => {
    if (el.type === 'text') {
      ctx.fillStyle = '#000';
      ctx.font = `${el.size}px sans-serif`;
      ctx.fillText(el.text, el.x * canvas.width, el.y * canvas.height);
    } else if (el.type === 'image') {
      ctx.drawImage(
        el.image,
        el.x * canvas.width,
        el.y * canvas.height,
        el.w * canvas.width,
        el.h * canvas.height
      );
    }
  });
}

/**
 * Smart crop image to cover artboard.
 * @param {HTMLImageElement} img
 * @param {*} board
 * @returns {HTMLCanvasElement}
 */
export function smartCrop(img, board) {
  const canvas = document.createElement('canvas');
  canvas.width = board.canvas.width;
  canvas.height = board.canvas.height;
  const ctx = canvas.getContext('2d');
  const ratio = Math.max(canvas.width / img.width, canvas.height / img.height);
  const w = img.width * ratio;
  const h = img.height * ratio;
  const x = (canvas.width - w) / 2;
  const y = (canvas.height - h) / 2;
  ctx.drawImage(img, x, y, w, h);
  return canvas;
}
