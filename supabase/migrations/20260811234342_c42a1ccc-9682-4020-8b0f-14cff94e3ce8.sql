DO $$
DECLARE v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'appreview@finditonflea.com';
  IF v_uid IS NULL THEN RETURN; END IF;
  INSERT INTO public.buyer_addresses (user_id, first_name, last_name, address, suburb, state, postcode)
  VALUES (v_uid, 'App', 'Reviewer', '1 Apple Park Way', 'Sydney', 'NSW', '2000')
  ON CONFLICT (user_id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    address = EXCLUDED.address,
    suburb = EXCLUDED.suburb,
    state = EXCLUDED.state,
    postcode = EXCLUDED.postcode,
    updated_at = now();
END $$;