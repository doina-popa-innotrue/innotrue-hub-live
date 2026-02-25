-- ============================================================================
-- 2B.10: Enrollment Duration & Deadline Enforcement
--
-- Adds programs.default_duration_days so admins can set a default enrollment
-- duration. Updates enroll_with_credits to auto-calculate start_date/end_date.
-- Creates touchpoints table for deduplicating deadline warnings.
-- Adds notification types and a daily cron for enforcement.
-- ============================================================================

-- 1. Add default_duration_days to programs
-- NULL = self-paced (no deadline). When set, new enrollments get auto end_date.
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS default_duration_days INTEGER;

COMMENT ON COLUMN public.programs.default_duration_days IS
  'Default enrollment duration in days. NULL = self-paced (no deadline). When set, enroll_with_credits auto-calculates end_date = start_date + default_duration_days.';

-- 2. Backfill start_date for existing enrollments that don't have one
UPDATE public.client_enrollments
SET start_date = COALESCE(created_at, now())
WHERE start_date IS NULL;

-- 3. Update enroll_with_credits to set start_date and end_date
-- Drop old overloads to avoid ambiguity (same pattern as 20260301140000)
DROP FUNCTION IF EXISTS public.enroll_with_credits(uuid, uuid, text, uuid, numeric, integer, integer, text);
DROP FUNCTION IF EXISTS public.enroll_with_credits(uuid, uuid, text, uuid, numeric, integer, integer, text, uuid);
DROP FUNCTION IF EXISTS public.enroll_with_credits(uuid, uuid, text, uuid, numeric, integer, integer, text, uuid, boolean, text, uuid, text);

CREATE OR REPLACE FUNCTION public.enroll_with_credits(
  p_client_user_id uuid,
  p_program_id uuid,
  p_tier text DEFAULT NULL,
  p_program_plan_id uuid DEFAULT NULL,
  p_discount_percent numeric DEFAULT NULL,
  p_original_credit_cost integer DEFAULT NULL,
  p_final_credit_cost integer DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_cohort_id uuid DEFAULT NULL,
  p_force boolean DEFAULT false,
  p_enrollment_source text DEFAULT NULL,
  p_referred_by uuid DEFAULT NULL,
  p_referral_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enrollment_id uuid;
  v_consume_result jsonb;
  v_prog_check jsonb;
  v_cohort_check jsonb;
  v_duration_days integer;
  v_start_date timestamptz;
  v_end_date timestamptz;
BEGIN
  -- Step 0a: Program-level capacity check (unless forced)
  IF NOT COALESCE(p_force, false) THEN
    v_prog_check := public.check_program_capacity(p_program_id);
    IF v_prog_check->>'has_capacity' IS NOT NULL
       AND NOT (v_prog_check->>'has_capacity')::boolean THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Program is at full capacity (%s/%s)',
          v_prog_check->>'enrolled_count', v_prog_check->>'capacity'),
        'enrollment_id', null,
        'credit_details', null
      );
    END IF;
  END IF;

  -- Step 0b: Cohort-level capacity check (unless forced)
  IF p_cohort_id IS NOT NULL AND NOT COALESCE(p_force, false) THEN
    v_cohort_check := public.check_cohort_capacity(p_cohort_id);
    IF NOT (v_cohort_check->>'has_capacity')::boolean THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Cohort is at full capacity (%s/%s)',
          v_cohort_check->>'enrolled_count', v_cohort_check->>'capacity'),
        'enrollment_id', null,
        'credit_details', null
      );
    END IF;
  END IF;

  -- Step 0c: Tier defaulting — if no tier specified but program has tiers,
  -- default to the first (lowest) tier in the program's tier array
  IF p_tier IS NULL THEN
    SELECT tiers->>0 INTO p_tier
    FROM programs WHERE id = p_program_id;
  END IF;

  -- Step 0d: Program-plan defaulting — if no program_plan_id specified but
  -- a tier is set, look up the plan from program_tier_plans.
  -- Falls back to programs.default_program_plan_id if no tier mapping exists.
  IF p_program_plan_id IS NULL THEN
    IF p_tier IS NOT NULL THEN
      SELECT ptp.program_plan_id INTO p_program_plan_id
      FROM program_tier_plans ptp
      WHERE ptp.program_id = p_program_id
        AND ptp.tier_name = p_tier;
    END IF;

    -- If still NULL (no tier mapping), use program default
    IF p_program_plan_id IS NULL THEN
      SELECT default_program_plan_id INTO p_program_plan_id
      FROM programs WHERE id = p_program_id;
    END IF;
  END IF;

  -- Step 0e: Enrollment duration — set start_date and calculate end_date
  v_start_date := now();

  SELECT default_duration_days INTO v_duration_days
  FROM programs WHERE id = p_program_id;

  IF v_duration_days IS NOT NULL THEN
    v_end_date := v_start_date + (v_duration_days || ' days')::interval;
  END IF;

  -- Step 1: Consume credits if cost > 0
  IF COALESCE(p_final_credit_cost, 0) > 0 THEN
    v_consume_result := public.consume_credits_fifo(
      p_owner_type := 'user',
      p_owner_id := p_client_user_id,
      p_amount := p_final_credit_cost,
      p_feature_key := NULL,
      p_action_type := 'program_enrollment',
      p_action_reference_id := p_program_id::text,
      p_description := COALESCE(p_description, 'Program enrollment')
    );

    -- If credit consumption failed, abort — nothing has been committed yet
    IF NOT (v_consume_result->>'success')::boolean THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', COALESCE(v_consume_result->>'error', 'Credit consumption failed'),
        'enrollment_id', null,
        'credit_details', v_consume_result
      );
    END IF;
  END IF;

  -- Step 2: Create enrollment (same transaction — auto-rolls back on failure)
  INSERT INTO client_enrollments (
    client_user_id,
    program_id,
    status,
    tier,
    program_plan_id,
    discount_percent,
    original_credit_cost,
    final_credit_cost,
    cohort_id,
    enrollment_source,
    referred_by,
    referral_note,
    start_date,
    end_date
  ) VALUES (
    p_client_user_id,
    p_program_id,
    'active',
    p_tier,
    p_program_plan_id,
    p_discount_percent,
    p_original_credit_cost,
    p_final_credit_cost,
    p_cohort_id,
    p_enrollment_source,
    p_referred_by,
    p_referral_note,
    v_start_date,
    v_end_date
  )
  RETURNING id INTO v_enrollment_id;

  -- Step 3: Link consumption log entries to the enrollment
  IF COALESCE(p_final_credit_cost, 0) > 0 THEN
    UPDATE credit_consumption_log
    SET action_reference_id = v_enrollment_id::text
    WHERE action_reference_id = p_program_id::text
      AND action_type = 'program_enrollment'
      AND user_id = p_client_user_id
      AND consumed_at >= now() - interval '5 seconds';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'enrollment_id', v_enrollment_id,
    'credit_details', COALESCE(v_consume_result, '{}'::jsonb)
  );

