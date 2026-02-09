-- Fix SECURITY DEFINER view by recreating with explicit security invoker
DROP VIEW IF EXISTS public.resource_credit_summary;

CREATE VIEW public.resource_credit_summary 
WITH (security_invoker = true)
AS
SELECT 
  r.id,
  r.canonical_id,
  r.title,
  r.resource_type,
  r.is_consumable,
  r.credit_cost,
  CASE 
    WHEN r.is_consumable AND (r.credit_cost IS NULL OR r.credit_cost = 0) THEN 'free'
    WHEN r.is_consumable THEN 'paid'
    ELSE 'unlimited'
  END as access_type
FROM public.resource_library r
WHERE r.is_active = true;

-- Grant select on view
GRANT SELECT ON public.resource_credit_summary TO authenticated;