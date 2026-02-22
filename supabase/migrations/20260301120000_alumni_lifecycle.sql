-- =============================================================================
-- 2B.1: Alumni Lifecycle — completed_at tracking, grace period, touchpoints
-- =============================================================================

-- 1. Add completed_at to client_enrollments
ALTER TABLE public.client_enrollments
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.client_enrollments.completed_at IS
  'Timestamp when enrollment status changed to completed. Used to compute alumni grace period.';

-- Backfill: set completed_at for already-completed enrollments
UPDATE public.client_enrollments
SET completed_at = updated_at
WHERE status = 'completed' AND completed_at IS NULL;

-- 2. Add alumni grace period setting
INSERT INTO public.system_settings (key, value, description)
VALUES ('alumni_grace_period_days', '90',
        'Days after program completion during which alumni retain read-only content access. Set to 0 for no grace period, or a large number for permanent read-only access.')
ON CONFLICT (key) DO NOTHING;

-- 3. Alumni touchpoints tracking (prevent duplicate nurture emails)
CREATE TABLE IF NOT EXISTS public.alumni_touchpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES public.client_enrollments(id) ON DELETE CASCADE,
  touchpoint_type TEXT NOT NULL CHECK (touchpoint_type IN (
    'completion_congratulations', 'nurture_30d', 'nurture_60d', 'nurture_90d', 'access_expired', 'custom'
  )),
  sent_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(enrollment_id, touchpoint_type)
);

COMMENT ON TABLE public.alumni_touchpoints IS 'Tracks which alumni nurture emails have been sent per enrollment';

ALTER TABLE public.alumni_touchpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage alumni touchpoints"
  ON public.alumni_touchpoints FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users view own touchpoints"
  ON public.alumni_touchpoints FOR SELECT TO authenticated
  USING (enrollment_id IN (
    SELECT id FROM public.client_enrollments WHERE client_user_id = auth.uid()
  ));

-- 4. Helper function: check if user has alumni (read-only) access to a program
CREATE OR REPLACE FUNCTION public.check_alumni_access(p_user_id uuid, p_program_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_enrollment record;
  v_grace_days integer;
  v_grace_expires_at timestamptz;
  v_is_in_grace boolean;
BEGIN
  -- Get grace period setting
  SELECT value::integer INTO v_grace_days
  FROM system_settings WHERE key = 'alumni_grace_period_days';
  v_grace_days := COALESCE(v_grace_days, 90);

  -- Find completed enrollment (most recent)
  SELECT id, completed_at, updated_at INTO v_enrollment
  FROM client_enrollments
  WHERE client_user_id = p_user_id AND program_id = p_program_id AND status = 'completed'
  ORDER BY completed_at DESC NULLS LAST LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('has_access', false, 'reason', 'no_completed_enrollment');
  END IF;

  v_grace_expires_at := COALESCE(v_enrollment.completed_at, v_enrollment.updated_at)
                         + (v_grace_days || ' days')::interval;
  v_is_in_grace := v_grace_expires_at > now();

  RETURN jsonb_build_object(
    'has_access', v_is_in_grace,
    'read_only', true,
    'in_grace_period', v_is_in_grace,
    'grace_expires_at', v_grace_expires_at,
    'completed_at', COALESCE(v_enrollment.completed_at, v_enrollment.updated_at),
    'days_remaining', GREATEST(0, EXTRACT(DAY FROM v_grace_expires_at - now())::integer),
    'enrollment_id', v_enrollment.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_alumni_access(uuid, uuid) TO authenticated;

-- 5. Trigger to auto-set completed_at when enrollment status changes to 'completed'
CREATE OR REPLACE FUNCTION public.set_enrollment_completed_at()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    NEW.completed_at := COALESCE(NEW.completed_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_enrollment_completed_at ON public.client_enrollments;
CREATE TRIGGER trg_set_enrollment_completed_at
  BEFORE UPDATE ON public.client_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_enrollment_completed_at();
