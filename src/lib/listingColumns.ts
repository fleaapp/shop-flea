/**
 * Shared column list for listing queries used by card/grid surfaces.
 *
 * Avoids `select('*')` so we never ship moderation-only columns (report_count)
 * to shoppers and keep list payloads predictable.
 */
export const LISTING_CARD_COLUMNS = [
  'id',
  'user_id',
  'title',
  'description',
  'brand',
  'size',
  'category',
  'subcategory',
  'condition',
  'colour',
  'style',
  'gender',
  'price',
  'shipping_price',
  'images',
  'thumbnails',
  'tags',
  'status',
  'country_code',
  'region_id',
  'created_at',
  'updated_at',
].join(', ');
