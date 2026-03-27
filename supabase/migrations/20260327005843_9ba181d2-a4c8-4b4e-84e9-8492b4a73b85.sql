
-- Create brands table
CREATE TABLE public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name text NOT NULL,
  display_name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  usage_count integer NOT NULL DEFAULT 0,
  UNIQUE (brand_name)
);

-- Enable RLS
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

-- Everyone can view brands
CREATE POLICY "Brands are viewable by everyone"
ON public.brands FOR SELECT
TO public
USING (true);

-- Authenticated users can insert new brands
CREATE POLICY "Authenticated users can add brands"
ON public.brands FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow usage_count updates
CREATE POLICY "Authenticated users can update brand usage"
ON public.brands FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Seed popular AU brands
INSERT INTO public.brands (brand_name, display_name) VALUES
  ('nike', 'Nike'),
  ('adidas', 'Adidas'),
  ('country road', 'Country Road'),
  ('glassons', 'Glassons'),
  ('princess polly', 'Princess Polly'),
  ('dissh', 'Dissh'),
  ('assembly label', 'Assembly Label'),
  ('kookai', 'Kookai'),
  ('aje', 'Aje'),
  ('bec + bridge', 'Bec + Bridge'),
  ('cotton on', 'Cotton On'),
  ('seed heritage', 'Seed Heritage'),
  ('zara', 'Zara'),
  ('uniqlo', 'Uniqlo'),
  ('h&m', 'H&M'),
  ('lorna jane', 'Lorna Jane'),
  ('pe nation', 'PE Nation'),
  ('rm williams', 'RM Williams'),
  ('rolla''s', 'Rolla''s'),
  ('lee', 'Lee'),
  ('levi''s', 'Levi''s'),
  ('kathmandu', 'Kathmandu'),
  ('the north face', 'The North Face'),
  ('stussy', 'Stussy'),
  ('nude lucy', 'Nude Lucy'),
  ('sheike', 'Sheike'),
  ('witchery', 'Witchery')
ON CONFLICT (brand_name) DO NOTHING;
