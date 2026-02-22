-- =============================================================================
-- 2B.2: Partner Codes MVP — tables, indexes, RLS, validation RPC
-- =============================================================================

-- 1. Partner codes table
CREATE TABLE IF NOT EXISTS public.partner_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES auth.users(id),
  program_id UUID NOT NULL REFERENCES public.programs(id),
  cohort_id UUID REFERENCES public.program_cohorts(id),
  code TEXT NOT NULL UNIQUE,
  label TEXT,
  discount_percent INT DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  is_free BOOLEAN NOT NULL DEFAULT false,
  max_uses INT,
  current_uses INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.partner_codes IS 'Referral codes created by admin for coaches/instructors to share with potential clients';
COMMENT ON COLUMN public.partner_codes.partner_id IS 'The coach/instructor this code belongs to';
COMMENT ON COLUMN public.partner_codes.label IS 'Friendly name e.g. "Spring 2026 Leadership Campaign"';

-- 2. Partner referrals tracking table
CREATE TABLE IF NOT EXISTS public.partner_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_code_id UUID NOT NULL REFERENCES public.partner_codes(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES auth.users(id),
  referred_user_id UUID NOT NULL REFERENCES auth.users(id),
  enrollment_id UUID REFERENCES public.client_enrollments(id),
  referral_type TEXT NOT NULL DEFAULT 'enrollment' CHECK (referral_type IN ('enrollment', 'signup')),
  status TEXT NOT NULL DEFAULT 'attributed' CHECK (status IN ('attributed', 'paid', 'void')),
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.partner_referrals IS 'Tracks each use of a partner code — attribution for future commission calculations';
COMMENT ON COLUMN public.partner_referrals.partner_id IS 'Denormalized from partner_codes for fast queries';
COMMENT ON COLUMN public.partner_referrals.status IS 'attributed = tracked, paid = commission paid, void = cancelled';

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_partner_codes_partner ON public.partner_codes(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_codes_program ON public.partner_codes(program_id);
CREATE INDEX IF NOT EXISTS idx_partner_codes_code ON public.partner_codes(code);
CREATE INDEX IF NOT EXISTS idx_partner_referrals_partner ON public.partner_referrals(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_referrals_code ON public.partner_referrals(partner_code_id);

-- 4. RLS
ALTER TABLE public.partner_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_referrals ENABLE ROW LEVEL SECURITY;

-- Partner codes: admins full CRUD
CREATE POLICY "Admins manage all partner codes"
  ON public.partner_codes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Partners view their own codes
CREATE POLICY "Partners view own codes"
  ON public.partner_codes FOR SELECT TO authenticated
  USING (partner_id = auth.uid());

-- Authenticated users can validate active codes (needed for public redemption)
CREATE POLICY "Authenticated users validate active codes"
  ON public.partner_codes FOR SELECT TO authenticated
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Partner referrals: admins full CRUD
CREATE POLICY "Admins manage all referrals"
  ON public.partner_referrals FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Partners view their own referrals
CREATE POLICY "Partners view own referrals"
  ON public.partner_referrals FOR SELECT TO authenticated
  USING (partner_id = auth.uid());

-- 5. Validate partner code RPC
CREATE OR REPLACE FUNCTION public.validate_partner_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_code_record record;
BEGIN
  SELECT pc.id, pc.partner_id, pc.program_id, pc.cohort_id,
         pc.code, pc.label, pc.discount_percent, pc.is_free,
         pc.max_uses, pc.current_uses,
         p.name AS program_name, p.slug AS program_slug,
         p.short_description AS program_description,
         prof.full_name AS partner_name
  INTO v_code_record
  FROM partner_codes pc
  JOIN programs p ON p.id = pc.program_id
  LEFT JOIN profiles prof ON prof.id = pc.partner_id
  WHERE pc.code = UPPER(TRIM(p_code))
    AND pc.is_active = true
    AND (pc.expires_at IS NULL OR pc.expires_at > now())
    AND (pc.max_uses IS NULL OR pc.current_uses < pc.max_uses);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid or expired partner code');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'code_id', v_code_record.id,
    'code', v_code_record.code,
    'program_id', v_code_record.program_id,
    'program_name', v_code_record.program_name,
    'program_slug', v_code_record.program_slug,
    'program_description', v_code_record.program_description,
    'cohort_id', v_code_record.cohort_id,
    'discount_percent', v_code_record.discount_percent,
    'is_free', v_code_record.is_free,
    'partner_id', v_code_record.partner_id,
    'partner_name', v_code_record.partner_name,
    'label', v_code_record.label
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_partner_code(text) TO authenticated;
