/**
 * Image compression utility optimized for mobile.
 *
 * IMPORTANT: iOS Safari / the Capacitor WebView cannot encode WebP from a
 * canvas. `canvas.toBlob(cb, 'image/webp')` silently falls back to PNG there,
 * which produced 1.6 MB "webp" listing photos. We therefore probe for real
 * WebP encoding support and fall back to JPEG, and we always trust the blob's
 * actual `type` when naming the file.
 */

interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: 'image/jpeg' | 'image/webp';
}

const DEFAULT_OPTIONS: Required<Omit<CompressionOptions, 'mimeType'>> = {
  maxWidth: 1080,
  maxHeight: 1080,
  quality: 0.78,
};

/** Sizes at or below this are left alone, provided they are already jpeg/webp. */
const SKIP_COMPRESSION_BYTES = 150 * 1024;

let webpSupport: boolean | null = null;

/** True only when the browser can genuinely encode WebP from a canvas. */
export const supportsWebp = (): boolean => {
  if (webpSupport !== null) return webpSupport;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    webpSupport = canvas.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    webpSupport = false;
  }
  return webpSupport;
};

export const preferredImageMime = (): 'image/webp' | 'image/jpeg' =>
  supportsWebp() ? 'image/webp' : 'image/jpeg';

export const extensionForMime = (mime: string): string =>
  mime === 'image/webp' ? 'webp' : mime === 'image/png' ? 'png' : 'jpg';

const isAlreadyEfficient = (file: File) =>
  file.type === 'image/jpeg' || file.type === 'image/webp';

const withExtension = (name: string, ext: string) =>
  `${name.replace(/\.[^/.]+$/, '')}.${ext}`;

/**
 * Compresses an image file for mobile optimization.
 * The returned file's name, extension and `type` always match the real
 * encoded format.
 */
export const compressImage = (
  file: File,
  options: CompressionOptions = {}
): Promise<File> => {
  const maxWidth = options.maxWidth ?? DEFAULT_OPTIONS.maxWidth;
  const maxHeight = options.maxHeight ?? DEFAULT_OPTIONS.maxHeight;
  const quality = options.quality ?? DEFAULT_OPTIONS.quality;
  const mimeType = options.mimeType ?? preferredImageMime();

  return new Promise((resolve, reject) => {
    // Small AND already in an efficient format: nothing to gain.
    if (file.size < SKIP_COMPRESSION_BYTES && isAlreadyEfficient(file)) {
      resolve(file);
      return;
    }

    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    img.onload = () => {
      let { width, height } = img;

      // Calculate new dimensions while maintaining aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;

      // Flatten onto white so JPEG output never gets black transparency.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      const finish = (blob: Blob | null) => {
        if (!blob) {
          reject(new Error('Failed to compress image'));
          return;
        }

        const actualType =
          blob.type === 'image/webp' || blob.type === 'image/jpeg' ? blob.type : 'image/jpeg';

        const compressedFile = new File(
          [blob],
          withExtension(file.name, extensionForMime(actualType)),
          { type: actualType, lastModified: Date.now() }
        );

        // Keep the original only when it is already efficient and smaller.
        if (compressedFile.size >= file.size && isAlreadyEfficient(file)) {
          resolve(file);
        } else {
          resolve(compressedFile);
        }
      };

      canvas.toBlob(
        (blob) => {
          // Browser ignored the requested type (iOS + webp) and gave us PNG:
          // re-encode as JPEG so we never ship a multi-MB PNG.
          if (blob && blob.type !== mimeType && mimeType === 'image/webp') {
            canvas.toBlob(finish, 'image/jpeg', quality);
            return;
          }
          finish(blob);
        },
        mimeType,
        quality
      );
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    // Load the image from file
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });
};

/**
 * Compresses multiple image files
 */
export const compressImages = async (
  files: File[],
  options: CompressionOptions = {}
): Promise<File[]> => {
  return Promise.all(files.map((file) => compressImage(file, options)));
};

/**
 * Creates a small thumbnail variant (400x500, q=0.7) for grid cards and order
 * thumbnails. Roughly 20-40 KB, which is plenty for a 4:5 card on a 3x screen.
 */
export const createThumbnail = (file: File): Promise<File> =>
  compressImage(file, { maxWidth: 400, maxHeight: 500, quality: 0.7 }).then((thumb) => {
    const ext = extensionForMime(thumb.type);
    return new File(
      [thumb],
      `${file.name.replace(/\.[^/.]+$/, '')}.thumb.${ext}`,
      { type: thumb.type, lastModified: Date.now() }
    );
  });
