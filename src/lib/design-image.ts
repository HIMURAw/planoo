// Client-only helpers for the design canvas's Image tool. There's no
// object-storage integration (S3/etc.) in this project — images are stored
// as data: URLs directly on DesignElement.imageData (see prisma/schema.prisma)
// — so every upload is downscaled and re-encoded as JPEG here first to keep
// that column from becoming a runaway payload. This does mean uploaded PNGs
// lose transparency; an acceptable v0 trade-off given the alternative is no
// image support at all.

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

export function compressImageToDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height, 1);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      img.onerror = () => resolve(null);
      img.src = reader.result as string;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

export function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Failed to read image dimensions"));
    img.src = dataUrl;
  });
}
