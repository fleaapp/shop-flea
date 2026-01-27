-- Add shipping address columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS shipping_first_name TEXT,
ADD COLUMN IF NOT EXISTS shipping_last_name TEXT,
ADD COLUMN IF NOT EXISTS shipping_address TEXT,
ADD COLUMN IF NOT EXISTS shipping_city TEXT,
ADD COLUMN IF NOT EXISTS shipping_state TEXT,
ADD COLUMN IF NOT EXISTS shipping_postcode TEXT;