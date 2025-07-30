import { getMode } from './colour-manager.js';

/**
 * CanvasEngine handles object rendering and interaction on a canvas element.
 */
export class CanvasEngine {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.objects = [];
    this.activeChannel = 'print';
    this.selected = null;
    this.dragOffset = null;
    this.initEvents();
    this.render();
  }

  initEvents() {
    this.canvas.addEventListener('mousedown', (e) => {
      const pos = this.getMouse(e);
      this.selected = this.objects.find(o => this.hitTest(o, pos));
      if (this.selected) {
        this.dragOffset = { x: pos.x - this.selected.x, y: pos.y - this.selected.y };
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.dragOffset && this.selected) {
        const pos = this.getMouse(e);
        this.selected.x = pos.x - this.dragOffset.x;
        this.selected.y = pos.y - this.dragOffset.y;
        this.render();
      }
    });

    window.addEventListener('mouseup', () => {
      this.dragOffset = null;
    });
  }

  /**
   * @param {{x:number,y:number,width:number,height:number}} obj
   * @param {{x:number,y:number}} pos
   */
  hitTest(obj, pos) {
    return pos.x >= obj.x && pos.x <= obj.x + obj.width && pos.y >= obj.y && pos.y <= obj.y + obj.height;
  }

  /**
   * Convert mouse event to canvas coordinates.
   */
  getMouse(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left), y: (e.clientY - rect.top) };
  }

  /**
   * Add an image object to the canvas.
   * @param {HTMLImageElement} img
   */
  addImage(img) {
    const obj = { type: 'image', img, x: 10, y: 10, width: img.width, height: img.height, channels: { print: true, digital: true, social: true } };
    this.objects.push(obj);
    this.render();
  }

  /**
   * Add a text object.
   * @param {string} text
   */
  addText(text) {
    const obj = { type: 'text', text, x: 50, y: 50, width: 100, height: 40, channels: { print: true, digital: true, social: true } };
    this.objects.push(obj);
    this.render();
  }

  /** Draw all objects. */
  render() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.objects.forEach(o => {
      if (!o.channels[this.activeChannel]) return;
      if (o.type === 'image') {
        ctx.drawImage(o.img, o.x, o.y, o.width, o.height);
      } else if (o.type === 'text') {
        ctx.font = '24px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(o.text, o.x, o.y + o.height);
      }
    });

    if (getMode() === 'CMYK') {
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }
}
