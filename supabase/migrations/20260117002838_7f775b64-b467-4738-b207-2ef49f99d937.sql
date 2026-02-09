-- =====================================================
-- ORGANIZATION CREDITS SYSTEM
-- Platform Fee + Credits Model for B2B Organizations
-- =====================================================

-- 1. Credit Packages (products orgs can purchase)
CREATE TABLE public.org_credit_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  -- Purchase price in cents (what they pay)
  price_cents INTEGER NOT NULL DEFAULT 0,
  -- Credit value they receive (enables bonus credits)
  credit_value INTEGER NOT NULL DEFAULT 0,
  -- Currency
  currency TEXT NOT NULL DEFAULT 'eur',
  -- Stripe price ID for this package
  stripe_price_id TEXT,
  -- Validity period in months (NULL = never expires)
  validity_months INTEGER DEFAULT 24,
  -- Display order
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Platform Fee Tiers (annual/monthly subscription for platform access)
CREATE TABLE public.org_platform_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  -- Annual fee in cents
  annual_fee_cents INTEGER NOT NULL DEFAULT 0,
  -- Monthly fee in cents (optional, for monthly billing)
  monthly_fee_cents INTEGER DEFAULT NULL,
  currency TEXT NOT NULL DEFAULT 'eur',
  -- Stripe price IDs
  stripe_annual_price_id TEXT,
  stripe_monthly_price_id TEXT,
  -- Features included
  features JSONB DEFAULT '[]'::jsonb,
  -- Max team members (NULL = unlimited)
  max_members INTEGER DEFAULT NULL,
  -- Include analytics dashboard
  includes_analytics BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Organization Platform Subscriptions
CREATE TABLE public.org_platform_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tier_id UUID REFERENCES public.org_platform_tiers(id),
  -- Stripe subscription ID
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  -- Billing info
  billing_email TEXT,
  billing_period TEXT DEFAULT 'annual', -- 'annual' or 'monthly'
  -- Subscription dates
  starts_at TIMESTAMPTZ DEFAULT now(),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  -- Status
  status TEXT DEFAULT 'active', -- active, past_due, canceled, expired
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id)
);

-- 4. Organization Credit Balances (current balance per org)
CREATE TABLE public.org_credit_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Current available credits
  available_credits INTEGER NOT NULL DEFAULT 0,
  -- Total credits ever purchased
  total_purchased INTEGER NOT NULL DEFAULT 0,
  -- Total credits consumed
  total_consumed INTEGER NOT NULL DEFAULT 0,
  -- Reserved credits (pending enrollments)
  reserved_credits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id)
);

-- 5. Organization Credit Purchases (history of purchases)
CREATE TABLE public.org_credit_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  package_id UUID REFERENCES public.org_credit_packages(id),
  -- Credits added
  credits_purchased INTEGER NOT NULL,
  -- Amount paid (in cents)
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'eur',
  -- Stripe payment info
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  -- Expiry
  expires_at TIMESTAMPTZ,
  -- Status
  status TEXT DEFAULT 'completed', -- pending, completed, refunded
  -- Who purchased
  purchased_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Organization Credit Transactions (all credit movements)
CREATE TABLE public.org_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Transaction type
  transaction_type TEXT NOT NULL, -- 'purchase', 'consumption', 'refund', 'adjustment', 'expiry'
  -- Credit amount (positive for additions, negative for deductions)
  amount INTEGER NOT NULL,
  -- Running balance after this transaction
  balance_after INTEGER NOT NULL,
  -- Reference to related records
  purchase_id UUID REFERENCES public.org_credit_purchases(id),
  enrollment_id UUID REFERENCES public.client_enrollments(id),
  -- Description
  description TEXT,
  -- Who performed this action
  performed_by UUID REFERENCES auth.users(id),
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Program Credit Costs (how many credits each program costs)
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS credit_cost INTEGER DEFAULT NULL;
COMMENT ON COLUMN public.programs.credit_cost IS 'Number of organization credits required to enroll one person in this program';

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_org_credit_balances_org_id ON public.org_credit_balances(organization_id);
CREATE INDEX idx_org_credit_purchases_org_id ON public.org_credit_purchases(organization_id);
CREATE INDEX idx_org_credit_purchases_status ON public.org_credit_purchases(status);
CREATE INDEX idx_org_credit_transactions_org_id ON public.org_credit_transactions(organization_id);
CREATE INDEX idx_org_credit_transactions_type ON public.org_credit_transactions(transaction_type);
CREATE INDEX idx_org_platform_subscriptions_org_id ON public.org_platform_subscriptions(organization_id);
CREATE INDEX idx_org_platform_subscriptions_status ON public.org_platform_subscriptions(status);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.org_credit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_platform_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_platform_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_credit_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_credit_transactions ENABLE ROW LEVEL SECURITY;

