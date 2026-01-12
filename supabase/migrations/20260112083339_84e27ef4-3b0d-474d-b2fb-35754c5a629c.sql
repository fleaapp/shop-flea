-- Add database constraints for listing validation to prevent invalid data insertion
-- This addresses the INPUT_VALIDATION security finding

-- Add CHECK constraints for price validation (must be positive and reasonable)
ALTER TABLE public.listings 
ADD CONSTRAINT listings_price_positive CHECK (price > 0 AND price < 1000000);

ALTER TABLE public.listings 
ADD CONSTRAINT listings_shipping_price_valid CHECK (shipping_price IS NULL OR (shipping_price >= 0 AND shipping_price < 10000));

-- Add length constraints using CHECK
ALTER TABLE public.listings 
ADD CONSTRAINT listings_title_length CHECK (length(title) <= 200);

ALTER TABLE public.listings 
ADD CONSTRAINT listings_description_length CHECK (description IS NULL OR length(description) <= 5000);

ALTER TABLE public.listings 
ADD CONSTRAINT listings_brand_length CHECK (length(brand) <= 100);

-- Add CHECK constraints for valid enum values (lowercase)
ALTER TABLE public.listings 
ADD CONSTRAINT listings_size_valid CHECK (
  size IN ('xs', 's', 'm', 'l', 'xl', 'xxl', 'one size')
);

ALTER TABLE public.listings 
ADD CONSTRAINT listings_category_valid CHECK (
  category IN ('tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'accessories', 'bags', 'other')
);

ALTER TABLE public.listings 
ADD CONSTRAINT listings_condition_valid CHECK (
  condition IN ('new', 'new with tags', 'like new', 'good', 'fair')
);

ALTER TABLE public.listings 
ADD CONSTRAINT listings_status_valid CHECK (
  status IN ('active', 'sold', 'archived', 'draft')
);

-- Add array length constraints for images (1-5 images required for active listings)
ALTER TABLE public.listings 
ADD CONSTRAINT listings_images_count CHECK (
  array_length(images, 1) IS NOT NULL AND 
  array_length(images, 1) >= 1 AND 
  array_length(images, 1) <= 10
);

-- Update handle_new_user function with input validation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username text;
  v_avatar_url text;
BEGIN
  -- Validate and sanitize username from metadata
  v_username := COALESCE(
    -- Limit username length and remove potentially dangerous characters
    regexp_replace(
      left(NEW.raw_user_meta_data->>'username', 50),
      '[^a-zA-Z0-9_@-]',
      '',
      'g'
    ),
    '@user_' || LEFT(NEW.id::text, 8)
  );
  
  -- Ensure username is not empty after sanitization
  IF length(v_username) = 0 THEN
    v_username := '@user_' || LEFT(NEW.id::text, 8);
  END IF;
  
  -- Generate safe avatar URL (using fixed pattern with user ID)
  v_avatar_url := 'https://api.dicebear.com/7.x/avataaars/svg?seed=' || NEW.id::text;
  
  INSERT INTO public.profiles (user_id, username, avatar_url)
  VALUES (
    NEW.id,
    v_username,
    v_avatar_url
  );
  
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;