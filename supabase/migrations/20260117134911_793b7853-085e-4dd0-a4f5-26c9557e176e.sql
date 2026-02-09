-- Add max_sponsored_seats column to org_platform_tiers
ALTER TABLE public.org_platform_tiers 
ADD COLUMN max_sponsored_seats INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.org_platform_tiers.max_sponsored_seats IS 
'Maximum number of sponsored seats included in this tier. NULL means unlimited, 0 means none.';