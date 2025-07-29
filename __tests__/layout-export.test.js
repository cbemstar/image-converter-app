const { canvasToPng, canvasToJpg, canvasToSvg, canvasToPdf } = require('../layout-export.js');

const SAMPLE_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVQYV2P4/5/hPwAHggJ/P+ZtAAAAAElFTkSuQmCC';

describe('layout export', () => {
  test('exports canvas to PNG data URL', () => {
    const canvas = { width: 1, height: 1, toDataURL: () => SAMPLE_PNG };
    const url = canvasToPng(canvas);
    expect(url.startsWith('data:image/png')).toBe(true);
  });

  test('exports canvas to JPG data URL', () => {
    const canvas = { width: 1, height: 1, toDataURL: () => 'data:image/jpeg;base64,foo' };
    const url = canvasToJpg(canvas);
    expect(url.startsWith('data:image/jpeg')).toBe(true);
  });

  test('exports canvas to SVG string', () => {
    const canvas = { width: 1, height: 1, toDataURL: () => SAMPLE_PNG };
    const svg = canvasToSvg(canvas);
    expect(svg.startsWith('<svg')).toBe(true);
  });

  test('exports canvas to PDF bytes', async () => {
    const canvas = { width: 1, height: 1, toDataURL: () => SAMPLE_PNG };
    const bytes = await canvasToPdf(canvas);
    expect(bytes instanceof Uint8Array).toBe(true);
  });
});
