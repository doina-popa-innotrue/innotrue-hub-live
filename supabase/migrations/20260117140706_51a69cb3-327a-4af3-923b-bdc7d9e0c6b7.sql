-- Update existing platform tiers with default sponsored seat limits
UPDATE public.org_platform_tiers
SET max_sponsored_seats = CASE
  WHEN name ILIKE '%starter%' THEN 5
  WHEN name ILIKE '%pro%' THEN 25
  WHEN name ILIKE '%enterprise%' THEN NULL -- NULL means unlimited
  ELSE 10 -- Default for other tiers
END
WHERE max_sponsored_seats IS NULL;