-- Credit Packages: viewable by all authenticated, managed by admins
CREATE POLICY "Anyone can view active credit packages" ON public.org_credit_packages
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage credit packages" ON public.org_credit_packages
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Platform Tiers: viewable by all authenticated, managed by admins
CREATE POLICY "Anyone can view active platform tiers" ON public.org_platform_tiers
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage platform tiers" ON public.org_platform_tiers
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Platform Subscriptions: org admins can view their own, platform admins can manage all
CREATE POLICY "Org admins can view their subscription" ON public.org_platform_subscriptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = org_platform_subscriptions.organization_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('org_admin', 'org_manager')
    )
  );

CREATE POLICY "Platform admins can manage all subscriptions" ON public.org_platform_subscriptions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Credit Balances: org admins can view their own, platform admins can manage all
CREATE POLICY "Org admins can view their credit balance" ON public.org_credit_balances
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = org_credit_balances.organization_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('org_admin', 'org_manager')
    )
  );

CREATE POLICY "Platform admins can manage all credit balances" ON public.org_credit_balances
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Credit Purchases: org admins can view their own, platform admins can manage all
CREATE POLICY "Org admins can view their purchases" ON public.org_credit_purchases
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = org_credit_purchases.organization_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('org_admin', 'org_manager')
    )
  );

CREATE POLICY "Platform admins can manage all purchases" ON public.org_credit_purchases
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Credit Transactions: org admins can view their own, platform admins can manage all
CREATE POLICY "Org admins can view their transactions" ON public.org_credit_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = org_credit_transactions.organization_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('org_admin', 'org_manager')
    )
  );

CREATE POLICY "Platform admins can manage all transactions" ON public.org_credit_transactions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to consume org credits for an enrollment
CREATE OR REPLACE FUNCTION public.consume_org_credits(
  p_organization_id UUID,
  p_credit_amount INTEGER,
  p_enrollment_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_performed_by UUID DEFAULT NULL
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
  -- Lock the balance row to prevent race conditions
  SELECT * INTO v_balance
  FROM org_credit_balances
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  -- Check if org has a balance record
  IF v_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Organization has no credit balance');
  END IF;

  -- Check if sufficient credits
  IF v_balance.available_credits < p_credit_amount THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Insufficient credits',
      'available', v_balance.available_credits,
      'required', p_credit_amount
    );
  END IF;

  -- Calculate new balance
  v_new_balance := v_balance.available_credits - p_credit_amount;

  -- Update balance
  UPDATE org_credit_balances
  SET 
    available_credits = v_new_balance,
    total_consumed = total_consumed + p_credit_amount,
    updated_at = now()
  WHERE organization_id = p_organization_id;

  -- Record transaction
  INSERT INTO org_credit_transactions (
    organization_id,
    transaction_type,
    amount,
    balance_after,
    enrollment_id,
    description,
    performed_by
  ) VALUES (
    p_organization_id,
    'consumption',
    -p_credit_amount,
    v_new_balance,
    p_enrollment_id,
    COALESCE(p_description, 'Program enrollment'),
    COALESCE(p_performed_by, auth.uid())
  );

  RETURN jsonb_build_object(
    'success', true,
    'consumed', p_credit_amount,
    'balance_after', v_new_balance
  );
END;
$$;

