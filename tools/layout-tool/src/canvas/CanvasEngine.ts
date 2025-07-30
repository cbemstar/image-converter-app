export interface Document {
  width: number;
  height: number;
  bleed?: number;
  safe?: number;
}

import { TextObject } from '@core/TextObject';
import { ImageObject, ImageTransform } from '@core/ImageObject';

export type CanvasObject = RectObject | TextObject | ImageObject;

interface BaseObject {
  id: string;
  x: number;
  y: number;
}

export interface RectObject extends BaseObject {
  type: 'rect';
  width: number;
  height: number;
  fill?: string;
}

export default class CanvasEngine {
  private svg: SVGSVGElement;
  private defs: SVGDefsElement;
  private overlayGroup: SVGGElement;
  private objects: Map<string, CanvasObject> = new Map();
  private elements: Map<string, SVGElement> = new Map();
  private selectedId: string | null = null;
  private bbox: SVGRectElement | null = null;
  private handles: SVGRectElement[] = [];
  private currentHandle: SVGRectElement | null = null;
  private startBox: { x: number; y: number; width: number; height: number } | null = null;
  private aspectRatio = 1;
  private editor: HTMLTextAreaElement | null = null;
  private overflowIndicators: Map<string, SVGPolygonElement> = new Map();
  private clipRects: Map<string, SVGRectElement> = new Map();
  private imageEditHandler: ((obj: ImageObject) => void) | null = null;
  private showBleed = true;
  private showTrim = true;
  private showSafe = true;

  constructor(private container: HTMLElement, private doc: Document) {
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('width', String(doc.width));
    this.svg.setAttribute('height', String(doc.height));
    this.svg.setAttribute('class', 'bg-white');
    this.svg.style.touchAction = 'none';
    this.defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    this.svg.appendChild(this.defs);
    this.overlayGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.overlayGroup.setAttribute('pointer-events', 'none');
    this.svg.appendChild(this.overlayGroup);
    container.appendChild(this.svg);
    this.drawOverlays();
  }

  getSVGElement(): SVGSVGElement {
    return this.svg;
  }

  destroy() {
    this.container.removeChild(this.svg);
  }

  setImageEditHandler(handler: (obj: ImageObject) => void) {
    this.imageEditHandler = handler;
  }

  setOverlayVisibility(type: 'bleed' | 'trim' | 'safe', visible: boolean) {
    if (type === 'bleed') this.showBleed = visible;
    if (type === 'trim') this.showTrim = visible;
    if (type === 'safe') this.showSafe = visible;
    this.drawOverlays();
  }

  private drawOverlays() {
    while (this.overlayGroup.firstChild) {
      this.overlayGroup.firstChild.remove();
    }
    const { width, height, bleed = 0, safe = 0 } = this.doc;
    if (this.showTrim) {
      const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      r.setAttribute('x', '0');
      r.setAttribute('y', '0');
      r.setAttribute('width', String(width));
      r.setAttribute('height', String(height));
      r.setAttribute('fill', 'none');
      r.setAttribute('stroke', 'green');
      this.overlayGroup.appendChild(r);
    }
    if (this.showBleed && bleed > 0) {
      const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      r.setAttribute('x', String(bleed));
      r.setAttribute('y', String(bleed));
      r.setAttribute('width', String(width - bleed * 2));
      r.setAttribute('height', String(height - bleed * 2));
      r.setAttribute('fill', 'none');
      r.setAttribute('stroke', 'red');
      r.setAttribute('stroke-dasharray', '4');
      this.overlayGroup.appendChild(r);
    }
    if (this.showSafe && safe > 0) {
      const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      r.setAttribute('x', String(safe));
      r.setAttribute('y', String(safe));
      r.setAttribute('width', String(width - safe * 2));
      r.setAttribute('height', String(height - safe * 2));
      r.setAttribute('fill', 'none');
      r.setAttribute('stroke', 'orange');
      r.setAttribute('stroke-dasharray', '2');
      this.overlayGroup.appendChild(r);
    }
    this.svg.appendChild(this.overlayGroup);
  }

  replaceImage(id: string, data: string) {
    const obj = this.objects.get(id) as ImageObject | undefined;
    if (!obj) return;
    obj.data = data;
    const el = this.elements.get(id) as SVGImageElement;
    el.setAttributeNS('http://www.w3.org/1999/xlink', 'href', obj.data);
  }

