-- Create discount codes table for program enrollment discounts
CREATE TABLE public.discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed_amount')),
  discount_value NUMERIC NOT NULL CHECK (discount_value > 0),
  -- Scope: null = all programs/tiers, array = specific ones
  valid_for_program_ids UUID[] DEFAULT NULL,
  valid_for_tier_names TEXT[] DEFAULT NULL,
  -- Usage limits
  max_uses INTEGER DEFAULT NULL, -- null = unlimited
  uses_count INTEGER DEFAULT 0,
  -- Optional: restrict to specific user
  assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT NULL,
  assigned_user_email TEXT DEFAULT NULL,
  -- Validity
  starts_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  is_active BOOLEAN DEFAULT true,
  -- Tracking
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for fast code lookups
CREATE INDEX idx_discount_codes_code ON public.discount_codes(code);
CREATE INDEX idx_discount_codes_active ON public.discount_codes(is_active, expires_at);

-- Track discount code usage
CREATE TABLE public.discount_code_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_code_id UUID NOT NULL REFERENCES public.discount_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES public.client_enrollments(id) ON DELETE SET NULL,
  program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  tier_name TEXT,
  original_price_credits INTEGER,
  discount_amount_credits INTEGER,
  final_price_credits INTEGER,
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(discount_code_id, user_id, enrollment_id)
);

-- Enable RLS
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_code_uses ENABLE ROW LEVEL SECURITY;

-- Policies for discount_codes (admin read/write, users can validate)
CREATE POLICY "Admins can manage discount codes"
ON public.discount_codes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read active discount codes"
ON public.discount_codes
FOR SELECT
TO authenticated
USING (is_active = true);

-- Policies for discount_code_uses
CREATE POLICY "Users can view their own discount usage"
ON public.discount_code_uses
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all discount usage"
ON public.discount_code_uses
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert discount usage"
ON public.discount_code_uses
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Function to validate and apply a discount code
CREATE OR REPLACE FUNCTION public.validate_discount_code(
  p_code TEXT,
  p_program_id UUID,
  p_tier_name TEXT,
  p_user_id UUID
)
RETURNS TABLE (
  is_valid BOOLEAN,
  discount_code_id UUID,
  discount_type TEXT,
  discount_value NUMERIC,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code RECORD;
BEGIN
  -- Find the discount code
  SELECT * INTO v_code
  FROM public.discount_codes dc
  WHERE UPPER(dc.code) = UPPER(p_code)
  AND dc.is_active = true;

  IF v_code IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::NUMERIC, 'Invalid discount code'::TEXT;
    RETURN;
  END IF;

  -- Check expiry
  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::NUMERIC, 'Discount code has expired'::TEXT;
    RETURN;
  END IF;

  -- Check start date
  IF v_code.starts_at > now() THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::NUMERIC, 'Discount code is not yet active'::TEXT;
    RETURN;
  END IF;

  -- Check usage limit
  IF v_code.max_uses IS NOT NULL AND v_code.uses_count >= v_code.max_uses THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::NUMERIC, 'Discount code has reached its usage limit'::TEXT;
    RETURN;
  END IF;

  -- Check if assigned to specific user
  IF v_code.assigned_user_id IS NOT NULL AND v_code.assigned_user_id != p_user_id THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::NUMERIC, 'This discount code is not valid for your account'::TEXT;
    RETURN;
  END IF;

  -- Check program restriction
  IF v_code.valid_for_program_ids IS NOT NULL AND NOT (p_program_id = ANY(v_code.valid_for_program_ids)) THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::NUMERIC, 'Discount code is not valid for this program'::TEXT;
    RETURN;
  END IF;

  -- Check tier restriction
  IF v_code.valid_for_tier_names IS NOT NULL AND NOT (p_tier_name = ANY(v_code.valid_for_tier_names)) THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::NUMERIC, 'Discount code is not valid for this tier'::TEXT;
    RETURN;
  END IF;

  -- Check if user already used this code (one use per user per code)
  IF EXISTS (
    SELECT 1 FROM public.discount_code_uses
    WHERE discount_code_id = v_code.id AND user_id = p_user_id
  ) THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::NUMERIC, 'You have already used this discount code'::TEXT;
    RETURN;
  END IF;

  -- Valid!
  RETURN QUERY SELECT 
    true, 
    v_code.id, 
    v_code.discount_type, 
    v_code.discount_value, 
    NULL::TEXT;
END;
$$;

-- Add discount tracking to client_enrollments
ALTER TABLE public.client_enrollments 
ADD COLUMN IF NOT EXISTS discount_code_id UUID REFERENCES public.discount_codes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS discount_percent NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS original_credit_cost INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS final_credit_cost INTEGER DEFAULT NULL;