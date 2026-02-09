-- Add scheduling_url column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS scheduling_url TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.scheduling_url IS 'URL to user scheduling app (Calendly, Cal.com, etc.)';