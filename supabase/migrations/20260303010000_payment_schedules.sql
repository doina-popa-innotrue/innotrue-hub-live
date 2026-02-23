-- =============================================================================
-- PAYMENT SCHEDULES: Installment plan tracking for program enrollments
-- =============================================================================
-- Tracks Stripe subscription-as-instalment lifecycle per enrollment.
-- Credits are consumed UPFRONT at enrollment time. This table only tracks
-- the EUR payment obligation side. If a payment fails, the enrollment's
-- payment_status is flipped to 'outstanding' → content is locked.
-- =============================================================================

-- 1. payment_schedules table
CREATE TABLE IF NOT EXISTS public.payment_schedules (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id           UUID NOT NULL REFERENCES public.client_enrollments(id) ON DELETE CASCADE,
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Stripe references
  stripe_subscription_id  TEXT NOT NULL,
  stripe_customer_id      TEXT,
  -- Financial details
  total_amount_cents      INTEGER NOT NULL,         -- Total EUR owed (e.g. 850000 = EUR 8,500)
  currency                TEXT NOT NULL DEFAULT 'eur',
  installment_count       INTEGER NOT NULL,          -- Total number of instalments (e.g. 3, 6, 12)
  installment_amount_cents INTEGER NOT NULL,         -- Per-instalment amount (e.g. 283333)
  installments_paid       INTEGER NOT NULL DEFAULT 0,-- How many have been paid so far
  amount_paid_cents       INTEGER NOT NULL DEFAULT 0,-- Total EUR actually received
  -- Dates
  next_payment_date       TIMESTAMPTZ,               -- When the next instalment is due
  started_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at            TIMESTAMPTZ,               -- Set when all instalments paid
  cancelled_at            TIMESTAMPTZ,               -- Set if cancelled/defaulted
  -- Status tracking
  status                  TEXT NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'completed', 'defaulted', 'cancelled')),
  -- Credit tracking (for reference — credits are consumed upfront)
  credit_package_id       UUID,                      -- Which top-up package was used (if any)
  credits_granted         INTEGER NOT NULL DEFAULT 0,-- Total credits granted at enrollment
  -- Metadata
  metadata                JSONB DEFAULT '{}'::jsonb,  -- Flexible storage for Stripe metadata
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_payment_schedules_enrollment
  ON public.payment_schedules(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_payment_schedules_user
  ON public.payment_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_schedules_stripe_sub
  ON public.payment_schedules(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_schedules_status
  ON public.payment_schedules(status) WHERE status = 'active';

-- Auto-update updated_at
CREATE OR REPLACE TRIGGER update_payment_schedules_updated_at
  BEFORE UPDATE ON public.payment_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 2. RLS Policies
ALTER TABLE public.payment_schedules ENABLE ROW LEVEL SECURITY;

-- Users can view their own payment schedules
CREATE POLICY "Users can view own payment schedules"
  ON public.payment_schedules FOR SELECT
  USING (auth.uid() = user_id);

-- Admins (via service_role) can do everything
CREATE POLICY "Service role full access on payment_schedules"
  ON public.payment_schedules FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- 3. Per-program installment configuration
-- Stores which installment options are available for each program
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS installment_options JSONB DEFAULT NULL;
  -- Example: [{"months": 3, "label": "3 monthly payments"}, {"months": 6}, {"months": 12}]
  -- NULL = installments not available for this program

-- 4. Add upfront_discount_percent to programs for pay-in-full incentive
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS upfront_discount_percent NUMERIC DEFAULT 0
    CHECK (upfront_discount_percent >= 0 AND upfront_discount_percent <= 100);

-- 5. Add stripe_subscription_id to client_enrollments for linking
ALTER TABLE public.client_enrollments
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- 6. Helper function: update enrollment payment status from webhook
CREATE OR REPLACE FUNCTION public.update_installment_payment_status(
  p_stripe_subscription_id TEXT,
  p_new_status TEXT,  -- 'paid', 'outstanding', 'overdue'
  p_installment_amount_cents INTEGER DEFAULT NULL,
  p_next_payment_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule payment_schedules%ROWTYPE;
  v_enrollment client_enrollments%ROWTYPE;
BEGIN
  -- Find the active payment schedule
  SELECT * INTO v_schedule
  FROM payment_schedules
  WHERE stripe_subscription_id = p_stripe_subscription_id
    AND status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active schedule found for subscription');
  END IF;

  -- Update enrollment payment_status
  UPDATE client_enrollments
  SET payment_status = p_new_status,
      updated_at = now()
  WHERE id = v_schedule.enrollment_id
  RETURNING * INTO v_enrollment;

  -- If marking a payment as received, increment installments_paid
  IF p_new_status = 'paid' AND p_installment_amount_cents IS NOT NULL THEN
    UPDATE payment_schedules
    SET installments_paid = installments_paid + 1,
        amount_paid_cents = amount_paid_cents + p_installment_amount_cents,
        next_payment_date = p_next_payment_date,
        -- Mark completed if all instalments are paid
        status = CASE
          WHEN installments_paid + 1 >= installment_count THEN 'completed'
          ELSE 'active'
        END,
        completed_at = CASE
          WHEN installments_paid + 1 >= installment_count THEN now()
          ELSE NULL
        END,
        updated_at = now()
    WHERE id = v_schedule.id;
  END IF;

  -- If defaulting, mark schedule as defaulted
  IF p_new_status = 'overdue' THEN
    UPDATE payment_schedules
    SET status = 'defaulted',
        cancelled_at = now(),
        updated_at = now()
    WHERE id = v_schedule.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'enrollment_id', v_schedule.enrollment_id,
    'user_id', v_schedule.user_id,
    'installments_paid', v_schedule.installments_paid + (CASE WHEN p_new_status = 'paid' AND p_installment_amount_cents IS NOT NULL THEN 1 ELSE 0 END),
    'installment_count', v_schedule.installment_count,
    'new_payment_status', p_new_status
  );
END;
$$;

-- Grant execute to service_role (used by edge functions)
GRANT EXECUTE ON FUNCTION public.update_installment_payment_status TO service_role;
