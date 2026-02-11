/**
 * Utility for optimizing Supabase storage image URLs.
 * Avatars use Supabase image transforms (small square crops are fine).
 * Listing images pass through as-is to avoid unwanted cropping.
 */

const SUPABASE_STORAGE_HOST = 'dzglehiopfgfjmxtejve.supabase.co/storage';

const getTransformedUrl = (
  url: string,
  width: number,
  quality: number
): string => {
  if (!url.includes(SUPABASE_STORAGE_HOST)) return url;

  const transformed = url.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/'
  );
  const [base] = transformed.split('?');
  return `${base}?width=${width}&quality=${quality}`;
};

/**
 * Optimized URL for avatar-sized images (small, square — safe to resize).
 */
export const getAvatarUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  return getTransformedUrl(url, 128, 70);
};

/**
 * Listing card thumbnail — pass-through to avoid cropping.
 */
export const getCardImageUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  return url;
};

/**
 * Full listing detail image — pass-through to avoid cropping.
 */
export const getDetailImageUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  return url;
};