EXCEPTION WHEN OTHERS THEN
  -- Any failure (including enrollment insert) rolls back EVERYTHING
  -- including the credit consumption from step 1
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'enrollment_id', null,
    'credit_details', null
  );
END;
$$;

-- Grant with full 13-param signature (unchanged)
GRANT EXECUTE ON FUNCTION public.enroll_with_credits(uuid, uuid, text, uuid, numeric, integer, integer, text, uuid, boolean, text, uuid, text) TO authenticated;

-- 4. Enrollment deadline touchpoints (deduplication table)
-- Pattern: alumni_touchpoints from 20260301120000_alumni_lifecycle.sql
CREATE TABLE IF NOT EXISTS public.enrollment_deadline_touchpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES public.client_enrollments(id) ON DELETE CASCADE,
  touchpoint_type TEXT NOT NULL CHECK (touchpoint_type IN (
    'deadline_warning_30d', 'deadline_warning_7d', 'deadline_expired'
  )),
  sent_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(enrollment_id, touchpoint_type)
);

COMMENT ON TABLE public.enrollment_deadline_touchpoints IS
  'Tracks which deadline warning emails have been sent per enrollment (prevents duplicates)';

ALTER TABLE public.enrollment_deadline_touchpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage deadline touchpoints"
  ON public.enrollment_deadline_touchpoints FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users view own deadline touchpoints"
  ON public.enrollment_deadline_touchpoints FOR SELECT TO authenticated
  USING (enrollment_id IN (
    SELECT id FROM public.client_enrollments WHERE client_user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_deadline_touchpoints_enrollment
  ON public.enrollment_deadline_touchpoints (enrollment_id);

-- 5. Notification types
INSERT INTO public.notification_types (key, category_id, name, description, icon, is_active, is_system, email_template_key, order_index)
SELECT 'enrollment_deadline_30d',
       nc.id,
       'Enrollment Deadline — 30 Days',
       'Sent 30 days before enrollment deadline expires',
       'clock',
       true,
       true,
       NULL,
       20
FROM public.notification_categories nc WHERE nc.key = 'programs'
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.notification_types (key, category_id, name, description, icon, is_active, is_system, email_template_key, order_index)
SELECT 'enrollment_deadline_7d',
       nc.id,
       'Enrollment Deadline — 7 Days',
       'Sent 7 days before enrollment deadline expires',
       'alert-triangle',
       true,
       true,
       NULL,
       21
FROM public.notification_categories nc WHERE nc.key = 'programs'
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.notification_types (key, category_id, name, description, icon, is_active, is_system, email_template_key, order_index)
SELECT 'enrollment_deadline_expired',
       nc.id,
       'Enrollment Deadline Expired',
       'Sent when enrollment deadline passes and status transitions to completed',
       'x-circle',
       true,
       true,
       NULL,
       22
FROM public.notification_categories nc WHERE nc.key = 'programs'
ON CONFLICT (key) DO NOTHING;

-- 6. Performance index for the cron query
CREATE INDEX IF NOT EXISTS idx_client_enrollments_active_end_date
  ON public.client_enrollments (end_date)
  WHERE status = 'active' AND end_date IS NOT NULL;

-- 7. Daily cron job at 5 AM UTC
SELECT cron.schedule(
  'daily-enforce-enrollment-deadlines',
  '0 5 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/enforce-enrollment-deadlines',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
    body := '{}'::jsonb
  )$$
);
