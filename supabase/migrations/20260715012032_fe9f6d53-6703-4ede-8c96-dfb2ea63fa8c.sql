-- Dedupe brands keeping the earliest per normalized brand_name, then enforce uniqueness
WITH ranked AS (
  SELECT id, brand_name,
         row_number() OVER (PARTITION BY lower(trim(brand_name)) ORDER BY created_at ASC, id ASC) AS rn
  FROM public.brands
),
dupes AS (
  SELECT id FROM ranked WHERE rn > 1
),
keepers AS (
  SELECT lower(trim(brand_name)) AS key,
         (SELECT id FROM ranked r2 WHERE lower(trim(r2.brand_name)) = lower(trim(b.brand_name)) AND r2.rn = 1 LIMIT 1) AS keep_id
  FROM public.brands b
  GROUP BY lower(trim(b.brand_name)), b.brand_name
)
UPDATE public.listings l
SET brand = (SELECT b.display_name FROM public.brands b WHERE b.id = k.keep_id)
FROM public.brands d
JOIN keepers k ON lower(trim(d.brand_name)) = k.key
WHERE d.id IN (SELECT id FROM dupes)
  AND l.brand = d.display_name;

DELETE FROM public.brands
WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY lower(trim(brand_name)) ORDER BY created_at ASC, id ASC) AS rn
    FROM public.brands
  ) x WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS brands_brand_name_unique_ci
  ON public.brands (lower(trim(brand_name)));
