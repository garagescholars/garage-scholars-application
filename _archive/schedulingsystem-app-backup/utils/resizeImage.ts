/**
 * Resize a base64 data URL image to fit within maxDim (preserving aspect ratio).
 * Returns the original if already within bounds.
 */
export async function resizeImage(
  dataUrl: string, maxDim = 1600, quality = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w <= maxDim && h <= maxDim) { resolve(dataUrl); return; }
      if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
      else { w = Math.round(w * maxDim / h); h = maxDim; }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Resize a File to a JPEG Blob that fits within maxDim.
 */
export async function resizeFileToBlob(
  file: File, maxDim = 1600, quality = 0.8
): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const resized = await resizeImage(dataUrl, maxDim, quality);
  const resp = await fetch(resized);
  return resp.blob();
}