  updateImageTransform(id: string, transform: ImageTransform) {
    const obj = this.objects.get(id) as ImageObject | undefined;
    if (!obj) return;
    obj.transform = transform;
    const el = this.elements.get(id) as SVGImageElement;
    el.setAttribute(
      'transform',
      `translate(${obj.x + transform.offsetX}, ${obj.y + transform.offsetY}) scale(${transform.scale})`
    );
  }

  addObject(obj: CanvasObject) {
    this.objects.set(obj.id, obj);
    const el = this.createElement(obj);
    this.elements.set(obj.id, el);
    this.svg.appendChild(el);
    this.svg.appendChild(this.overlayGroup);
    if (obj.type === 'text') {
      this.updateOverflow(obj.id);
    }
  }

  private createElement(obj: CanvasObject): SVGElement {
    let el: SVGElement;
    if (obj.type === 'rect') {
      const o = obj as RectObject;
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(o.x));
      rect.setAttribute('y', String(o.y));
      rect.setAttribute('width', String(o.width));
      rect.setAttribute('height', String(o.height));
      rect.setAttribute('fill', o.fill || 'transparent');
      el = rect;
    } else if (obj.type === 'text') {
      const o = obj as TextObject;
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', String(o.x));
      t.setAttribute('y', String(o.y + o.size));
      t.textContent = o.text;
      t.setAttribute('fill', o.colour);
      t.style.fontFamily = o.family;
      t.style.fontWeight = String(o.weight);
      t.style.fontSize = `${o.size}px`;
      t.style.letterSpacing = `${o.tracking}px`;
      t.style.lineHeight = `${o.lineHeight}px`;
      t.style.textAnchor = o.align === 'center' ? 'middle' : o.align === 'right' ? 'end' : 'start';
      el = t;
      el.addEventListener('dblclick', (e) => this.startEdit(o.id, e));
    } else {
      const o = obj as ImageObject;
      const clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
      const clipId = `clip-${o.id}`;
      clip.setAttribute('id', clipId);
      const cRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      cRect.setAttribute('x', String(o.x));
      cRect.setAttribute('y', String(o.y));
      cRect.setAttribute('width', String(o.width));
      cRect.setAttribute('height', String(o.height));
      clip.appendChild(cRect);
      this.defs.appendChild(clip);
      this.clipRects.set(o.id, cRect);

      const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
      img.setAttribute('clip-path', `url(#${clipId})`);
      img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', o.data);
      img.setAttribute('width', String(o.width));
      img.setAttribute('height', String(o.height));
      img.setAttribute(
        'transform',
        `translate(${o.x + o.transform.offsetX}, ${o.y + o.transform.offsetY}) scale(${o.transform.scale})`
      );
      el = img;
      el.addEventListener('dblclick', () => this.imageEditHandler && this.imageEditHandler(o));
    }
    el.addEventListener('pointerdown', (e) => this.select(obj.id, e));
    return el;
  }

  private select(id: string, e: PointerEvent) {
    e.stopPropagation();
    if (this.selectedId === id) return;
    this.selectedId = id;
    this.updateSelection();
  }

  private updateSelection() {
    if (this.bbox) {
      this.bbox.remove();
      this.handles.forEach(h => h.remove());
      this.handles = [];
    }
    if (!this.selectedId) return;
    const obj = this.objects.get(this.selectedId)! as RectObject | ImageObject | TextObject;
    const { x, y, width, height } = obj;
    this.bbox = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    this.bbox.setAttribute('x', String(x));
    this.bbox.setAttribute('y', String(y));
    this.bbox.setAttribute('width', String(width));
    this.bbox.setAttribute('height', String(height));
    this.bbox.setAttribute('fill', 'none');
    this.bbox.setAttribute('stroke', 'blue');
    this.bbox.setAttribute('stroke-dasharray', '4');
    this.svg.appendChild(this.bbox);

    const handleCoords = [
      [x, y],
      [x + width, y],
      [x + width, y + height],
      [x, y + height]
    ];

    handleCoords.forEach(([hx, hy]) => {
      const h = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      h.setAttribute('x', String(hx - 4));
      h.setAttribute('y', String(hy - 4));
      h.setAttribute('width', '8');
      h.setAttribute('height', '8');
      h.setAttribute('fill', 'white');
      h.setAttribute('stroke', 'blue');
      h.style.cursor = 'nwse-resize';
      h.addEventListener('pointerdown', (e) => this.startResize(h, e));
      this.svg.appendChild(h);
      this.handles.push(h);
    });

    this.svg.appendChild(this.overlayGroup);

    if (obj.type === 'text') {
      this.updateOverflow(obj.id);
    }
  }

  private startResize(handle: SVGRectElement, e: PointerEvent) {
    e.stopPropagation();
    this.currentHandle = handle;
    const obj = this.objects.get(this.selectedId!) as RectObject | ImageObject | TextObject;
    this.startBox = { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
    this.aspectRatio = obj.width / obj.height;
    window.addEventListener('pointermove', this.onResize);
    window.addEventListener('pointerup', this.endResize);
  }

  private onResize = (e: PointerEvent) => {
    if (!this.currentHandle || !this.startBox || !this.selectedId) return;
    const obj = this.objects.get(this.selectedId) as RectObject | ImageObject | TextObject;
    const dx = e.movementX;
    const dy = e.movementY;
    let newW = this.startBox.width + dx;
    let newH = this.startBox.height + dy;
    if (e.shiftKey) {
      const ratio = this.aspectRatio;
      if (Math.abs(dx) > Math.abs(dy)) {
        newW = this.startBox.width + dx;
        newH = newW / ratio;
      } else {
        newH = this.startBox.height + dy;
        newW = newH * ratio;
      }
    }
    obj.width = Math.max(1, newW);
    obj.height = Math.max(1, newH);
    const el = this.elements.get(obj.id)!;
    if (el.tagName === 'text') {
      // text element does not use width/height attributes
    } else {
      el.setAttribute('width', String((obj as RectObject | ImageObject).width));
      el.setAttribute('height', String((obj as RectObject | ImageObject).height));
      if (obj.type === 'image') {
        el.setAttribute(
          'transform',
          `translate(${obj.x + (obj as ImageObject).transform.offsetX}, ${obj.y + (obj as ImageObject).transform.offsetY}) scale(${(obj as ImageObject).transform.scale})`
        );
        const clipRect = this.clipRects.get(obj.id);
        if (clipRect) {
          clipRect.setAttribute('x', String(obj.x));
          clipRect.setAttribute('y', String(obj.y));
          clipRect.setAttribute('width', String(obj.width));
          clipRect.setAttribute('height', String(obj.height));
        }
      }
    }
    this.updateSelection();
  };

  private endResize = () => {
    window.removeEventListener('pointermove', this.onResize);
    window.removeEventListener('pointerup', this.endResize);
    this.currentHandle = null;
  };

  private startEdit(id: string, e: MouseEvent) {
    e.stopPropagation();
    if (this.editor) return;
    const obj = this.objects.get(id) as TextObject;
    const containerRect = this.container.getBoundingClientRect();
    const textarea = document.createElement('textarea');
    textarea.value = obj.text;
    textarea.style.position = 'absolute';
    textarea.style.left = `${containerRect.left + obj.x}px`;
    textarea.style.top = `${containerRect.top + obj.y}px`;
    textarea.style.width = `${obj.width}px`;
    textarea.style.height = `${obj.height}px`;
    textarea.style.fontFamily = obj.family;
    textarea.style.fontWeight = String(obj.weight);
    textarea.style.fontSize = `${obj.size}px`;
    textarea.style.lineHeight = `${obj.lineHeight}px`;
    textarea.style.letterSpacing = `${obj.tracking}px`;
    textarea.style.color = obj.colour;
    textarea.style.background = 'rgba(255,255,255,0.8)';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.addEventListener('blur', () => this.endEdit(id, textarea));
    this.editor = textarea;
  }

  private endEdit(id: string, textarea: HTMLTextAreaElement) {
    const obj = this.objects.get(id) as TextObject;
    obj.text = textarea.value;
    const el = this.elements.get(id)! as SVGTextElement;
    el.textContent = obj.text;
    textarea.remove();
    this.editor = null;
    this.updateOverflow(id);
  }

  private updateOverflow(id: string) {
    const obj = this.objects.get(id) as TextObject;
    const textEl = this.elements.get(id) as SVGTextElement;
    const bbox = textEl.getBBox();
    let indicator = this.overflowIndicators.get(id);
    const overflow = bbox.width > obj.width || bbox.height > obj.height;
    if (overflow) {
      if (!indicator) {
        indicator = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        indicator.setAttribute('points', `${obj.x + obj.width - 10},${obj.y + obj.height} ${obj.x + obj.width},${obj.y + obj.height} ${obj.x + obj.width},${obj.y + obj.height - 10}`);
        indicator.setAttribute('fill', 'orange');
        this.svg.appendChild(indicator);
        this.overflowIndicators.set(id, indicator);
      }
    } else if (indicator) {
      indicator.remove();
      this.overflowIndicators.delete(id);
    }
  }
}
