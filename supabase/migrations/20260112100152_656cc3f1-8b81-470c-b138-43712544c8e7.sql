-- Add flag for premium/exceptional programs that require separate purchase
ALTER TABLE public.programs 
ADD COLUMN requires_separate_purchase boolean NOT NULL DEFAULT false;

-- Add a comment for clarity
COMMENT ON COLUMN public.programs.requires_separate_purchase IS 'When true, this program requires a separate purchase and is not accessible through any subscription plan alone';