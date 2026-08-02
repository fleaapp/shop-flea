/**
 * Shared column list for listing queries used by card/grid surfaces.
 *
 * Avoids `select('*')` so we never ship moderation-only columns (report_count)
 * to shoppers and keep list payloads predictable.
 *
 * NOTE: must stay a literal `as const` string — the generated Supabase types
 * infer the row shape from the literal, and a computed string collapses to
 * `GenericStringError`.
 */
export const LISTING_CARD_COLUMNS =
  'id, user_id, title, description, brand, size, category, subcategory, condition, colour, style, gender, price, shipping_price, images, thumbnails, tags, status, country_code, region_id, created_at, updated_at' as const;
