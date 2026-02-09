-- ============================================
-- UNIFIED CREDIT BATCHES SYSTEM
-- Replaces user_credit_balances, org_credit_balances, and unified credits
-- with a single batch-based system supporting FIFO expiration
-- ============================================

-- 1. Create credit_batches table
CREATE TABLE IF NOT EXISTS public.credit_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('user', 'org')),
  owner_id UUID NOT NULL,
  feature_key TEXT DEFAULT NULL,
  original_amount INTEGER NOT NULL CHECK (original_amount > 0),
  remaining_amount INTEGER NOT NULL CHECK (remaining_amount >= 0),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('subscription', 'purchase', 'grant', 'rollover', 'plan', 'program', 'addon')),
  source_reference_id TEXT DEFAULT NULL,
  description TEXT DEFAULT NULL,
  is_expired BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_credit_batches_owner ON credit_batches(owner_type, owner_id);
CREATE INDEX idx_credit_batches_feature ON credit_batches(owner_type, owner_id, feature_key);
CREATE INDEX idx_credit_batches_expires ON credit_batches(expires_at) WHERE NOT is_expired AND remaining_amount > 0;
CREATE INDEX idx_credit_batches_active ON credit_batches(owner_type, owner_id, is_expired, remaining_amount);

-- Enable RLS
ALTER TABLE credit_batches ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own credit batches"
  ON credit_batches FOR SELECT
  USING (owner_type = 'user' AND owner_id = auth.uid());

CREATE POLICY "Org admins can view org credit batches"
  ON credit_batches FOR SELECT
  USING (
    owner_type = 'org' AND 
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = credit_batches.owner_id 
      AND om.user_id = auth.uid() 
      AND om.role IN ('org_admin', 'org_manager')
    )
  );

CREATE POLICY "Admins can manage all credit batches"
  ON credit_batches FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 2. Add batch reference to existing transactions table
ALTER TABLE user_credit_transactions 
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES credit_batches(id);

-- 3. Grant credits function
CREATE OR REPLACE FUNCTION public.grant_credit_batch(
  p_owner_type TEXT,
  p_owner_id UUID,
  p_amount INTEGER,
  p_expires_at TIMESTAMPTZ,
  p_source_type TEXT,
  p_feature_key TEXT DEFAULT NULL,
  p_source_reference_id TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch_id UUID;
BEGIN
  INSERT INTO credit_batches (
    owner_type, owner_id, feature_key, original_amount, remaining_amount,
    expires_at, source_type, source_reference_id, description
  ) VALUES (
    p_owner_type, p_owner_id, p_feature_key, p_amount, p_amount,
    p_expires_at, p_source_type, p_source_reference_id, p_description
  )
  RETURNING id INTO v_batch_id;
  
  IF p_owner_type = 'user' THEN
    INSERT INTO user_credit_transactions (
      user_id, transaction_type, amount, balance_after, batch_id,
      action_type, description
    ) VALUES (
      p_owner_id, 'grant', p_amount,
      (SELECT COALESCE(SUM(remaining_amount), 0) FROM credit_batches 
       WHERE owner_type = 'user' AND owner_id = p_owner_id 
       AND NOT is_expired AND (feature_key IS NULL OR feature_key = p_feature_key)),
      v_batch_id, p_source_type, COALESCE(p_description, 'Credits granted')
    );
  END IF;
  
  RETURN v_batch_id;
END;
$$;

-- 4. Get available credits
CREATE OR REPLACE FUNCTION public.get_available_credits(
  p_owner_type TEXT,
  p_owner_id UUID,
  p_feature_key TEXT DEFAULT NULL
)
RETURNS TABLE (
  total_available INTEGER,
  general_available INTEGER,
  feature_available INTEGER,
  earliest_expiry TIMESTAMPTZ,
  batches JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE credit_batches
  SET is_expired = true, updated_at = now()
  WHERE owner_type = p_owner_type 
    AND owner_id = p_owner_id
    AND NOT is_expired 
    AND expires_at < now();

  RETURN QUERY
  SELECT
    COALESCE(SUM(
      CASE WHEN (cb.feature_key IS NULL OR cb.feature_key = p_feature_key) 
      THEN cb.remaining_amount ELSE 0 END
    ), 0)::INTEGER AS total_available,
    COALESCE(SUM(
      CASE WHEN cb.feature_key IS NULL THEN cb.remaining_amount ELSE 0 END
    ), 0)::INTEGER AS general_available,
    COALESCE(SUM(
      CASE WHEN cb.feature_key = p_feature_key THEN cb.remaining_amount ELSE 0 END
    ), 0)::INTEGER AS feature_available,
    MIN(CASE WHEN cb.remaining_amount > 0 AND (cb.feature_key IS NULL OR cb.feature_key = p_feature_key)
        THEN cb.expires_at ELSE NULL END) AS earliest_expiry,
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', cb.id,
        'feature_key', cb.feature_key,
        'remaining', cb.remaining_amount,
        'expires_at', cb.expires_at,
        'source_type', cb.source_type
      ) ORDER BY cb.expires_at
    ) FILTER (WHERE cb.remaining_amount > 0 AND (cb.feature_key IS NULL OR cb.feature_key = p_feature_key)), '[]'::jsonb) AS batches
  FROM credit_batches cb
  WHERE cb.owner_type = p_owner_type 
    AND cb.owner_id = p_owner_id
    AND NOT cb.is_expired;
