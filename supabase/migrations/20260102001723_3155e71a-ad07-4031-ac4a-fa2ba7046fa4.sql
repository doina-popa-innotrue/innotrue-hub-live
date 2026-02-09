-- Add deadline field to decisions table (by when do I need to make the decision)
ALTER TABLE public.decisions ADD COLUMN deadline date;