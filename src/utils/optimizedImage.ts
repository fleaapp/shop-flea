/**
 * Utility for optimizing Supabase storage image URLs.
 * All URLs are direct storage object URLs - the render/image CDN is slower on this plan.
 * Avatars pass through as-is (already compressed on upload).
 */

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
 * Grid fallback — only for listings with no stored thumbnail.
 * Pass-through: the Supabase render/image CDN is slower than the original
 * object on this plan and distorts the 4:5 crop, so we never use it.
 */
export const getGridFallbackUrl = (url: string | null | undefined): string => {
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
