/**
 * Utility for optimizing Supabase storage image URLs.
 * Uses Supabase CDN image transforms for thumbnails to drastically reduce payload.
 * Avatars pass through as-is (already compressed on upload).
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
  const [base, queryString] = transformed.split('?');
  const existingParams = queryString ? `&${queryString}` : '';
  return `${base}?width=${width}&quality=${quality}${existingParams}`;
};

/**
 * Avatar URL — pass-through since avatars are already compressed to 400x400 on upload.
 */
export const getAvatarUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  return url;
};

/**
 * Listing card thumbnail — pass-through (CDN transforms too slow on this plan).
 */
export const getCardImageUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  return url;
};

/**
 * Full listing detail image — pass-through.
 */
export const getDetailImageUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  return url;
};
