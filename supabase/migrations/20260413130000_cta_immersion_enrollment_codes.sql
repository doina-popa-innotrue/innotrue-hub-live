-- CTA Immersion Programme — 4 Enrollment Codes
--
-- Programme: CTA Immersion (prod ID: c9f6fb62-6a9b-4daf-ba07-0ba7a78e1506)
-- Two tiers: Essentials + Premium
-- Two referral sources: InnoTrue (organic) + CloudEarly (partner)
--
-- These codes are free, multi-use, and do not expire.
-- They are used for referral tracking during the B2C launch.
--
-- Uses DO block: only inserts if the program exists in this environment
-- (program may not exist in preprod/sandbox).

DO $$
DECLARE
  v_program_id UUID;
  v_admin_id UUID;
BEGIN
  -- Look up program by known ID (production) or slug (other envs)
  SELECT id INTO v_program_id
  FROM public.programs
  WHERE id = 'c9f6fb62-6a9b-4daf-ba07-0ba7a78e1506'
     OR slug = 'cta-immersion'
  LIMIT 1;

  IF v_program_id IS NULL THEN
    RAISE NOTICE 'CTA Immersion programme not found — skipping enrollment code creation';
    RETURN;
  END IF;

  -- Get first admin user as code creator
  SELECT ur.user_id INTO v_admin_id
  FROM public.user_roles ur
  WHERE ur.role = 'admin'
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE NOTICE 'No admin user found — skipping enrollment code creation';
    RETURN;
  END IF;

  -- Insert 4 enrollment codes (idempotent via ON CONFLICT)
  INSERT INTO public.enrollment_codes (
    code, program_id, created_by,
    code_type, grants_tier, is_free, is_active,
    max_uses, discount_percent
  )
  VALUES
    ('CTAINNOTRUE-E',   v_program_id, v_admin_id, 'multi_use', 'Essentials', true, true, NULL, NULL),
    ('CTAINNOTRUE-P',   v_program_id, v_admin_id, 'multi_use', 'Premium',    true, true, NULL, NULL),
    ('CTACLOUDEARLY-E', v_program_id, v_admin_id, 'multi_use', 'Essentials', true, true, NULL, NULL),
    ('CTACLOUDEARLY-P', v_program_id, v_admin_id, 'multi_use', 'Premium',    true, true, NULL, NULL)
  ON CONFLICT (code) DO NOTHING;

  RAISE NOTICE 'CTA Immersion enrollment codes created for programme %', v_program_id;
END $$;