END;
$$;

-- 5. FIFO Credit Consumption Function
CREATE OR REPLACE FUNCTION public.consume_credits_fifo(
  p_owner_type TEXT,
  p_owner_id UUID,
  p_amount INTEGER,
  p_feature_key TEXT DEFAULT NULL,
  p_action_type TEXT DEFAULT 'general',
  p_action_reference_id TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining INTEGER := p_amount;
  v_batch RECORD;
  v_deduct INTEGER;
  v_total_available INTEGER;
  v_balance_after INTEGER;
  v_consumed_batches JSONB := '[]'::jsonb;
BEGIN
  UPDATE credit_batches
  SET is_expired = true, updated_at = now()
  WHERE owner_type = p_owner_type 
    AND owner_id = p_owner_id
    AND NOT is_expired 
    AND expires_at < now();

  SELECT COALESCE(SUM(remaining_amount), 0) INTO v_total_available
  FROM credit_batches
  WHERE owner_type = p_owner_type 
    AND owner_id = p_owner_id
    AND NOT is_expired
    AND remaining_amount > 0
    AND (feature_key IS NULL OR feature_key = p_feature_key);

  IF v_total_available < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient credits',
      'available', v_total_available,
      'required', p_amount
    );
  END IF;

  IF p_feature_key IS NOT NULL THEN
    FOR v_batch IN
      SELECT id, remaining_amount
      FROM credit_batches
      WHERE owner_type = p_owner_type 
        AND owner_id = p_owner_id
        AND feature_key = p_feature_key
        AND NOT is_expired
        AND remaining_amount > 0
      ORDER BY expires_at ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_deduct := LEAST(v_batch.remaining_amount, v_remaining);
      UPDATE credit_batches SET remaining_amount = remaining_amount - v_deduct, updated_at = now() WHERE id = v_batch.id;
      v_consumed_batches := v_consumed_batches || jsonb_build_object('batch_id', v_batch.id, 'amount', v_deduct);
      v_remaining := v_remaining - v_deduct;
    END LOOP;
  END IF;

  FOR v_batch IN
    SELECT id, remaining_amount
    FROM credit_batches
    WHERE owner_type = p_owner_type 
      AND owner_id = p_owner_id
      AND feature_key IS NULL
      AND NOT is_expired
      AND remaining_amount > 0
    ORDER BY expires_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_deduct := LEAST(v_batch.remaining_amount, v_remaining);
    UPDATE credit_batches SET remaining_amount = remaining_amount - v_deduct, updated_at = now() WHERE id = v_batch.id;
    v_consumed_batches := v_consumed_batches || jsonb_build_object('batch_id', v_batch.id, 'amount', v_deduct);
    v_remaining := v_remaining - v_deduct;
  END LOOP;

  SELECT COALESCE(SUM(remaining_amount), 0) INTO v_balance_after
  FROM credit_batches
  WHERE owner_type = p_owner_type 
    AND owner_id = p_owner_id
    AND NOT is_expired
    AND (feature_key IS NULL OR feature_key = p_feature_key);

  IF p_owner_type = 'user' THEN
    INSERT INTO user_credit_transactions (
      user_id, transaction_type, amount, balance_after,
      action_type, action_reference_id, description
    ) VALUES (
      p_owner_id, 'consumption', -p_amount, v_balance_after,
      p_action_type, p_action_reference_id,
      COALESCE(p_description, 'Credits consumed')
    );
  ELSIF p_owner_type = 'org' THEN
    INSERT INTO org_credit_transactions (
      organization_id, transaction_type, amount, balance_after,
      description, performed_by
    ) VALUES (
      p_owner_id, 'consumption', -p_amount, v_balance_after,
      COALESCE(p_description, 'Credits consumed'), auth.uid()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'consumed', p_amount,
    'balance_after', v_balance_after,
    'batches_used', v_consumed_batches
  );
END;
$$;

