-- =====================================================
-- UNIFIED CREDITS FOR INDIVIDUALS
-- Extend existing system to include plan credits
-- =====================================================

-- 1. Add credit allowance to plans
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS credit_allowance INTEGER DEFAULT NULL;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS credit_validity_months INTEGER DEFAULT 24;
COMMENT ON COLUMN public.plans.credit_allowance IS 'Number of credits included with this plan (NULL = feature-based only, no credits)';
COMMENT ON COLUMN public.plans.credit_validity_months IS 'How long credits are valid after subscription starts';

-- 2. Create user credit balances table
CREATE TABLE IF NOT EXISTS public.user_credit_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  available_credits INTEGER NOT NULL DEFAULT 0,
  total_received INTEGER NOT NULL DEFAULT 0,
  total_consumed INTEGER NOT NULL DEFAULT 0,
  reserved_credits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- 3. Create user credit transactions table (without subscription_id reference)
CREATE TABLE IF NOT EXISTS public.user_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  plan_id UUID REFERENCES public.plans(id),
  add_on_id UUID REFERENCES public.user_add_ons(id),
  enrollment_id UUID REFERENCES public.client_enrollments(id),
  description TEXT,
  action_type TEXT,
  action_reference_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create credit top-up packages
CREATE TABLE IF NOT EXISTS public.credit_topup_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  credit_value INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'eur',
  stripe_price_id TEXT,
  validity_months INTEGER DEFAULT 24,
  max_per_user INTEGER DEFAULT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Track individual credit purchases
CREATE TABLE IF NOT EXISTS public.user_credit_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id UUID REFERENCES public.credit_topup_packages(id),
  credits_purchased INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'eur',
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_user_credit_balances_user_id ON public.user_credit_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_user_credit_transactions_user_id ON public.user_credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_credit_transactions_type ON public.user_credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_user_credit_purchases_user_id ON public.user_credit_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_topup_packages_active ON public.credit_topup_packages(is_active);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.user_credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_topup_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_credit_purchases ENABLE ROW LEVEL SECURITY;

-- User credit balances
CREATE POLICY "Users can view their own credit balance" ON public.user_credit_balances
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all user credit balances" ON public.user_credit_balances
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- User credit transactions
CREATE POLICY "Users can view their own transactions" ON public.user_credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all user credit transactions" ON public.user_credit_transactions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Credit top-up packages
CREATE POLICY "Anyone can view active topup packages" ON public.credit_topup_packages
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage topup packages" ON public.credit_topup_packages
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- User credit purchases
CREATE POLICY "Users can view their own purchases" ON public.user_credit_purchases
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all user purchases" ON public.user_credit_purchases
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to get user's credit summary
CREATE OR REPLACE FUNCTION public.get_user_credit_summary(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance RECORD;
  v_plan_credits INTEGER := 0;
  v_plan RECORD;
  v_expiring_soon INTEGER := 0;
BEGIN
  -- Get or create balance record
  INSERT INTO user_credit_balances (user_id, available_credits, total_received)
  VALUES (p_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_balance
  FROM user_credit_balances
  WHERE user_id = p_user_id;

  -- Get user's plan with credits
  SELECT pl.* INTO v_plan
  FROM profiles p
  JOIN plans pl ON p.plan_id = pl.id
  WHERE p.id = p_user_id
    AND pl.credit_allowance IS NOT NULL;

  IF v_plan IS NOT NULL THEN
    v_plan_credits := v_plan.credit_allowance;
  END IF;

  -- Calculate credits expiring soon
  SELECT COALESCE(SUM(credits_purchased), 0) INTO v_expiring_soon
  FROM user_credit_purchases
  WHERE user_id = p_user_id
    AND status = 'completed'
    AND expires_at IS NOT NULL
    AND expires_at <= now() + interval '30 days'
    AND expires_at > now();

  RETURN jsonb_build_object(
    'available_credits', COALESCE(v_balance.available_credits, 0),
    'total_received', COALESCE(v_balance.total_received, 0),
    'total_consumed', COALESCE(v_balance.total_consumed, 0),
    'reserved_credits', COALESCE(v_balance.reserved_credits, 0),
    'expiring_soon', v_expiring_soon,
    'has_credit_plan', v_plan IS NOT NULL,
    'plan_name', v_plan.name,
    'plan_credit_allowance', v_plan_credits
  );
END;
$$;

-- Function to add credits to a user
CREATE OR REPLACE FUNCTION public.add_user_credits(
  p_user_id UUID,
  p_credit_amount INTEGER,
  p_transaction_type TEXT DEFAULT 'topup',
  p_description TEXT DEFAULT NULL,
  p_plan_id UUID DEFAULT NULL,
  p_add_on_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance RECORD;
  v_new_balance INTEGER;
BEGIN
  -- Get or create balance record
  INSERT INTO user_credit_balances (user_id, available_credits, total_received)
  VALUES (p_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_balance
  FROM user_credit_balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  v_new_balance := v_balance.available_credits + p_credit_amount;

  UPDATE user_credit_balances
  SET 
    available_credits = v_new_balance,
    total_received = total_received + p_credit_amount,
    updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO user_credit_transactions (
    user_id, transaction_type, amount, balance_after, plan_id, add_on_id, description
  ) VALUES (
    p_user_id, p_transaction_type, p_credit_amount, v_new_balance, p_plan_id, p_add_on_id,
    COALESCE(p_description, 'Credits added')
  );

  RETURN jsonb_build_object('success', true, 'added', p_credit_amount, 'balance_after', v_new_balance);
END;
$$;

-- Function to consume user credits
CREATE OR REPLACE FUNCTION public.consume_user_credits(
  p_user_id UUID,
  p_credit_amount INTEGER,
  p_action_type TEXT DEFAULT 'general',
  p_action_reference_id TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_enrollment_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance RECORD;
  v_new_balance INTEGER;
BEGIN
  SELECT * INTO v_balance
  FROM user_credit_balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No credit balance found');
  END IF;

  IF v_balance.available_credits < p_credit_amount THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Insufficient credits',
      'available', v_balance.available_credits,
      'required', p_credit_amount
    );
  END IF;

  v_new_balance := v_balance.available_credits - p_credit_amount;

  UPDATE user_credit_balances
  SET 
    available_credits = v_new_balance,
    total_consumed = total_consumed + p_credit_amount,
    updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO user_credit_transactions (
    user_id, transaction_type, amount, balance_after, enrollment_id, action_type, action_reference_id, description
  ) VALUES (
    p_user_id, 'consumption', -p_credit_amount, v_new_balance, p_enrollment_id, p_action_type, p_action_reference_id,
    COALESCE(p_description, 'Credits consumed')
  );

  RETURN jsonb_build_object('success', true, 'consumed', p_credit_amount, 'balance_after', v_new_balance);
END;
$$;

-- =====================================================
-- SEED DEFAULT DATA
-- =====================================================

INSERT INTO public.credit_topup_packages (name, slug, description, price_cents, credit_value, currency, validity_months, display_order, is_featured) VALUES
('Starter Top-Up', 'starter-topup', 'Quick credit boost', 50000, 55000, 'eur', 24, 1, false),
('Standard Top-Up', 'standard-topup', 'Best value top-up', 100000, 120000, 'eur', 24, 2, true),
('Premium Top-Up', 'premium-topup', 'Maximum savings', 200000, 260000, 'eur', 24, 3, false)
ON CONFLICT (slug) DO NOTHING;