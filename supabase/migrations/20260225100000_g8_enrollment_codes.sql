-- G8: Self-Enrollment Codes
-- Enables admins to generate shareable enrollment codes per program.
-- Authenticated users redeem codes to self-enroll without admin intervention.

-- ============================================
-- 1. enrollment_codes table
-- ============================================
CREATE TABLE IF NOT EXISTS public.enrollment_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  cohort_id UUID REFERENCES public.program_cohorts(id) ON DELETE SET NULL,
  code TEXT NOT NULL UNIQUE,
  code_type TEXT NOT NULL DEFAULT 'single_use'
    CHECK (code_type IN ('single_use', 'multi_use')),
  max_uses INT,  -- null = unlimited (for multi_use)
  current_uses INT NOT NULL DEFAULT 0,
  grants_plan_id UUID REFERENCES public.plans(id),
  grants_tier TEXT,
  discount_percent INT CHECK (discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100)),
  is_free BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_enrollment_codes_code
  ON public.enrollment_codes(code);
CREATE INDEX IF NOT EXISTS idx_enrollment_codes_program
  ON public.enrollment_codes(program_id);

-- RLS
ALTER TABLE public.enrollment_codes ENABLE ROW LEVEL SECURITY;

-- Admin full CRUD
CREATE POLICY "Admins manage enrollment codes"
  ON public.enrollment_codes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can read active codes (needed for validation during redemption)
CREATE POLICY "Authenticated users can view active enrollment codes"
  ON public.enrollment_codes
  FOR SELECT TO authenticated
  USING (is_active = true);

-- ============================================
-- 2. Track enrollment source on client_enrollments
-- ============================================
ALTER TABLE public.client_enrollments
  ADD COLUMN IF NOT EXISTS enrollment_code_id UUID REFERENCES public.enrollment_codes(id);

-- ============================================
-- 3. Notification type for code redemption
-- ============================================
INSERT INTO notification_types (
  key,
  category_id,
  name,
  description,
  icon,
  is_active,
  email_template_key,
  order_index
)
SELECT
  'enrollment_code_redeemed',
  (SELECT id FROM notification_categories WHERE key = 'programs' LIMIT 1),
  'Enrollment Code Redeemed',
  'When someone uses an enrollment code you created',
  'ticket',
  true,
  'enrollment_code_redeemed',
  10
WHERE NOT EXISTS (
  SELECT 1 FROM notification_types WHERE key = 'enrollment_code_redeemed'
);

-- ============================================
-- 4. RPC: validate_enrollment_code
-- ============================================
-- Lightweight SECURITY DEFINER function for frontend validation.
-- Returns program info + code validity without side effects.
CREATE OR REPLACE FUNCTION public.validate_enrollment_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code RECORD;
BEGIN
  SELECT
    ec.*,
    p.name AS program_name,
    p.slug AS program_slug,
    p.description AS program_description,
    p.is_active AS program_is_active,
    pc.name AS cohort_name
  INTO v_code
  FROM enrollment_codes ec
  JOIN programs p ON p.id = ec.program_id
  LEFT JOIN program_cohorts pc ON pc.id = ec.cohort_id
  WHERE ec.code = UPPER(TRIM(p_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Code not found');
  END IF;

  IF NOT v_code.is_active THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This code is no longer active');
  END IF;

  IF NOT v_code.program_is_active THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This program is no longer available');
  END IF;

  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This code has expired');
  END IF;

  IF v_code.max_uses IS NOT NULL AND v_code.current_uses >= v_code.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This code has reached its usage limit');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'code_id', v_code.id,
    'program_id', v_code.program_id,
    'program_name', v_code.program_name,
    'program_slug', v_code.program_slug,
    'program_description', v_code.program_description,
    'cohort_id', v_code.cohort_id,
    'cohort_name', v_code.cohort_name,
    'grants_tier', v_code.grants_tier,
    'is_free', v_code.is_free,
    'discount_percent', v_code.discount_percent,
    'code_type', v_code.code_type
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_enrollment_code(text) TO authenticated;
