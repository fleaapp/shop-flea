/**
 * Utility for image URL helpers.
 * Currently passes through original URLs since the external Supabase instance
 * doesn't support image transforms, which were causing images to appear zoomed/cropped.
 */

/**
 * Returns the image URL as-is. Previously attempted Supabase image transforms
 * but they caused cropping/zoom issues.
 */
export const getOptimizedImageUrl = (
  url: string | null | undefined
): string => {
  if (!url) return '';
  return url;
};

/**
 * Avatar image URL (pass-through).
 */
export const getAvatarUrl = (url: string | null | undefined): string =>
  getOptimizedImageUrl(url);

/**
 * Listing card thumbnail URL (pass-through).
 */
export const getCardImageUrl = (url: string | null | undefined): string =>
  getOptimizedImageUrl(url);

/**
 * Full listing detail image URL (pass-through).
 */
export const getDetailImageUrl = (url: string | null | undefined): string =>
  getOptimizedImageUrl(url);
