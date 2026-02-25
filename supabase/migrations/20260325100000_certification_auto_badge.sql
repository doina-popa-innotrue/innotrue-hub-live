-- =============================================================================
-- 2B.5 Certification: Auto-Badge Creation, Expiry Schema, Notification Types
-- =============================================================================

-- 1. Schema extensions for badge expiry
-- -----------------------------------------------------------------------------
ALTER TABLE public.client_badges
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE public.program_badges
  ADD COLUMN IF NOT EXISTS renewal_period_months INTEGER;

COMMENT ON COLUMN public.client_badges.expires_at IS
  'When this badge expires. NULL = never expires.';
COMMENT ON COLUMN public.program_badges.renewal_period_months IS
  'Default renewal period in months. When set, expires_at is auto-calculated on issuance.';

-- 2. Performance indexes
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_client_badges_user_badge
  ON public.client_badges (user_id, program_badge_id);

CREATE INDEX IF NOT EXISTS idx_client_badges_status
  ON public.client_badges (status);

CREATE INDEX IF NOT EXISTS idx_program_badges_program_active
  ON public.program_badges (program_id) WHERE is_active = true;

-- 3. Notification types for badge lifecycle
-- -----------------------------------------------------------------------------

-- badge_pending_approval — sent when auto-badge is created on enrollment completion
INSERT INTO public.notification_types (key, category_id, name, description, icon, is_active, is_system, email_template_key, order_index)
SELECT 'badge_pending_approval',
       nc.id,
       'Badge Pending Approval',
       'Sent when a completion badge is created and pending instructor review',
       'award',
       true,
       true,
       'notification_badge_pending',
       10
FROM public.notification_categories nc WHERE nc.key = 'programs'
ON CONFLICT (key) DO NOTHING;

-- badge_issued — ensure type exists (email template already exists, but notification_type row may be missing)
INSERT INTO public.notification_types (key, category_id, name, description, icon, is_active, is_system, email_template_key, order_index)
SELECT 'badge_issued',
       nc.id,
       'Badge Issued',
       'Sent when an instructor approves and issues a completion badge',
       'award',
       true,
       true,
       'notification_badge_issued',
       11
FROM public.notification_categories nc WHERE nc.key = 'programs'
ON CONFLICT (key) DO NOTHING;

-- badge_expiring — for future expiry notification cron
INSERT INTO public.notification_types (key, category_id, name, description, icon, is_active, is_system, email_template_key, order_index)
SELECT 'badge_expiring',
       nc.id,
       'Badge Expiring',
       'Sent when a badge is expiring within 30 days',
       'alert-triangle',
       true,
       true,
       NULL,
       12
FROM public.notification_categories nc WHERE nc.key = 'programs'
ON CONFLICT (key) DO NOTHING;

-- 4. Email template for badge_pending_approval
-- -----------------------------------------------------------------------------
INSERT INTO public.email_templates (template_key, name, subject, html_content, description)
VALUES (
  'notification_badge_pending',
  'Badge Pending Approval',
  'Your Badge is Pending Review - InnoTrue Hub',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">🏅 Badge Pending Review</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px;">
    <p style="color: #374151; font-size: 16px;">Hi {{userName}},</p>
    <p style="color: #374151; font-size: 16px;">Congratulations on completing <strong>{{programName}}</strong>! Your completion badge has been created and is now pending instructor review.</p>
    <p style="color: #6b7280; font-size: 14px;">Once your instructor reviews and approves your badge, you''ll be able to share it on LinkedIn and download your certificate.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{link}}" style="background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">View Your Development Profile</a>
    </div>
    <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 30px;">InnoTrue Hub — Your Development Journey</p>
  </div>
</div>',
  'Sent when a badge is auto-created pending instructor approval'
)
ON CONFLICT (template_key) DO NOTHING;

-- 5. Auto-badge creation trigger on enrollment completion
-- -----------------------------------------------------------------------------
-- Fires AFTER UPDATE on client_enrollments when status changes to 'completed'.
-- The existing trg_set_enrollment_completed_at is a BEFORE trigger, so it runs
-- first and sets completed_at. This AFTER trigger then creates the badge.
CREATE OR REPLACE FUNCTION public.auto_create_badge_on_enrollment_completion()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_badge_id UUID;
  v_badge_renewal_months INTEGER;
  v_program_id UUID;
  v_program_name TEXT;
  v_user_name TEXT;
  v_client_badge_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_primary_instructor_id UUID;
BEGIN
  -- Only act on status change TO 'completed'
  IF NEW.status <> 'completed' OR (OLD.status IS NOT NULL AND OLD.status = 'completed') THEN
    RETURN NEW;
  END IF;

  -- Get program info
  SELECT p.id, p.name INTO v_program_id, v_program_name
  FROM programs p WHERE p.id = NEW.program_id;

  IF v_program_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if program has an active badge
  SELECT pb.id, pb.renewal_period_months INTO v_badge_id, v_badge_renewal_months
  FROM program_badges pb
  WHERE pb.program_id = v_program_id AND pb.is_active = true;

  IF v_badge_id IS NULL THEN
    RETURN NEW; -- No active badge for this program
  END IF;

  -- Check if user already has this badge (unique constraint is safety net)
  IF EXISTS (
    SELECT 1 FROM client_badges cb
    WHERE cb.user_id = NEW.client_user_id AND cb.program_badge_id = v_badge_id
  ) THEN
    RETURN NEW; -- Already has badge
  END IF;

  -- Calculate expiry if renewal period is set
  IF v_badge_renewal_months IS NOT NULL AND v_badge_renewal_months > 0 THEN
    v_expires_at := now() + (v_badge_renewal_months || ' months')::interval;
  END IF;

  -- Create pending badge
  INSERT INTO client_badges (user_id, program_badge_id, enrollment_id, status, expires_at)
  VALUES (NEW.client_user_id, v_badge_id, NEW.id, 'pending_approval', v_expires_at)
  RETURNING id INTO v_client_badge_id;

  -- Get user name for notification
  SELECT name INTO v_user_name FROM profiles WHERE id = NEW.client_user_id;

  -- Notify client: badge pending review
  PERFORM create_notification(
    NEW.client_user_id,
    'badge_pending_approval',
    'Badge Pending Approval',
    format('Your completion badge for %s is pending instructor review.', v_program_name),
    '/development-profile',
    jsonb_build_object('badge_id', v_client_badge_id, 'program_name', v_program_name)
  );

  -- Notify primary instructor(s)
  FOR v_primary_instructor_id IN
    SELECT pi.instructor_id FROM program_instructors pi
    WHERE pi.program_id = v_program_id AND pi.is_primary = true
  LOOP
    PERFORM create_notification(
      v_primary_instructor_id,
      'badge_pending_approval',
      'New Badge Pending Approval',
      format('%s has completed %s and their badge needs your review.', COALESCE(v_user_name, 'A participant'), v_program_name),
      '/teaching/badges',
      jsonb_build_object('badge_id', v_client_badge_id, 'user_id', NEW.client_user_id, 'program_name', v_program_name)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_badge_on_completion ON public.client_enrollments;
CREATE TRIGGER trg_auto_create_badge_on_completion
  AFTER UPDATE ON public.client_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_badge_on_enrollment_completion();
