export interface SvgExportOptions {
  outline?: boolean;
}

export default class SvgExporter {
  constructor(private svg: SVGSVGElement) {}

  exportString(options: SvgExportOptions = {}): string {
    const clone = this.svg.cloneNode(true) as SVGSVGElement;
    if (options.outline) {
      const texts = Array.from(clone.querySelectorAll('text')) as SVGTextElement[];
      texts.forEach(t => {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const bbox = t.getBBox();
        const rectPath = `M${bbox.x},${bbox.y}h${bbox.width}v${bbox.height}h-${bbox.width}Z`;
        path.setAttribute('d', rectPath);
        path.setAttribute('fill', window.getComputedStyle(t).fill || 'black');
        t.replaceWith(path);
      });
    }
    const serializer = new XMLSerializer();
    return serializer.serializeToString(clone);
  }
}
