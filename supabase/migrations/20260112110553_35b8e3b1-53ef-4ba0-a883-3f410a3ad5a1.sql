-- Add new columns to profiles table for Edit Profile functionality
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS pause_selling BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS preferred_sizes TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS preferred_gender TEXT;