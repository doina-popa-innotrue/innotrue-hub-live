-- Create helper functions for sponsored seat management

-- Function to count used sponsored seats for an organization
CREATE OR REPLACE FUNCTION public.get_org_sponsored_seat_count(p_organization_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM organization_members
  WHERE organization_id = p_organization_id
    AND is_active = true
    AND sponsored_plan_id IS NOT NULL;
$$;

-- Function to get org's max sponsored seats from their active subscription
CREATE OR REPLACE FUNCTION public.get_org_max_sponsored_seats(p_organization_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(t.max_sponsored_seats, 0)
  FROM org_platform_subscriptions s
  JOIN org_platform_tiers t ON t.id = s.tier_id
  WHERE s.organization_id = p_organization_id
    AND s.status = 'active'
  ORDER BY t.display_order DESC
  LIMIT 1;
$$;

-- Function to check if org can assign more sponsored seats
CREATE OR REPLACE FUNCTION public.can_assign_sponsored_seat(p_organization_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      -- Check if org has an active subscription with unlimited seats (NULL)
      WHEN EXISTS (
        SELECT 1 FROM org_platform_subscriptions s
        JOIN org_platform_tiers t ON t.id = s.tier_id
        WHERE s.organization_id = p_organization_id
          AND s.status = 'active'
          AND t.max_sponsored_seats IS NULL
      ) THEN true
      -- Otherwise check if current count < max
      ELSE public.get_org_sponsored_seat_count(p_organization_id) < public.get_org_max_sponsored_seats(p_organization_id)
    END;
$$;