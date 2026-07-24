CREATE OR REPLACE FUNCTION public.get_home_feed(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS SETOF listings
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_region  text := public.get_user_region_id(auth.uid());
  v_signal_count int := 0;
  v_inactive_cutoff timestamptz := now() - interval '10 days';
BEGIN
  IF v_user_id IS NULL THEN
    -- Unauthenticated: newest active in-region listings, excluding blocked/paused/inactive sellers.
    RETURN QUERY
    SELECT l.*
    FROM public.listings l
    LEFT JOIN public.profiles p ON p.user_id = l.user_id
    WHERE l.status = 'active'
      AND (l.region_id IS NULL OR l.region_id = v_region)
      AND COALESCE(p.status, 'active') <> 'blocked'
      AND COALESCE(p.pause_selling, false) = false
      AND (p.last_sign_in_at IS NULL OR p.last_sign_in_at >= v_inactive_cutoff)
    ORDER BY l.created_at DESC
    LIMIT p_limit OFFSET p_offset;
    RETURN;
  END IF;

  SELECT
    (SELECT count(*) FROM public.cart_items  WHERE user_id = v_user_id) +
    (SELECT count(*) FROM public.favorites   WHERE user_id = v_user_id)
  INTO v_signal_count;

  RETURN QUERY
  WITH
  signals AS (
    SELECT l.brand, l.category, l.size, l.colour, l.price, 5::numeric AS w
    FROM public.cart_items c
    JOIN public.listings l ON l.id = c.listing_id
    WHERE c.user_id = v_user_id
    UNION ALL
    SELECT l.brand, l.category, l.size, l.colour, l.price, 3::numeric AS w
    FROM public.favorites f
    JOIN public.listings l ON l.id = f.listing_id
    WHERE f.user_id = v_user_id
  ),
  brand_w AS (
    SELECT lower(brand) AS k, sum(w) AS w FROM signals WHERE brand IS NOT NULL GROUP BY lower(brand)
  ),
  cat_w AS (
    SELECT lower(category) AS k, sum(w) AS w FROM signals WHERE category IS NOT NULL GROUP BY lower(category)
  ),
  size_w AS (
    SELECT lower(size) AS k, sum(w) AS w FROM signals WHERE size IS NOT NULL GROUP BY lower(size)
  ),
  colour_w AS (
    SELECT lower(colour) AS k, sum(w) AS w FROM signals WHERE colour IS NOT NULL GROUP BY lower(colour)
  ),
  price_band AS (
    SELECT
      percentile_cont(0.10) WITHIN GROUP (ORDER BY price) AS p10,
      percentile_cont(0.90) WITHIN GROUP (ORDER BY price) AS p90
    FROM signals
  ),
  engaged_ids AS (
    SELECT listing_id FROM public.cart_items WHERE user_id = v_user_id
    UNION
    SELECT listing_id FROM public.favorites  WHERE user_id = v_user_id
    UNION
    SELECT listing_id FROM public.discarded_listings WHERE user_id = v_user_id
  ),
  candidates AS (
    SELECT l.*
    FROM public.listings l
    LEFT JOIN public.profiles p ON p.user_id = l.user_id
    WHERE l.status = 'active'
      AND (l.region_id IS NULL OR l.region_id = v_region)
      AND l.user_id <> v_user_id
      AND l.id NOT IN (SELECT listing_id FROM engaged_ids)
      AND COALESCE(p.status, 'active') <> 'blocked'
      AND COALESCE(p.pause_selling, false) = false
      AND (p.last_sign_in_at IS NULL OR p.last_sign_in_at >= v_inactive_cutoff)
    ORDER BY l.created_at DESC
    LIMIT 500
  ),
  scored AS (
    SELECT
      c.*,
      (
        COALESCE((SELECT w FROM brand_w  WHERE k = lower(c.brand)),    0) * 4.0
      + COALESCE((SELECT w FROM cat_w    WHERE k = lower(c.category)), 0) * 3.0
      + COALESCE((SELECT w FROM size_w   WHERE k = lower(c.size)),     0) * 3.0
      + COALESCE((SELECT w FROM colour_w WHERE k = lower(c.colour)),   0) * 1.5
      + CASE
          WHEN (SELECT p10 FROM price_band) IS NOT NULL
           AND c.price BETWEEN (SELECT p10 FROM price_band) AND (SELECT p90 FROM price_band)
          THEN 1.0 ELSE 0
        END
      + exp(- EXTRACT(EPOCH FROM (now() - c.created_at)) / 3600.0 / 72.0) * 1.0
      ) AS personal_score,
      (
        exp(- EXTRACT(EPOCH FROM (now() - c.created_at)) / 3600.0 / 72.0) * 2.0
      + (
          SELECT COALESCE(sum(w), 0) FROM (
            SELECT 5::numeric AS w FROM public.cart_items ci
              WHERE ci.listing_id = c.id AND ci.created_at > now() - interval '7 days'
            UNION ALL
            SELECT 3::numeric AS w FROM public.favorites fv
              WHERE fv.listing_id = c.id AND fv.created_at > now() - interval '7 days'
          ) s
        ) * 0.5
      ) AS fresh_score
    FROM candidates c
  ),
  personal_ranked AS (
    SELECT s.*, row_number() OVER (ORDER BY personal_score DESC, created_at DESC) AS rn
    FROM scored s
    WHERE v_signal_count > 0 AND personal_score > 0
  ),
  fresh_ranked AS (
    SELECT s.*, row_number() OVER (ORDER BY fresh_score DESC, created_at DESC) AS rn
    FROM scored s
    WHERE NOT (v_signal_count > 0 AND personal_score > 0)
       OR s.id NOT IN (SELECT id FROM personal_ranked)
  ),
  slots AS (
    SELECT generate_series(1, p_offset + p_limit) AS slot
  ),
  picked AS (
    SELECT
      slot,
      CASE
        WHEN v_signal_count = 0 THEN 'fresh'
        WHEN (slot - 1) % 10 < 7 THEN 'personal'
        ELSE 'fresh'
      END AS bucket,
      CASE
        WHEN v_signal_count = 0 THEN 0
        WHEN (slot - 1) % 10 < 7 THEN ((slot - 1) - ((slot - 1) / 10) * 3)
        ELSE 0
      END AS p_rn_zero_based,
      CASE
        WHEN v_signal_count = 0 THEN slot
        WHEN (slot - 1) % 10 < 7 THEN 0
        ELSE ((slot - 1) / 10) * 3 + ((slot - 1) % 10 - 7) + 1
      END AS f_rn
    FROM slots
  ),
  merged AS (
    SELECT
      pk.slot,
      COALESCE(pr.id, fr.id) AS id
    FROM picked pk
    LEFT JOIN personal_ranked pr
      ON pk.bucket = 'personal' AND pr.rn = pk.p_rn_zero_based + 1
    LEFT JOIN fresh_ranked fr
      ON (pk.bucket = 'fresh' OR pr.id IS NULL) AND fr.rn = pk.f_rn
  ),
  fallback AS (
    SELECT
      m.slot,
      COALESCE(
        m.id,
        (
          SELECT fr2.id FROM fresh_ranked fr2
          WHERE fr2.id NOT IN (SELECT id FROM merged m2 WHERE m2.id IS NOT NULL AND m2.slot < m.slot)
          ORDER BY fr2.rn
          OFFSET 0 LIMIT 1
        )
      ) AS id
    FROM merged m
  ),
  deduped AS (
    SELECT DISTINCT ON (id) id, slot
    FROM fallback
    WHERE id IS NOT NULL
    ORDER BY id, slot
  ),
  ordered AS (
    SELECT id, slot FROM deduped ORDER BY slot
  )
  SELECT l.*
  FROM ordered o
  JOIN public.listings l ON l.id = o.id
  ORDER BY o.slot
  OFFSET p_offset LIMIT p_limit;
END;
$function$;