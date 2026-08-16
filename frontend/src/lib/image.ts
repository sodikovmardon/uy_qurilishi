import type { UploadImage } from '../api/client';

/** Client-side image constraints — mirror the backend (api/images.py). */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_COUNT = 6;

/** Returns a user-facing (Uzbek) error message, or null when the file is valid. */
export function validateImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Faqat JPG, PNG yoki WebP rasmlar qabul qilinadi';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'Rasm hajmi 5 MB dan oshmasligi kerak';
  }
  return null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Yaroqli rasm emas'));
    img.src = src;
  });
}

/**
 * Downscale to at most `maxWidth` wide and encode as WebP (~85% quality).
 * Falls back to the original file when the browser can't decode or encode.
 */
export async function compressImage(file: File, maxWidth = 1200): Promise<UploadImage> {
  try {
    const url = URL.createObjectURL(file);
    const img = await loadImage(url);
    URL.revokeObjectURL(url);
    const scale = Math.min(1, maxWidth / img.naturalWidth);
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { file, name: file.name };
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
    if (blob && blob.size > 0) return { file: blob, name: 'rasm.webp' };
    return { file, name: file.name };
  } catch {
    return { file, name: file.name };
  }
}

/** Validate + compress a list of picked files; throws on the first invalid file. */
export async function prepareUploads(files: File[]): Promise<UploadImage[]> {
  const out: UploadImage[] = [];
  for (const f of files) {
    const err = validateImageFile(f);
    if (err) throw new Error(err);
    out.push(await compressImage(f));
  }
  return out;
}
