export interface RasterExportOptions {
  dpi: 72 | 150 | 300;
  format: 'png' | 'jpeg';
  quality?: number; // 0-1 for jpeg
}

export default class RasterExporter {
  constructor(private svg: SVGSVGElement) {}

  private renderCanvas(dpi: number): Promise<HTMLCanvasElement> {
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(this.svg);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = dpi / 72;
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d')!;
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        resolve(canvas);
      };
      img.src = url;
    });
  }

  async exportDataURL(options: RasterExportOptions): Promise<string> {
    const canvas = await this.renderCanvas(options.dpi);
    return canvas.toDataURL(
      options.format === 'png' ? 'image/png' : 'image/jpeg',
      options.format === 'jpeg' ? options.quality ?? 0.92 : undefined
    );
  }
}
