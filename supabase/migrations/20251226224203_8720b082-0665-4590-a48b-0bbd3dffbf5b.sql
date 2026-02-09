-- Add YouTube, Instagram, and Facebook social media link columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS youtube_url TEXT,
ADD COLUMN IF NOT EXISTS instagram_url TEXT,
ADD COLUMN IF NOT EXISTS facebook_url TEXT;