-- 6. Rollover function
CREATE OR REPLACE FUNCTION public.process_credit_rollover(
  p_owner_type TEXT,
  p_owner_id UUID,
  p_max_rollover_months INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch RECORD;
  v_new_expires TIMESTAMPTZ;
  v_rolled_count INTEGER := 0;
  v_rolled_amount INTEGER := 0;
BEGIN
  FOR v_batch IN
    SELECT id, remaining_amount, expires_at, feature_key
    FROM credit_batches
    WHERE owner_type = p_owner_type 
      AND owner_id = p_owner_id
      AND NOT is_expired
      AND remaining_amount > 0
      AND expires_at BETWEEN now() AND now() + interval '24 hours'
      AND source_type != 'rollover'
    FOR UPDATE
  LOOP
    v_new_expires := v_batch.expires_at + (p_max_rollover_months || ' months')::interval;
    INSERT INTO credit_batches (
      owner_type, owner_id, feature_key, original_amount, remaining_amount,
      expires_at, source_type, source_reference_id, description
    ) VALUES (
      p_owner_type, p_owner_id, v_batch.feature_key, 
      v_batch.remaining_amount, v_batch.remaining_amount,
      v_new_expires, 'rollover', v_batch.id::text,
      'Rolled over from previous period'
    );
    UPDATE credit_batches SET remaining_amount = 0, updated_at = now() WHERE id = v_batch.id;
    v_rolled_count := v_rolled_count + 1;
    v_rolled_amount := v_rolled_amount + v_batch.remaining_amount;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'batches_rolled', v_rolled_count, 'credits_rolled', v_rolled_amount);
END;
$$;

-- 7. Expire batches
CREATE OR REPLACE FUNCTION public.expire_credit_batches()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_count INTEGER;
BEGIN
  UPDATE credit_batches SET is_expired = true, updated_at = now() WHERE NOT is_expired AND expires_at < now();
  GET DIAGNOSTICS v_expired_count = ROW_COUNT;
  RETURN v_expired_count;
END;
$$;

-- 8. Get user credit summary v2
CREATE OR REPLACE FUNCTION public.get_user_credit_summary_v2(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  PERFORM expire_credit_batches();
  
  SELECT jsonb_build_object(
    'available_credits', COALESCE(SUM(CASE WHEN feature_key IS NULL THEN remaining_amount ELSE 0 END), 0),
    'total_all_credits', COALESCE(SUM(remaining_amount), 0),
    'earliest_expiry', MIN(CASE WHEN remaining_amount > 0 THEN expires_at END),
    'expiring_soon', COALESCE(SUM(CASE WHEN expires_at < now() + interval '7 days' AND remaining_amount > 0 THEN remaining_amount ELSE 0 END), 0),
    'feature_credits', (
      SELECT COALESCE(jsonb_object_agg(feature_key, feature_total), '{}'::jsonb)
      FROM (SELECT feature_key, SUM(remaining_amount) as feature_total FROM credit_batches
        WHERE owner_type = 'user' AND owner_id = p_user_id AND NOT is_expired AND feature_key IS NOT NULL AND remaining_amount > 0
        GROUP BY feature_key) fc
    ),
    'batches', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id, 'feature_key', feature_key, 'remaining', remaining_amount, 'original', original_amount,
        'expires_at', expires_at, 'source_type', source_type, 'description', description
      ) ORDER BY expires_at), '[]'::jsonb)
      FROM credit_batches WHERE owner_type = 'user' AND owner_id = p_user_id AND NOT is_expired AND remaining_amount > 0
    )
  ) INTO v_result
  FROM credit_batches WHERE owner_type = 'user' AND owner_id = p_user_id AND NOT is_expired;
  
  RETURN COALESCE(v_result, '{"available_credits":0,"total_all_credits":0,"earliest_expiry":null,"expiring_soon":0,"feature_credits":{},"batches":[]}'::jsonb);
END;
$$;

-- 9. Get org credit summary v2
CREATE OR REPLACE FUNCTION public.get_org_credit_summary_v2(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  PERFORM expire_credit_batches();
  
  SELECT jsonb_build_object(
    'available_credits', COALESCE(SUM(remaining_amount), 0),
    'earliest_expiry', MIN(CASE WHEN remaining_amount > 0 THEN expires_at END),
    'expiring_soon', COALESCE(SUM(CASE WHEN expires_at < now() + interval '30 days' AND remaining_amount > 0 THEN remaining_amount ELSE 0 END), 0),
    'batches', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id, 'remaining', remaining_amount, 'original', original_amount,
        'expires_at', expires_at, 'source_type', source_type
      ) ORDER BY expires_at), '[]'::jsonb)
      FROM credit_batches WHERE owner_type = 'org' AND owner_id = p_org_id AND NOT is_expired AND remaining_amount > 0
    )
  ) INTO v_result
  FROM credit_batches WHERE owner_type = 'org' AND owner_id = p_org_id AND NOT is_expired;
  
  RETURN COALESCE(v_result, '{"available_credits":0,"earliest_expiry":null,"expiring_soon":0,"batches":[]}'::jsonb);
END;
$$;