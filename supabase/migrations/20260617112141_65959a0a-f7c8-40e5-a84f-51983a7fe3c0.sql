
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_reviewer_id uuid;
  v_sarah_id uuid;
  v_jcs_id uuid;
  v_au_region text;

  FUNCTION_BODY constant text := '';
BEGIN
  -- AU region
  SELECT id INTO v_au_region FROM public.regions WHERE id = 'au' OR id ILIKE 'au%' ORDER BY id LIMIT 1;
  IF v_au_region IS NULL THEN
    SELECT id INTO v_au_region FROM public.regions WHERE is_active = true ORDER BY id LIMIT 1;
  END IF;

  -- Sarah must exist
  SELECT id INTO v_sarah_id FROM auth.users WHERE email = 'sarahhearn02@gmail.com';
  IF v_sarah_id IS NULL THEN
    RAISE EXCEPTION 'Seller sarahhearn02@gmail.com not found';
  END IF;

  -- Create reviewer if missing
  SELECT id INTO v_reviewer_id FROM auth.users WHERE email = 'appreview@finditonflea.com';
  IF v_reviewer_id IS NULL THEN
    v_reviewer_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_user_meta_data, raw_app_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_reviewer_id, 'authenticated', 'authenticated',
      'appreview@finditonflea.com', crypt('FleaReview2026!', gen_salt('bf')),
      now(), now(), now(),
      jsonb_build_object('username', '@applereview', 'country_code', 'AU', 'region_id', v_au_region),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(), v_reviewer_id,
      jsonb_build_object('sub', v_reviewer_id::text, 'email', 'appreview@finditonflea.com', 'email_verified', true),
      'email', v_reviewer_id::text, now(), now(), now()
    );
  END IF;

  -- Create jcsbhearn seller if missing
  SELECT id INTO v_jcs_id FROM auth.users WHERE email = 'jcsbhearn@gmail.com';
  IF v_jcs_id IS NULL THEN
    v_jcs_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_user_meta_data, raw_app_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_jcs_id, 'authenticated', 'authenticated',
      'jcsbhearn@gmail.com', crypt('FleaReview2026!', gen_salt('bf')),
      now(), now(), now(),
      jsonb_build_object('username', '@jcsbhearn', 'country_code', 'AU', 'region_id', v_au_region),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(), v_jcs_id,
      jsonb_build_object('sub', v_jcs_id::text, 'email', 'jcsbhearn@gmail.com', 'email_verified', true),
      'email', v_jcs_id::text, now(), now(), now()
    );
  END IF;

  -- Ensure profiles exist (handle_new_user trigger handles new inserts, but guard)
  INSERT INTO public.profiles (user_id, username, email, country_code, region_id, auth_provider)
  VALUES (v_reviewer_id, '@applereview', 'appreview@finditonflea.com', 'AU', v_au_region, 'email')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.profiles (user_id, username, email, country_code, region_id, auth_provider)
  VALUES (v_jcs_id, '@jcsbhearn', 'jcsbhearn@gmail.com', 'AU', v_au_region, 'email')
  ON CONFLICT (user_id) DO NOTHING;

  -- Reviewer shipping address
  INSERT INTO public.buyer_addresses (user_id, first_name, last_name, address, suburb, state, postcode)
  VALUES (v_reviewer_id, 'App', 'Reviewer', '1 Apple Park Way', 'Sydney', 'NSW', '2000')
  ON CONFLICT (user_id) DO NOTHING;

  -- Seed Sarah's listings (skip if she already has [demo] listings)
  IF NOT EXISTS (SELECT 1 FROM public.listings WHERE user_id = v_sarah_id AND description LIKE '%[demo]%') THEN
    INSERT INTO public.listings (user_id, title, description, brand, size, category, condition, colour, price, shipping_price, images, status, country_code, region_id) VALUES
      (v_sarah_id, 'Linen blend midi dress', 'Worn twice, perfect condition. [demo]', 'aje', '8', 'dresses', 'like new', 'cream', 145.00, 12.00, ARRAY['https://shop-flea.lovable.app/placeholder.svg'], 'active', 'AU', v_au_region),
      (v_sarah_id, 'Vintage denim jeans', 'High-waisted, straight leg. [demo]', 'country road', '10', 'bottoms', 'good', 'blue', 55.00, 10.00, ARRAY['https://shop-flea.lovable.app/placeholder.svg'], 'active', 'AU', v_au_region),
      (v_sarah_id, 'Knit jumper', 'Cosy oversized knit. [demo]', 'assembly label', 'S', 'tops', 'like new', 'beige', 75.00, 10.00, ARRAY['https://shop-flea.lovable.app/placeholder.svg'], 'active', 'AU', v_au_region),
      (v_sarah_id, 'Leather crossbody bag', 'Soft tan leather, gold hardware. [demo]', 'seed heritage', 'One Size', 'bags', 'good', 'tan', 89.00, 12.00, ARRAY['https://shop-flea.lovable.app/placeholder.svg'], 'active', 'AU', v_au_region),
      (v_sarah_id, 'White sneakers', 'Classic low-tops. [demo]', 'adidas', '8', 'shoes', 'good', 'white', 65.00, 15.00, ARRAY['https://shop-flea.lovable.app/placeholder.svg'], 'active', 'AU', v_au_region);
  END IF;

  -- Seed JCS's listings (skip if already seeded)
  IF NOT EXISTS (SELECT 1 FROM public.listings WHERE user_id = v_jcs_id AND description LIKE '%[demo]%') THEN
    INSERT INTO public.listings (user_id, title, description, brand, size, category, condition, colour, price, shipping_price, images, status, country_code, region_id) VALUES
      (v_jcs_id, 'Cotton tee', 'Soft basic, lightly worn. [demo]', 'uniqlo', 'M', 'tops', 'like new', 'black', 25.00, 8.00, ARRAY['https://shop-flea.lovable.app/placeholder.svg'], 'active', 'AU', v_au_region),
      (v_jcs_id, 'Wool overcoat', 'Warm winter coat, classic cut. [demo]', 'zara', 'L', 'outerwear', 'good', 'charcoal', 180.00, 15.00, ARRAY['https://shop-flea.lovable.app/placeholder.svg'], 'active', 'AU', v_au_region),
      (v_jcs_id, 'Tailored chinos', 'Slim fit, easy to dress up or down. [demo]', 'cotton on', '32', 'bottoms', 'new', 'navy', 45.00, 10.00, ARRAY['https://shop-flea.lovable.app/placeholder.svg'], 'active', 'AU', v_au_region),
      (v_jcs_id, 'Leather belt', 'Genuine leather, brass buckle. [demo]', 'country road', 'M', 'accessories', 'like new', 'brown', 35.00, 6.00, ARRAY['https://shop-flea.lovable.app/placeholder.svg'], 'active', 'AU', v_au_region),
      (v_jcs_id, 'Running trainers', 'Lightweight runners, very comfortable. [demo]', 'nike', '10', 'shoes', 'good', 'grey', 80.00, 15.00, ARRAY['https://shop-flea.lovable.app/placeholder.svg'], 'active', 'AU', v_au_region);
  END IF;

  RAISE NOTICE 'Reviewer user id: %', v_reviewer_id;
  RAISE NOTICE 'Sarah user id: %', v_sarah_id;
  RAISE NOTICE 'JCS user id: %', v_jcs_id;
END $$;
