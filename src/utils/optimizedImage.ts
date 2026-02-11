/**
 * Utility for optimizing Supabase storage image URLs using image transforms.
 * Appends width/quality params to reduce payload size on mobile.
 */

const SUPABASE_STORAGE_HOST = 'dzglehiopfgfjmxtejve.supabase.co/storage';

/**
 * Returns an optimized version of a Supabase storage image URL.
 * For non-Supabase URLs (e.g. local assets), returns the original.
 */
export const getOptimizedImageUrl = (
  url: string | null | undefined,
  options: { width?: number; quality?: number } = {}
): string => {
  if (!url) return '';

  // Only transform Supabase storage URLs
  if (!url.includes(SUPABASE_STORAGE_HOST)) return url;

  const { width = 600, quality = 75 } = options;

  // Use Supabase image transform endpoint
  // Convert /storage/v1/object/public/... to /storage/v1/render/image/public/...
  const transformed = url.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/'
  );

  // Strip any existing query params (like cache-bust ?t=...) and rebuild
  const [base] = transformed.split('?');
  return `${base}?width=${width}&quality=${quality}`;
};

/**
 * Optimized URL for avatar-sized images (small, square).
 */
export const getAvatarUrl = (url: string | null | undefined): string =>
  getOptimizedImageUrl(url, { width: 128, quality: 70 });

/**
 * Optimized URL for listing card thumbnails.
 */
export const getCardImageUrl = (url: string | null | undefined): string =>
  getOptimizedImageUrl(url, { width: 400, quality: 75 });

/**
 * Optimized URL for full listing detail images.
 */
export const getDetailImageUrl = (url: string | null | undefined): string =>
  getOptimizedImageUrl(url, { width: 800, quality: 80 });
