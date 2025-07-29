export interface ImageTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface ImageObject {
  id: string;
  type: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  data: string; // data URI with orientation fixed
  transform: ImageTransform;
}

function readFileAsDataURL(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function getOrientation(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const view = new DataView(reader.result as ArrayBuffer);
      if (view.getUint16(0, false) !== 0xffd8) return resolve(null);
      let offset = 2;
      while (offset < view.byteLength) {
        const marker = view.getUint16(offset, false);
        offset += 2;
        if (marker === 0xffe1) {
          offset += 2;
          if (view.getUint32(offset, false) !== 0x45786966) break;
          offset += 6;
          const little = view.getUint16(offset, false) === 0x4949;
          offset += view.getUint32(offset + 4, little);
          const tags = view.getUint16(offset, little);
          offset += 2;
          for (let i = 0; i < tags; i++) {
            const tag = offset + i * 12;
            if (view.getUint16(tag, little) === 0x0112) {
              return resolve(view.getUint16(tag + 8, little));
            }
          }
        } else if ((marker & 0xff00) !== 0xff00) {
          break;
        } else {
          offset += view.getUint16(offset, false);
        }
      }
      resolve(null);
    };
    reader.readAsArrayBuffer(file.slice(0, 131072));
  });
}

export async function applyOrientation(dataUrl: string, orientation: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      if (orientation > 4) {
        canvas.width = height;
        canvas.height = width;
      } else {
        canvas.width = width;
        canvas.height = height;
      }
      switch (orientation) {
        case 2:
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
          break;
        case 3:
          ctx.translate(width, height);
          ctx.rotate(Math.PI);
          break;
        case 4:
          ctx.translate(0, height);
          ctx.scale(1, -1);
          break;
        case 5:
          ctx.rotate(0.5 * Math.PI);
          ctx.scale(1, -1);
          break;
        case 6:
          ctx.rotate(0.5 * Math.PI);
          ctx.translate(0, -height);
          break;
        case 7:
          ctx.rotate(-0.5 * Math.PI);
          ctx.translate(-width, height);
          ctx.scale(1, -1);
          break;
        case 8:
          ctx.rotate(-0.5 * Math.PI);
          ctx.translate(-width, 0);
          break;
        default:
          break;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = dataUrl;
  });
}

export async function loadImageFile(file: File): Promise<string> {
  const dataUrl = await readFileAsDataURL(file);
  const orientation = await getOrientation(file);
  if (!orientation || orientation === 1) {
    return dataUrl;
  }
  return applyOrientation(dataUrl, orientation);
}

export async function replaceImageData(obj: ImageObject, file: File): Promise<ImageObject> {
  const data = await loadImageFile(file);
  return { ...obj, data };
}

export function createImageObject(id: string, data: string, x: number, y: number, width: number, height: number): ImageObject {
  return {
    id,
    type: 'image',
    x,
    y,
    width,
    height,
    data,
    transform: { scale: 1, offsetX: 0, offsetY: 0 }
  };
}
