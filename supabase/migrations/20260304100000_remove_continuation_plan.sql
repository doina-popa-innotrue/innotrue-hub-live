-- =============================================================================
-- REMOVE CONTINUATION PLAN: Safety-net migration
-- =============================================================================
-- The Continuation plan was deprecated when Alumni Lifecycle (2B.1) was added.
-- Alumni access is now an enrollment-level state — clients stay on their
-- current subscription plan and get read-only access to completed programs.
--
-- This migration moves any remaining users on the Continuation plan to Free,
-- since we have no record of their previous plan.
-- =============================================================================

-- Log any users still on Continuation (for admin review if needed)
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.profiles
  WHERE plan_id = (SELECT id FROM public.plans WHERE key = 'continuation');
  IF v_count > 0 THEN
    RAISE NOTICE 'Found % users on deprecated Continuation plan — moving to Free', v_count;
  END IF;
END $$;

-- Move any remaining Continuation users to Free plan
UPDATE public.profiles
SET plan_id = (SELECT id FROM public.plans WHERE key = 'free' LIMIT 1),
    updated_at = now()
WHERE plan_id = (SELECT id FROM public.plans WHERE key = 'continuation' LIMIT 1);
