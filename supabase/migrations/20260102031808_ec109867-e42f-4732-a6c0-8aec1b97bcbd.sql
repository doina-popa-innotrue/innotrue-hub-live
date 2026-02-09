-- Add key column to add_ons table
ALTER TABLE public.add_ons ADD COLUMN key TEXT;

-- Make key unique and not null after populating existing rows
UPDATE public.add_ons SET key = LOWER(REPLACE(name, ' ', '_')) WHERE key IS NULL;

ALTER TABLE public.add_ons ALTER COLUMN key SET NOT NULL;
CREATE UNIQUE INDEX idx_add_ons_key ON public.add_ons(key);