-- Function to add credits after a purchase
CREATE OR REPLACE FUNCTION public.add_org_credits(
  p_organization_id UUID,
  p_credit_amount INTEGER,
  p_purchase_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_performed_by UUID DEFAULT NULL
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
  INSERT INTO org_credit_balances (organization_id, available_credits, total_purchased)
  VALUES (p_organization_id, 0, 0)
  ON CONFLICT (organization_id) DO NOTHING;

  -- Lock the balance row
  SELECT * INTO v_balance
  FROM org_credit_balances
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  -- Calculate new balance
  v_new_balance := v_balance.available_credits + p_credit_amount;

  -- Update balance
  UPDATE org_credit_balances
  SET 
    available_credits = v_new_balance,
    total_purchased = total_purchased + p_credit_amount,
    updated_at = now()
  WHERE organization_id = p_organization_id;

  -- Record transaction
  INSERT INTO org_credit_transactions (
    organization_id,
    transaction_type,
    amount,
    balance_after,
    purchase_id,
    description,
    performed_by
  ) VALUES (
    p_organization_id,
    'purchase',
    p_credit_amount,
    v_new_balance,
    p_purchase_id,
    COALESCE(p_description, 'Credit package purchase'),
    COALESCE(p_performed_by, auth.uid())
  );

  RETURN jsonb_build_object(
    'success', true,
    'added', p_credit_amount,
    'balance_after', v_new_balance
  );
END;
$$;

-- Function to get org credit summary
CREATE OR REPLACE FUNCTION public.get_org_credit_summary(p_organization_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance RECORD;
  v_subscription RECORD;
  v_expiring_credits INTEGER;
BEGIN
  -- Get balance
  SELECT * INTO v_balance
  FROM org_credit_balances
  WHERE organization_id = p_organization_id;

  -- Get subscription
  SELECT * INTO v_subscription
  FROM org_platform_subscriptions
  WHERE organization_id = p_organization_id;

  -- Calculate credits expiring in next 30 days
  SELECT COALESCE(SUM(credits_purchased), 0) INTO v_expiring_credits
  FROM org_credit_purchases
  WHERE organization_id = p_organization_id
    AND status = 'completed'
    AND expires_at IS NOT NULL
    AND expires_at <= now() + interval '30 days'
    AND expires_at > now();

  RETURN jsonb_build_object(
    'available_credits', COALESCE(v_balance.available_credits, 0),
    'total_purchased', COALESCE(v_balance.total_purchased, 0),
    'total_consumed', COALESCE(v_balance.total_consumed, 0),
    'reserved_credits', COALESCE(v_balance.reserved_credits, 0),
    'expiring_soon', v_expiring_credits,
    'has_platform_subscription', v_subscription IS NOT NULL AND v_subscription.status = 'active',
    'subscription_status', v_subscription.status,
    'subscription_ends', v_subscription.current_period_end
  );
END;
$$;

-- =====================================================
-- SEED DEFAULT DATA
-- =====================================================

-- Insert default credit packages
INSERT INTO public.org_credit_packages (name, slug, description, price_cents, credit_value, currency, validity_months, display_order) VALUES
('Starter Package', 'starter', 'Perfect for trying out the platform', 2500000, 3000000, 'eur', 24, 1),
('Growth Package', 'growth', 'Best value for growing teams', 5000000, 6500000, 'eur', 24, 2),
('Enterprise Package', 'enterprise', 'Maximum flexibility and savings', 10000000, 14000000, 'eur', 24, 3);

-- Insert default platform tiers
INSERT INTO public.org_platform_tiers (name, slug, description, annual_fee_cents, monthly_fee_cents, currency, features, display_order) VALUES
('Essentials', 'essentials', 'Core platform access for small teams', 300000, 30000, 'eur', '["Organization dashboard", "Basic analytics", "Up to 10 members", "Email support"]'::jsonb, 1),
('Professional', 'professional', 'Advanced features for growing organizations', 500000, 50000, 'eur', '["Everything in Essentials", "Advanced analytics", "Up to 50 members", "Priority support", "Custom branding"]'::jsonb, 2);