-- Add is_pinned column to announcements table
ALTER TABLE public.announcements 
ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.announcements.is_pinned IS 'Pinned announcements are always shown at the top of the widget';